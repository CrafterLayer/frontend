// @craftkit/mcp-server — the CraftKit builder as a Model Context Protocol
// server. The library surface: a host embeds `createCraftkitMcpServer` in a
// transport of its own; `main.ts` is the stdio binary that ships with it.
export { createCraftkitMcpServer, type CraftkitMcpServerOptions } from './server';
export {
  createMemoryDocumentStore,
  type DocumentSession,
  type DocumentStore,
} from './document-store';
