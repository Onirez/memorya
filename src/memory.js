import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = './data';
const MEMORY_FILE = join(DATA_DIR, 'memories.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let memories = [];
if (existsSync(MEMORY_FILE)) {
  try {
    memories = JSON.parse(readFileSync(MEMORY_FILE, 'utf8')).memories || [];
  } catch {}
}

function save() {
  writeFileSync(MEMORY_FILE, JSON.stringify({ memories }, null, 2));
}

async function embed(text) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  const json = await resp.json();
  return json.data[0].embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function store({ content, metadata = {}, weight = 1 }) {
  const vector = await embed(content);
  memories.push({
    id: crypto.randomUUID(),
    content,
    vector,
    metadata: { ...metadata, weight, timestamp: Date.now() },
  });
  if (memories.length > 5000) memories = memories.slice(-5000);
  save();
  return memories[memories.length - 1];
}

export function search(queryVector, { guildId, type, limit = 5, threshold = 0.6 } = {}) {
  return memories
    .filter(m => {
      if (guildId && m.metadata.guildId !== guildId) return false;
      if (type && m.metadata.type !== type) return false;
      return true;
    })
    .map(m => ({ ...m, score: cosine(queryVector, m.vector) }))
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getStats() {
  return { count: memories.length };
}

export { memories };
