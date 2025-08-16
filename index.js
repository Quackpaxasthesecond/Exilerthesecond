const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: PgClient } = require('pg');
require('dotenv').config();
const http = require('http');
const roasts = require('./roasts');
const hiExileMessages = require('./hiExileMessages');

// --- Constants ---
const ROLE_IDS = {
  exiled: '1208808796890337350',
  swaggers: '1202948499193335828',
  uncle: '1351986650754056354',
  mod: '1353414310499455027',
  admin: '1351985637602885734',
  hi_crown: '1379180965481676830', // Top -hi used role
};
const SPECIAL_MEMBERS = [
  '1346764665593659393', '1234493339638825054', '1149822228620382248',
  '696258636602802226', '512964486148390922', '1010180074990993429',
  '464567511615143962', '977923308387455066', '800291423933038612',
  '872408669151690755', '1197176029815517257', '832354579890569226',
];
const SWAGGER_MEMBERS = [
 '696258636602802226', '832354579890569226', '699154992891953215',
 '135160203149705216', '1025984312727842846', '800291423933038612',
];

// --- Command Loader ---
const commands = new Map();
fs.readdirSync('./commands').filter(f => f.endsWith('.js')).forEach(file => {
  const command = require(`./commands/${file}`);
  commands.set(command.name, command);
});

// --- HTTP Server for Uptime ---
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
}).listen(3000, '0.0.0.0', () => {
  console.log('HTTP server ready on port 3000');
});

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Slash Command Registration ---
const { REST, Routes } = require('discord.js');
const slashCommands = [];
commands.forEach((cmd, name) => {
  if (cmd.slash) {
    slashCommands.push({
      name: cmd.name,
      description: cmd.description || 'No description provided',
      options: cmd.options || [],
    });
  }
});

async function registerSlashCommands() {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) return;
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: slashCommands }
    );
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

registerSlashCommands();

// --- Database Setup ---
const db = new PgClient({ connectionString: process.env.POSTGRES_URL });
db.connect().then(() => console.log('Connected to PostgreSQL database.')).catch(err => console.error('Postgres connection error:', err));
db.query(`
  CREATE TABLE IF NOT EXISTS exiles (
    id SERIAL PRIMARY KEY,
    issuer TEXT NOT NULL,
    target TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error(err));
db.query(`
  CREATE TABLE IF NOT EXISTS hi_usages (
    user_id TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  );
`).catch(err => console.error(err));
db.query(`
  CREATE TABLE IF NOT EXISTS hi_givers (
    id SERIAL PRIMARY KEY,
    giver TEXT NOT NULL,
    receiver TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error(err));
db.query(`
  CREATE TABLE IF NOT EXISTS hi_streaks (
    user_id TEXT PRIMARY KEY,
    streak INTEGER DEFAULT 0,
    last TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error(err));
db.query(`
  CREATE TABLE IF NOT EXISTS hi_chains (
    guild_id TEXT PRIMARY KEY,
    chain_count INTEGER DEFAULT 0,
    chain_record INTEGER DEFAULT 0,
    last_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error(err));

// --- Utility ---
const timers = new Map();
const cooldowns = new Map();
const gambleCooldowns = new Map();

function checkCooldown(userId, command, message, member) {
  // No cooldown for mods/admins/owner
  if (
    member &&
    (member.roles.cache.has(ROLE_IDS.mod) ||
     member.roles.cache.has(ROLE_IDS.admin) ||
     (member.guild && member.guild.ownerId === member.id))
  ) {
    return false;
  }
  const now = Date.now();
  const key = `${userId}:${command}`;
  if (cooldowns.has(key) && now - cooldowns.get(key) < 3000) {
    // --- Hi Cooldown Message ---
    if (command === '-hi') {
      const embed = new EmbedBuilder()
        .setTitle('Whoa there, buddy!')
        .setDescription('You are too fast for the hi gods. Try again in a sec! 🐢')
        .setColor(0xffc300);
      message.channel.send({ embeds: [embed] });
    } else {
      message.reply('Slow down!');
    }
    return true;
  }
  cooldowns.set(key, now);
  return false;
}

async function confirmAction(message, promptText) {
  const filter = m => m.author.id === message.author.id;
  await message.channel.send(promptText);
  try {
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
    const response = collected.first().content.toLowerCase();
    return response === 'yes' || response === 'confirm';
  } catch {
    return false;
  }
}

// --- Hi Command State ---
const hiState = {
  lastUser: null,
  streak: 0,
  lastTimestamp: 0,
  chainCount: 0,
  chainRecord: 0,
  comboUsers: [],
  comboTimeout: null,
  duel: null, // {challengerId, opponentId, active}
};
const HI_COMBO_WINDOW = 10000; // 10 seconds
const HI_CHAIN_WINDOW = 5000; // 5 seconds
const HI_POWERUP_ROLE = 'hi-powerup'; // You can create this role in your server
const FUNNY_EMOJIS = [
  '<:lol:1362820974625423470>',
  '<:help:1376872600935858263>',
  '<:bricked:1373295644948561942>',
  '<:silence:1182339569874636841>',
  '<:ravage:1240078946251309087>',
  '<:emoji_79:1292407706358911017>',
  '<:zawg:1252687349838512179>'
];

// --- Hi Streaks State ---
const hiStreaks = {};
const HI_STREAK_RESET = 6 * 60 * 60 * 1000; // 6 hours in ms

// --- Hi Duel State ---
const hiDuels = {};
// hiDuels: { [guildId]: { challengerId, opponentId, accepted, startTime, endTime, scores: { [userId]: count } } }

// --- Event Handlers ---
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Exiling buddies.');
});

