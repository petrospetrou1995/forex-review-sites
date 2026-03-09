import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, 'data', 'brokers-db.json');

function readDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Broker DB must be an array');
  return data;
}

export const BROKER_DB = readDb();

