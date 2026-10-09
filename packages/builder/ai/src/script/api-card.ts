/**
 * The card the model reads about edit scripts (agent-script DESIGN §A.4, §A.11).
 *
 * It sits in its OWN block of the edit lane's cached rules (the tool catalog
 * is full), so it costs ~230 tokens once and ~10% after that. The ai-server
 * carries a verbatim copy between `// BEGIN SCRIPT CARD` and `// END SCRIPT
 * CARD`; its drift test imports this file and compares the text exactly.
 *
 * The examples are plain JavaScript (no TypeScript), written with single
 * quotes so they survive inside a JSON string; a test runs both through
 * `new Function` and pins the card at 1,000 characters or fewer.
 */
export const SCRIPT_CARD = `EDIT SCRIPT — for ONE change on 5+ elements, or content from data (menu, prices, team, FAQ), answer with one step {"command":"tool","args":{"name":"script.run","input":{"code":"..."}}}. code: plain JavaScript run once, sandboxed: no TypeScript/import/await/fetch/DOM; single quotes; ';' between statements. Its writes join this plan (one Undo). Not page code.
ck.find({kind?,text?,section?,page?}) -> El[] kind: section|heading|text|button|link|image|icon|card|item|input
El={id,kind,text,tag,node,section,page,path?,part?,index?,src?,href?}
ck.set(el|els,{text?,href?,src?,alt?}) ck.style(el|els,{textColor:'accent'},{bucket?,state?})
ck.tool(name,input) any tool above (kit.insert, part.list, media.add)
ck.pages() ck.photos(topic,n)->[{src,alt}] ck.fmt.num(n,{digits:'arab'|'latn'}) ck.fmt.money(n,'JOD') ck.note(text)
e.g. ck.style(ck.find({kind:'button'}),{borderRadius:'full'})
e.g. const t={'Our menu':'قائمتنا'};ck.find({kind:'heading'}).forEach(h=>{if(t[h.text])ck.set(h,{text:t[h.text]})})`;

/** The card's worked examples (the lines that start with "e.g. "), as code. */
export function scriptCardExamples(card: string = SCRIPT_CARD): readonly string[] {
  return card
    .split('\n')
    .filter((line) => line.startsWith('e.g. '))
    .map((line) => line.slice('e.g. '.length));
}

/** The card's budget: a test pins it. */
export const SCRIPT_CARD_MAX_CHARS = 1_000;
