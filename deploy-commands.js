import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './src/commands/chat.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Deploy global commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Done!');
  } catch (e) { console.error(e); }
})();