// --- Slash Command Handler (adapter for existing message-based commands) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd || !cmd.slash) return;

  const commonContext = {
    db, timers, client, checkCooldown, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, confirmAction,
    hiStreaks, HI_STREAK_RESET, hiDuels, hiState, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, gambleCooldowns,
    hiZone: global.hiZone || (global.hiZone = {})
  };

  // Build args array and capture first user mention (if any)
  const args = [];
  let firstMentionId = null;
  for (const opt of interaction.options.data) {
    // For USER options, opt.value is the user id
    if (opt.type === 6) {
      firstMentionId = opt.value;
      args.push(`<@${opt.value}>`);
    } else {
      args.push(String(opt.value));
    }
  }

  // Create a message-like adapter so existing command code keeps working
  const messageLike = {
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
    // Build a simple mentions helper used by many commands
    mentions: {
      members: {
        first: () => {
          if (!firstMentionId || !interaction.guild) return null;
          return interaction.guild.members.cache.get(firstMentionId) || null;
        }
      },
      users: {
        first: () => {
          if (!firstMentionId) return null;
          return interaction.client.users.cache.get(firstMentionId) || null;
        }
      }
    },
    // Provide content for potential uses
    content: `/${interaction.commandName} ${args.join(' ')}`,
    // reply should delegate to interaction reply/followUp
    reply: async (payload) => {
      try {
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply(typeof payload === 'string' ? { content: payload } : payload);
        }
        return interaction.followUp(typeof payload === 'string' ? { content: payload } : payload);
      } catch (err) {
        // last-resort: send in channel
        return interaction.channel.send(typeof payload === 'string' ? payload : (payload.content || JSON.stringify(payload)));
      }
    }
  };

  // Ensure channel.send and awaitMessages (used by confirmAction) are available
  if (interaction.channel && typeof interaction.channel.send === 'function') {
    messageLike.channel.send = interaction.channel.send.bind(interaction.channel);
  }

  try {
    // Prefer calling the command as message-based for backwards compatibility
    await cmd.execute(messageLike, args, commonContext);
  } catch (errMsgStyle) {
    // If that fails, try calling the command with interaction-style signature
    try {
      await cmd.execute(interaction, interaction.options, commonContext);
    } catch (err) {
      console.error('Slash command execution failed (both message-style and interaction-style):', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
      }
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- Block -hi and related commands in specific channel ---
  const HI_BLOCKED_CHANNEL = '1208809645205094481';
  const HI_COMMANDS = [
    '-hi', '-hileaderboard', '-hiduel', '-acceptduel', '-checkhistreaks', '-streakleader'
  ];
  const msgContent = message.content.trim().split(/ +/);
  const msgCommand = msgContent[0]?.toLowerCase();
  if (message.channel.id === HI_BLOCKED_CHANNEL && HI_COMMANDS.includes(msgCommand)) {
    return message.reply('The commands are disabled in this channel.');
  }

  // Now parse args/command as before
  const args = msgContent;
  const command = args.shift().toLowerCase();

  // --- Modular Commands ---
  if (commands.has(command.slice(1))) {
    const cmd = commands.get(command.slice(1));
    cmd.execute(message, args, {
      db, timers, client, checkCooldown, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, confirmAction,
      hiStreaks, HI_STREAK_RESET, hiDuels, hiState, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, gambleCooldowns,
      hiZone: global.hiZone || (global.hiZone = {}) // pass hiZone state for HI ZONE
    });
    return;
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});