#!/usr/bin/env node
/**
 * TEMPORARY dev bridge: the AssistantPanel's wire contract, answered by the
 * local Claude Code CLI instead of a real assistant server.
 *
 * Run:    node scripts/ai-plan-bridge.mjs
 * Wire:   apps/playground/.env.local -> VITE_AI_PLAN_ENDPOINT=http://localhost:8787/plan
 *
 * It implements exactly `AiPlanWireRequest` / `AiPlanWireResponse` from
 * `@craftkit/builder-ai` (see packages/builder/ai/src/provider/wire.ts and the
 * package README): POST /plan receives { version, request, context, attempt? }.
 * A client that advertises `accept: text/event-stream` gets the streaming
 * answer — `status` frames narrating the work, then one `result` frame — and a
 * plain client gets one JSON body. Closing the request KILLS the model
 * process; Stop in the panel is a real cancellation, not a dropped promise.
 * Every answer still walks the frontend's registry + scratch-kernel
 * validation, so a bad model answer can only ever become a rejected proposal.
 *
 * This file is a test harness, not a product. When the real server exists,
 * point VITE_AI_PLAN_ENDPOINT at it and delete this.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';

const PORT = Number(process.env.AI_BRIDGE_PORT ?? 8787);
/** Optional CLI model override, e.g. AI_BRIDGE_MODEL=claude-haiku-4-5 */
const MODEL = process.env.AI_BRIDGE_MODEL;
const CLI_TIMEOUT_MS = 110_000;

/* The kernel's command vocabulary. The wire context describes BLOCKS but not
   commands, so the bridge states the door's own arg shapes (from
   packages/builder/core/src/commands/core-commands.ts). */
const COMMAND_REFERENCE = `
Available commands and their exact args:
- insertNode: { "type": string, "parentId": string, "props"?: object, "slot"?: string, "index"?: number }
- removeNode: { "id": string }
- moveNode: { "id": string, "toParentId": string, "toSlot"?: string, "toIndex"?: number }
- setProp: { "id": string, "key": string, "value": any JSON }
- duplicateNode: { "id": string }
- wrapNode: { "id": string, "wrapperType": string, "wrapperProps"?: object, "wrapperSlot"?: string }
- groupNodes: { "ids": string[], "groupType": string, "groupProps"?: object }
`.trim();

function buildPrompt(body) {
  const fragments = (body.context?.fragments ?? [])
    .map((f) => `## ${f.title}\n${f.body}`)
    .join('\n\n');

  const repair =
    body.attempt === undefined
      ? ''
      : `
Your previous plan was REJECTED by the document kernel. Fix it.
Previous plan: ${JSON.stringify(body.attempt.plan)}
Validation issues: ${JSON.stringify(body.attempt.issues)}
`;

  const history = (body.history ?? [])
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`)
    .join('\n');
  const conversation = history === '' ? '' : `\n# Conversation so far\n${history}\n`;

  return `You are the planning engine of a page builder. You NEVER write documents; you propose kernel commands that the editor validates and applies itself.

${COMMAND_REFERENCE}

Rules:
- Props must satisfy each block's JSON Schema from the catalog below. START from the block's example node and change only what the request needs. Enum values must be copied EXACTLY from the schema; if unsure about an optional prop, OMIT it — schema defaults exist and an omitted prop can never be invalid.
- A prop value ending in "… [truncated]" is an EXCERPT of longer content: never write it back with setProp and never rewrite that prop wholesale — edit other props, or ask the user.
- "type" MUST be copied exactly from the block catalog below — a type that is not in the catalog is REJECTED, never invented. Achieve any look by COMPOSING catalog blocks and styling them, not by imagining new ones.
- parentId must be an existing node id from the document context ("root" is the page root), and the child type must be allowed in that parent's slot.
- Answer with ONE JSON object and NOTHING else (no markdown fences, no prose):
  {"rationale": "<one short sentence>", "commands": [{"command": "<name>", "args": {...}}]}
- If the request cannot be turned into commands, answer: {"refusal": "<one short sentence why>"}
- STAGED WORK — HARD LIMIT: a plan carries AT MOST 8 commands. A request that needs more (a whole page, a redesign) is delivered in stages: do the most valuable ≤8 commands now — structure before decoration — and put the NEXT stage's request in "followUp", in the user's language (e.g. "كمل التنسيق والألوان"). followUp is REQUIRED whenever the limit stopped you before the request was fully satisfied, and omitted only when this plan finishes the request. Never exceed the limit; a 60-command plan is a failure even when correct.
- The object must be STRICT valid JSON: double quotes only, every quote inside a string escaped, no trailing commas. Re-check long answers before finishing.
- Every command carries a "title": one short human sentence naming the step IN THE SAME LANGUAGE as the user's request ("إضافة قسم الأسعار", "Recolour the hero"). Write the rationale in that language too.
- STYLING with "className" (a prop every block accepts, via setProp or inside insertNode props):
  * Utilities are BOUND TO THE SITE'S DESIGN SYSTEM. Two families are REJECTED by the editor: arbitrary bracket values (p-[17px], bg-[#f00], w-[42rem]) and Tailwind's default colour palette (bg-blue-500, text-gray-700). Never emit either.
  * Colours come ONLY from the site's tokens: bg-/text-/border- with accent, accent-text, success, success-text, surface, surface-inverse, text, text-inverse, text-muted — plus white/black/transparent. hover:/sm:/md:/lg: variants allowed.
  * The numeric scale is the site's own rhythm (p-4 = 4 steps, not 16px): p*/m*-0..16, gap-0..12, mx-auto, text-xs..6xl, font weights, text alignment, italic/underline/uppercase, tracking/leading, flex/grid/block/hidden, flex-row/col/wrap, items-*/justify-*, grid-cols-1..6, rounded*, shadow*, border widths, opacity, w-full/h-full/min-h-screen/max-w-*, transition/duration.
  * Craft, not decoration: prefer the block's OWN props first (tone, colour roles, spacing, gutter); reach for className only for what props cannot express. Compose sections like a designer — container pattern (max-w-6xl mx-auto px-6), generous vertical rhythm (py-12..16), one accent per section, consistent gaps — never a pile of random utilities.

# Editor context
${fragments}
${conversation}${repair}
# User request
${body.request}`;
}

