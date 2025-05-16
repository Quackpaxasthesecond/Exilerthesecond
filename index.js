const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const http = require('http');

// Create HTTP server for uptime monitoring
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
});
server.listen(3000, '0.0.0.0', () => {
  console.log('HTTP server ready on port 3000');
});

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

// List of special member IDs who get uncle role back when unexiled
const SPECIAL_MEMBERS = [
  '1346764665593659393',
  '1234493339638825054',
  '1149822228620382248',
  '1123873768507457536',
  '696258636602802226',
  '512964486148390922',
  '1010180074990993429',
  '464567511615143962',
  '977923308387455066',
  '800291423933038612',
  '872408669151690755',
  '1197176029815517257'
];

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Bot is in these servers:');
  client.guilds.cache.forEach(guild => {
    console.log(`- ${guild.name} (${guild.id})`);
    console.log('  Bot permissions:', guild.members.me.permissions.toArray());
  });
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
      return message.reply("Bih you aint moderator");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('can you fucking put a vaild user god');
    }

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);
      message.channel.send(`${target.user.tag} shot dead`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while trying to exile the user.');
    }
  }

  // Unexile Command with special role restoration
  if (command === '-unexile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("you aint helping nun");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('can you fucking put a vaild user god');
    }

    try {
      await target.roles.remove(ROLE_IDS.exiled);

      if (SPECIAL_MEMBERS.includes(target.id)) {
        await target.roles.add(ROLE_IDS.uncle);
        message.channel.send(`${target.user.tag} the unc has been unexiled`);
      } else {
        message.channel.send(`${target.user.tag} has been unexiled.`);
      }

    } catch (error) {
      console.error(error);
      message.reply('An error occurred while trying to unexile the user.');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
  console.error('Failed to login:', error.message);
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables');
  }
});
