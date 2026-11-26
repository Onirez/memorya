import 'dotenv/config';
import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { generateResponse } from './src/rag.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const shortTermMemory = new Map(); // key -> [{role, content}]
const cooldowns = new Map();

function getKey(msg) {
  return msg.guildId ? `${msg.guildId}-${msg.channelId}-${msg.author.id}` : `dm-${msg.author.id}`;
}

function getHistory(key) {
  return shortTermMemory.get(key) || [];
}

function addHistory(key, role, content) {
  const h = getHistory(key);
  h.push({ role, content });
  if (h.length > 20) h.splice(0, h.length - 20);
  shortTermMemory.set(key, h);
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Connecté: ${c.user.tag} (ID: ${c.user.id})`);
  console.log(`✅ Serveurs: ${c.guilds.cache.size}`);
  c.user.setActivity('je m\'améliore en continu 🧠', { type: ActivityType.Watching });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.author.id === client.user.id) return;

  // Déclenchement : mention, DM, ou réponse au bot
  const shouldReply =
    message.mentions.has(client.user) ||
    !message.guildId ||
    (message.reference && message.reference.messageId);

  if (!shouldReply) return;

  // Cooldown anti-spam
  const now = Date.now();
  if (cooldowns.get(message.author.id) && now - cooldowns.get(message.author.id) < 2000) return;
  cooldowns.set(message.author.id, now);

  await message.channel.sendTyping();

  const key = getKey(message);
  const history = getHistory(key);

  try {
    const response = await generateResponse(message, history);
    addHistory(key, 'user', message.content);
    addHistory(key, 'assistant', response);

    const replyOpts = (message.mentions.has(client.user) || message.reference || !message.guildId)
      ? { reply: { messageReference: message.id, failIfNotExists: false } }
      : {};

    await message.reply({ content: response, ...replyOpts });
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    await message.reply('🤖 Coup de fatigue, réessaie plus tard.');
  }
});

process.on('unhandledRejection', (e) => console.error('💥 Unhandled:', e));
process.on('uncaughtException', (e) => console.error('💥 Uncaught:', e));

client.login(process.env.DISCORD_TOKEN);
