import http from 'http';
const server = http.createServer((req, res) => res.end('OK'));
server.listen(process.env.PORT || 3000);

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.json' assert { type: 'json' };

import { initVectorMemory } from './src/memory/vectorStore.js';
import { handleMessage } from './src/events/messageCreate.js';
import { registerCommands } from './src/commands/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Stockage mémoire court terme (Map simple)
const shortTermMemory = new Map();
const cooldowns = new Map();

function getMemoryKey(msg) {
  return msg.guildId ? `${msg.guildId}-${msg.channelId}-${msg.author.id}` : `dm-${msg.author.id}`;
}

function getHistory(key) { return shortTermMemory.get(key) || []; }
function addHistory(key, role, content) {
  const h = getHistory(key);
  h.push({ role, content });
  if (h.length > config.bot.maxHistory) h.splice(0, h.length - config.bot.maxHistory);
  shortTermMemory.set(key, h);
}

// ===== EVENTS =====
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Connecté: ${c.user.tag}`);
  c.user.setActivity(config.bot.status, { type: ActivityType.Watching });
  await initVectorMemory(); // Connexion Qdrant
  await registerCommands(c); // Slash commands
});

client.on(Events.MessageCreate, async (message) => {
  await handleMessage(message, client, config, getHistory, addHistory, cooldowns, getMemoryKey);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;
  if (commandName === 'clear') {
    shortTermMemory.delete(getMemoryKey(interaction));
    return interaction.reply({ content: '🧹 Mémoire court terme effacée.', ephemeral: true });
  }
  if (commandName === 'stats') {
    const { getStats } = await import('./src/memory/vectorStore.js');
    const stats = await getStats();
    return interaction.reply({ content: `📊 Vecteurs: ${stats.points}`, ephemeral: true });
  }
});

// Error handling
process.on('unhandledRejection', e => console.error('💥 Unhandled:', e));
process.on('uncaughtException', e => console.error('💥 Uncaught:', e));

// Login
client.login(process.env.DISCORD_TOKEN);