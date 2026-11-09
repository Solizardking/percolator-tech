import { createServer, createMemoryStore } from './app.js';

const url = process.env.DATABASE_URL;
const store = url
  ? await (await import('./store-pg.js')).createPgStore(url)
  : createMemoryStore();
if (!url) console.warn('DATABASE_URL not set: using in-memory store');

const port = Number(process.env.PORT || 10000);
createServer(store, {
  ipSalt: process.env.IP_HASH_SALT || 'dev-only-change-me',
  marketsUrl: process.env.MARKETS_URL || 'https://percolator.clawdchain.trade/api/markets',
}).listen(port, '0.0.0.0', () => {
  console.log(`percolator-tech on :${port}`);
});