/** A model that wrote broken JSON gets exactly one chance to fix its own answer. */
function buildFixPrompt(brokenText, parseError) {
  return `Your previous answer had to be ONE valid JSON object but it failed to parse.
Parse error: ${parseError}

Your previous answer:
${brokenText}

Output the SAME answer as ONE corrected, strictly valid JSON object — double quotes only, inner quotes escaped, no trailing commas, no markdown fences, no prose.`;
}

/** claude sometimes wraps the object anyway; dig the one JSON object out. */
function extractJson(text) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('No JSON object in the model answer.');
  }
}

/**
 * One CLI run, narrated. `onStatus` receives progress sentences as the model
 * streams; the returned promise settles with the model's final text. Calling
 * the returned `cancel` kills the process for real.
 */
function callClaude(prompt, onStatus) {
  // --strict-mcp-config with no servers + a neutral cwd: the CLI must not
  // spend 10+ seconds loading this repo's CLAUDE.md and MCP servers for
  // every single proposal — the prompt carries all the context it needs.
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--max-turns',
    '1',
    '--strict-mcp-config',
  ];
  if (MODEL) {
    args.push('--model', MODEL);
  }
  const child = spawn('claude', args, { cwd: tmpdir() });
  child.stdin.end(prompt);
  const cancel = () => {
    child.kill('SIGTERM');
  };
  const timer = setTimeout(cancel, CLI_TIMEOUT_MS);

  const done = new Promise((resolve, reject) => {
    let buffer = '';
    let draft = '';
    let commandsSeen = 0;
    let finalText;
    let stderr = '';

    const handleEvent = (event) => {
      if (event.type === 'system' && event.subtype === 'init') {
        onStatus('Model ready — thinking…');
        return;
      }
      if (event.type === 'stream_event') {
        const delta = event.event?.delta;
        if (delta?.type === 'thinking_delta') {
          onStatus('Thinking about the page…');
        }
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          draft += delta.text;
          const count = (draft.match(/"command"/g) ?? []).length;
          if (count > commandsSeen) {
            commandsSeen = count;
            onStatus(
              `Writing the plan — ${String(count)} command${count === 1 ? '' : 's'} so far…`,
            );
          } else if (commandsSeen === 0 && draft.length > 40) {
            onStatus('Writing the answer…');
          }
        }
        return;
      }
      if (event.type === 'result') {
        if (event.is_error) {
          reject(new Error(`claude CLI error: ${event.result ?? 'unknown'}`));
        } else {
          finalText = String(event.result ?? '');
        }
      }
    };

    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (line === '') {
          continue;
        }
        try {
          handleEvent(JSON.parse(line));
        } catch {
          // A non-JSON line in the stream is noise, never a reason to fail.
        }
      }
    });
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', (cause) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI could not start: ${cause.message}`));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (signal !== null) {
        reject(new Error(`cancelled (${signal})`));
      } else if (finalText !== undefined) {
        resolve(finalText);
      } else {
        reject(new Error(`claude CLI exited ${String(code)}: ${stderr.slice(0, 300)}`));
      }
    });
  });

  return { done, cancel };
}

