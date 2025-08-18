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

// Apply defaults: make all commands (except -hi) use public slash replies and
// avoid posting to the channel for slash invocations. This central change
// prevents editing every individual file.
commands.forEach((cmd, name) => {
  if (name === 'hi') return; // keep -hi prefix-only and unchanged
  // set defaults if not explicitly provided
  if (cmd.publicSlash === undefined) cmd.publicSlash = true;
  if (cmd.postToChannel === undefined) cmd.postToChannel = false;
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

// Guard to prevent processing the same interaction twice
const processedInteractions = new Set();

// --- Event Handlers ---
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Exiling buddies.');
});

// --- Slash Command Handler (safe adapter) ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd || !cmd.slash) return;

  // Skip duplicate processing of the same interaction id
  if (processedInteractions.has(interaction.id)) {
    console.log(`[slash] duplicate interaction ignored: ${interaction.id} ${interaction.commandName}`);
    return;
  }
  processedInteractions.add(interaction.id);
  // cleanup after 30s
  setTimeout(() => processedInteractions.delete(interaction.id), 30 * 1000);

  // Build args and find first USER option (if any)
  const args = [];
  let firstUserId = null;
  for (const opt of interaction.options.data) {
    if (opt.type === 6) {
      firstUserId = opt.value;
      args.push(`<@${opt.value}>`);
    } else {
      args.push(String(opt.value));
    }
  }

  // Defer according to command preference: by default defer ephemeral (only visible
  // to the invoker). Commands can set `publicSlash: true` to request a public
  // deferred reply. Commands can also set `postToChannel: false` to avoid creating
  // a channel message and instead edit the deferred reply.
  const ephemeralDefer = cmd && cmd.publicSlash === true ? false : true;
  try { await interaction.deferReply({ ephemeral: ephemeralDefer }); } catch (e) { /* ignore */ }

  // Pre-fetch the referenced user and member so message-style commands that do
  // synchronous `message.mentions.members.first()` keep working.
  let fetchedUser = null;
  let fetchedMember = null;
  if (firstUserId) {
    try { fetchedUser = await interaction.client.users.fetch(firstUserId); } catch (e) { fetchedUser = null; }
    if (interaction.guild) {
      try { fetchedMember = await interaction.guild.members.fetch(firstUserId); } catch (e) { fetchedMember = null; }
    }
  }

  const commonContext = {
    db, timers, client, checkCooldown, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, confirmAction,
    hiStreaks, HI_STREAK_RESET, hiDuels, hiState, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, gambleCooldowns,
    hiZone: global.hiZone || (global.hiZone = {})
  };

  // Capture original channel helpers so we don't overwrite them
  const originalChannel = interaction.channel;
  const originalChannelSend = originalChannel && originalChannel.send ? originalChannel.send.bind(originalChannel) : null;
  const originalAwaitMessages = originalChannel && originalChannel.awaitMessages ? originalChannel.awaitMessages.bind(originalChannel) : null;

  // Mark whether adapter already posted to channel for this interaction
  interaction._adapterPosted = false;

  // Wrap interaction.reply/followUp so commands that call them directly after the
  // adapter has posted to channel don't create duplicate public messages. If the
  // adapter posted, convert replies to ephemeral followUps (only visible to invoker).
  const origInteractionReply = interaction.reply ? interaction.reply.bind(interaction) : null;
  const origInteractionFollowUp = interaction.followUp ? interaction.followUp.bind(interaction) : null;
  interaction.reply = async (payload) => {
    try {
      if (interaction._adapterPosted) {
        if (origInteractionFollowUp) return await origInteractionFollowUp(Object.assign({}, typeof payload === 'string' ? { content: payload } : payload, { ephemeral: true }));
        return;
      }
      if (origInteractionReply) return await origInteractionReply(payload);
    } catch (e) {/* ignore */}
  };
  interaction.followUp = async (payload) => {
    try {
      if (interaction._adapterPosted) {
        if (origInteractionFollowUp) return await origInteractionFollowUp(Object.assign({}, typeof payload === 'string' ? { content: payload } : payload, { ephemeral: true }));
        return;
      }
      if (origInteractionFollowUp) return await origInteractionFollowUp(payload);
    } catch (e) {/* ignore */}
  };

  // Determine whether this command prefers posting to channel or wants to
  // avoid channel posts (and instead use the deferred reply). Default is to
  // post to channel.
  const preferChannelPost = !(cmd && cmd.postToChannel === false);

  // Create a message-like adapter that routes replies to the interaction and
  // channel sends to the real channel while acknowledging the interaction.
  const messageLike = {
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    // mark this as created from an interaction
    _isFromInteraction: true,
    _cmd: cmd,
    // Provide a lightweight channel wrapper so we don't mutate Discord's Channel
    channel: {
      id: originalChannel ? originalChannel.id : null,
      send: async (...p) => {
        if (!originalChannelSend) throw new Error('No channel send available');
        interaction._adapterPosted = true;
        return originalChannelSend(...p);
      },
      awaitMessages: originalAwaitMessages,
    },
    mentions: {
      members: { first: () => fetchedMember },
      users: { first: () => fetchedUser }
    },
    content: `/${interaction.commandName} ${args.join(' ')}`,
  reply: async (payload) => {
      try {
        const data = typeof payload === 'string' ? { content: payload } : payload;
        // If this command prefers NOT to post to the channel, edit the deferred
        // reply instead (which will be public when `publicSlash: true`). This
        // avoids creating a channel message that could duplicate elsewhere.
        if (!preferChannelPost) {
          try {
            if (interaction.deferred || interaction.replied) {
              return await interaction.editReply(data);
            }
            return await interaction.reply(data);
          } catch (e) {
            try { return await interaction.followUp(data); } catch (ee) { /* ignore */ }
          }
        }

        // Otherwise prefer posting to the channel and then editing the deferred
        // reply with an acknowledgement/link so the invoker sees the result.
        if (originalChannelSend) {
          const sent = await originalChannelSend(typeof payload === 'string' ? payload : payload);
          interaction._adapterPosted = true;
          try {
            if (sent && interaction.guild && sent.id) {
              const link = `https://discord.com/channels/${interaction.guild.id}/${originalChannel.id}/${sent.id}`;
              await interaction.editReply({ content: `Posted: ${link}` }).catch(() => {});
            } else {
              await interaction.editReply({ content: 'Posted to channel.' }).catch(() => {});
            }
          } catch (e) { /* ignore edit errors */ }
          return sent;
        }

        // Fallback to interaction reply if no channel send available
        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(Object.assign({}, data, { ephemeral: false }));
        }
        return interaction.reply(Object.assign({}, data, { ephemeral: false }));
      } catch (e) {
        try { return messageLike.channel.send(typeof payload === 'string' ? payload : payload); } catch (ee) { return null; }
      }
    }
  };

  // Wrap channel.send so channel messages still go to the channel, and the
  // interaction reply is edited with an acknowledgement to avoid silence.
    if (interaction.channel && typeof interaction.channel.send === 'function') {
    messageLike.channel.send = async (payload) => {
      interaction._adapterPosted = true;
      const sent = await originalChannelSend(typeof payload === 'string' ? payload : payload);
      // If the sent message contains embeds or content, mirror them into the interaction reply so
      // the user who used the slash command sees the same embed publicly.
      try {
        const payloadToEdit = {};
        if (sent && sent.content) payloadToEdit.content = sent.content;
        if (sent && sent.embeds && sent.embeds.length) payloadToEdit.embeds = sent.embeds.map(e => e);
        // If we have something to show, edit the deferred reply to include it.
          if (Object.keys(payloadToEdit).length > 0) {
          // Ensure we don't exceed content limits
          if (payloadToEdit.content && payloadToEdit.content.length > 1900) payloadToEdit.content = payloadToEdit.content.slice(0, 1900) + '...';
          await interaction.editReply(payloadToEdit);
        }
      } catch (e) {
        // ignore edit errors
      }
      return sent;
    };
  }

  // Execute command: prefer message-style call for compatibility; fall back to
  // interaction-style if the command expects it.
  try {
    await cmd.execute(messageLike, args, commonContext);
  } catch (err) {
    try {
      await cmd.execute(interaction, interaction.options, commonContext);
    } catch (err2) {
      console.error('Slash command error:', err2);
      try { await interaction.editReply({ content: 'There was an error executing this command.' }); } catch (e) { try { await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true }); } catch (ee) {} }
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Wrap message.reply to avoid pinging the user by default when prefix commands reply.
  if (!message._replyWrapped) {
    const origReply = message.reply.bind(message);
    message.reply = async (contentOrOptions) => {
      // If caller passed explicit allowedMentions, respect it. Otherwise disable repliedUser.
      if (contentOrOptions && typeof contentOrOptions === 'object' && contentOrOptions.allowedMentions) {
        return origReply(contentOrOptions);
      }
      if (typeof contentOrOptions === 'string') {
        return origReply({ content: contentOrOptions, allowedMentions: { repliedUser: false } });
      }
      // object payload
      return origReply(Object.assign({}, contentOrOptions || {}, { allowedMentions: Object.assign({}, contentOrOptions?.allowedMentions || {}, { repliedUser: false }) }));
    };
    message._replyWrapped = true;
  }

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
  // Only treat messages starting with the '-' prefix as bot commands
  if (command.startsWith('-')) {
    const cmdName = command.slice(1);
    if (commands.has(cmdName)) {
      const cmd = commands.get(cmdName);
      cmd.execute(message, args, {
        db, timers, client, checkCooldown, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, confirmAction,
        hiStreaks, HI_STREAK_RESET, hiDuels, hiState, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, gambleCooldowns,
        hiZone: global.hiZone || (global.hiZone = {}) // pass hiZone state for HI ZONE
      });
      return;
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});