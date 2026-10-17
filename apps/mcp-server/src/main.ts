import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createCraftkitMcpServer } from './server';

/**
 * The runnable entry: build the server, speak MCP over stdio, wait.
 *
 * Everything with behaviour lives in `server.ts`, which is tested without a
 * transport at all. This file is the only one that touches the process, and it
 * is kept too small to hide a bug in — the same split `apps/ai-server` uses.
 *
 * NOTHING may be written to stdout here. stdout IS the protocol channel: a
 * stray `console.log` becomes a malformed JSON-RPC frame and the client
 * disconnects with a parse error that names none of this. Diagnostics go to
 * stderr, which the client shows in its logs.
 */
const server = createCraftkitMcpServer();

await server.connect(new StdioServerTransport());

console.error('craftkit mcp-server ready on stdio');
