import { OpenAI } from 'openai';
import { search, store } from './memory.js';
import { buildSystemPrompt } from './prompt.js';
import config from '../config.json' assert { type: 'json' };

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': config.openrouter.siteUrl,
    'X-Title': config.openrouter.appName,
  },
});

const MODEL = process.env.OPENROUTER_MODEL || config.ai.model;

async function embedWithOpenAI(text) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.memory.embeddingModel, input: text.slice(0, 8000) }),
  });
  const json = await resp.json();
  return json.data[0].embedding;
}

export async function generateResponse(message, shortTermHistory) {
  // 1. Embedding de la requête pour recherche
  let queryVector;
  try {
    queryVector = await embedWithOpenAI(message.content);
  } catch (e) {
    console.warn('Embedding failed:', e.message);
    queryVector = null;
  }

  // 2. RAG : recherche souvenirs pertinents
  let contextMemories = [];
  if (queryVector && config.memory.enabled) {
    contextMemories = search(queryVector, {
      guildId: message.guildId || 'dm',
      limit: config.memory.topK,
      threshold: config.memory.similarityThreshold,
    });
  }

  // 3. Détection intention (correction / fait)
  const contentLower = message.content.toLowerCase();
  const isCorrection = /^(non|pas|erreur|faux|corrige|correction|c'est pas|ce n'est pas)/.test(contentLower);
  const isFact = /(retiens|apprends|mémorise|note que|fait que|sache que|retient bien)/.test(contentLower);

  // 4. Prompt système avec souvenirs injectés
  const systemPrompt = buildSystemPrompt(contextMemories, isCorrection, isFact, config.ai.systemPrompt);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...shortTermHistory.slice(-10),
    { role: 'user', content: message.content },
  ];

  // 5. Génération via OpenRouter
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: config.ai.maxTokens,
    temperature: config.ai.temperature,
  });
  const response = completion.choices[0].message.content;

  // 6. Stockage mémoire longue (apprentissage continu)
  if (config.memory.enabled) {
    await store({
      content: `User: ${message.content}\nBot: ${response}`,
      metadata: {
        type: isCorrection ? 'correction' : (isFact ? 'fact' : 'conversation'),
        guildId: message.guildId || 'dm',
        channelId: message.channelId,
        userId: message.author.id,
        weight: isCorrection ? 2.0 : (isFact ? 1.5 : 1.0),
      },
    });
  }

  return response;
}