const CORS = {
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-origin': '*',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function toWireResponse(modelText) {
  const parsed = extractJson(modelText);
  if (typeof parsed.refusal === 'string') {
    return { refusal: parsed.refusal };
  }
  if (typeof parsed.rationale !== 'string' || !Array.isArray(parsed.commands)) {
    throw new Error('Model answer is neither a plan nor a refusal.');
  }
  return {
    rationale: parsed.rationale,
    commands: parsed.commands,
    ...(typeof parsed.followUp === 'string' && parsed.followUp !== ''
      ? { followUp: parsed.followUp }
      : {}),
  };
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, backend: 'claude-cli', model: MODEL ?? 'cli-default' });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/plan') {
    sendJson(res, 404, { refusal: 'Unknown endpoint; POST /plan.' });
    return;
  }

  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', async () => {
    const startedAt = Date.now();
    const wantsStream = (req.headers.accept ?? '').includes('text/event-stream');
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { refusal: 'The request body was not JSON.' });
      return;
    }
    const label = body.attempt === undefined ? 'plan' : 'repair';
    console.log(
      `→ ${label}${wantsStream ? ' (stream)' : ''}: "${String(body.request).slice(0, 80)}"`,
    );

    let writeStatus = () => undefined;
    if (wantsStream) {
      res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream' });
      let lastStatus = '';
      writeStatus = (text) => {
        if (text === lastStatus) {
          return; // The same sentence twice is noise, not progress.
        }
        lastStatus = text;
        res.write(`event: status\ndata: ${JSON.stringify({ text })}\n\n`);
      };
    }

    // Stop in the panel closes this request; whichever model process is
    // currently running for it dies with it — including a format-fix round.
    const live = { cancel: () => undefined };
    res.on('close', () => {
      if (!res.writableEnded) {
        live.cancel();
      }
    });
    const run = (prompt) => {
      const call = callClaude(prompt, writeStatus);
      live.cancel = call.cancel;
      return call.done;
    };

    try {
      const text = await run(buildPrompt(body));
      let wire;
      try {
        wire = toWireResponse(text);
      } catch (parseCause) {
        // Long plans sometimes carry one JSON slip. That is a formatting
        // problem, not a planning problem — hand the model its own broken
        // answer once instead of handing the person a parse error.
        const parseMessage = parseCause instanceof Error ? parseCause.message : String(parseCause);
        console.warn(`… ${label}: invalid model JSON (${parseMessage}); one format-fix round`);
        writeStatus('Fixing the answer format…');
        wire = toWireResponse(await run(buildFixPrompt(text, parseMessage)));
      }
      const summary =
        'refusal' in wire
          ? `refusal: ${wire.refusal}`
          : wire.commands.map((c) => c.command).join(', ');
      console.log(`← ${label} (${String(Date.now() - startedAt)}ms): ${summary}`);
      if (wantsStream) {
        res.write(`event: result\ndata: ${JSON.stringify(wire)}\n\n`);
        res.end();
      } else {
        sendJson(res, 200, wire);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`✗ ${label} (${String(Date.now() - startedAt)}ms): ${message}`);
      if (res.writableEnded || message.startsWith('cancelled')) {
        return; // The client already left; there is nobody to answer.
      }
      const refusal = { refusal: `Bridge error: ${message}` };
      if (wantsStream) {
        res.write(`event: result\ndata: ${JSON.stringify(refusal)}\n\n`);
        res.end();
      } else {
        sendJson(res, 200, refusal);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(
    `AI plan bridge → http://localhost:${String(PORT)}/plan (backend: claude CLI${MODEL ? `, model ${MODEL}` : ''}, streaming + cancel)`,
  );
  console.log('Wire the playground: VITE_AI_PLAN_ENDPOINT=http://localhost:%d/plan', PORT);
});
