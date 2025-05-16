const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildScheduledEvents,
  ],
});

const ROLE_IDS = {
  exiled: '1208808796890337350',
  swaggers: '1202948499193335828',
  uncle: '1351986650754056354',
  mod: '1353414310499455027',
  admin: '1351985637602885734',
};

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Exile Command
  if (command === '-exile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("You don't have permission to use this command.");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('Please mention a valid user to exile.');
    }

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);
      message.channel.send(`${target.user.tag} has been exiled.`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while trying to exile the user.');
    }
  }

  // Unexile Command
  if (command === '-unexile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("You don't have permission to use this command.");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('Please mention a valid user to unexile.');
    }

    try {
      await target.roles.remove(ROLE_IDS.exiled);
      await target.roles.add(ROLE_IDS.uncle);
      message.channel.send(`${target.user.tag} has been unexiled.`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while trying to unexile the user.');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);