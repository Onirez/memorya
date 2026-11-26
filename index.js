import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import OpenAI from 'openai';

// Lecture du config sans import assertion (compatible Node 18 → 24)
const config = JSON.parse(
  readFileSync(new URL('./config.json', import.meta.url), 'utf8')
);

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans les variables Railway');
  process.exit(1);
}
if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY manquant dans les variables Railway');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': config.openrouter.siteUrl || 'https://github.com',
    'X-Title': config.openrouter.appName || 'DiscordBot',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || config.ai.model;

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Connecté: ${c.user.tag} (ID: ${c.user.id})`);
  console.log(`✅ Serveurs: ${c.guilds.cache.size}`);
  c.user.setActivity('je réponds à chaque fois 🤖', { type: ActivityType.Watching });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.author.id === client.user.id) return;

  // Répond à chaque fois : mention, DM, ou réponse au bot
  const shouldReply =
    message.mentions.has(client.user) ||
    !message.guildId ||
    (message.reference && message.reference.messageId);

  if (!shouldReply) return;

  await message.channel.sendTyping();

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: config.ai.systemPrompt },
        { role: 'user', content: message.content },
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    });

    const response = completion.choices[0].message.content;
    await message.reply({ content: response });
  } catch (err) {
    console.error('❌ Erreur OpenRouter:', err.message);
    await message.reply('🤖 Je suis surchargé, réessaie dans un instant.');
  }
});

process.on('unhandledRejection', (e) => console.error('💥 Unhandled:', e));
process.on('uncaughtException', (e) => console.error('💥 Uncaught:', e));

client.login(process.env.DISCORD_TOKEN);
