const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

// Create SQLite DB for tracking exiles
const db = new sqlite3.Database('./exiles.db');
db.run(`CREATE TABLE IF NOT EXISTS exile_counts (
  user_id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0
)`);

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
  ],
});

const ROLE_IDS = {
  exiled: '1208808796890337350',
  swaggers: '1202948499193335828',
  uncle: '1351986650754056354',
  mod: '1353414310499455027',
  admin: '1351985637602885734',
};

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
  '1197176029815517257',
];

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Exiling buddies.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === '-help') {
    const helpMessage = `
**Bot Commands:**
- \`-exile @user\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-myexiles\` : See your exile count (mods/admins only)
- \`-leaderboard\` : See the exile leaderboard
- \`-help\` : Show this help message
    `;
    message.channel.send(helpMessage);
  }

  if (command === '-exile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("you aint exiling anyone buddy.");
    }

    const target = message.mentions.members.first();
    if (!target) return message.reply('Mention someone to exile.');

    if (target.roles.cache.has(ROLE_IDS.exiled)) {
      return message.reply(`${target.user.tag} is already exiled.`);
    }

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);

      db.run(
        `INSERT INTO exile_counts (user_id, count) VALUES (?, 1)
         ON CONFLICT(user_id) DO UPDATE SET count = count + 1`,
        [target.id]
      );

      message.channel.send(`${target.user.tag} has been exiled.`);
    } catch (err) {
      console.error(err);
      message.reply('Could not exile user.');
    }
  }

  if (command === '-unexile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply('nice try buddy');
    }

    const target = message.mentions.members.first();
    if (!target) return message.reply('Mention someone to unexile.');

    if (!target.roles.cache.has(ROLE_IDS.exiled)) {
      return message.reply(`${target.user.tag} is not exiled.`);
    }

    try {
      await target.roles.remove(ROLE_IDS.exiled);
      if (SPECIAL_MEMBERS.includes(target.id)) {
        await target.roles.add(ROLE_IDS.uncle);
        message.channel.send(`${target.user.tag} the unc has been unexiled.`);
      } else {
        message.channel.send(`${target.user.tag} has been unexiled.`);
      }
    } catch (err) {
      console.error(err);
      message.reply('Could not unexile user.');
    }
  }

  if (command === '-myexiles') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply('buddy you are not a moderator. slow down 😅😅😅');
    }

    const userId = message.mentions.users.first()?.id || message.author.id;

    db.get(`SELECT count FROM exile_counts WHERE user_id = ?`, [userId], (err, row) => {
      if (err) {
        console.error(err);
        return message.reply('Error retrieving data.');
      }
      const count = row?.count || 0;
      message.reply(`<@${userId}> has been exiled **${count}** times.`);
    });
  }

  if (command === '-leaderboard') {
    db.all(`SELECT user_id, count FROM exile_counts ORDER BY count DESC LIMIT 10`, [], (err, rows) => {
      if (err) {
        console.error(err);
        return message.reply('Error loading leaderboard.');
      }
      if (!rows.length) return message.reply('No exiles recorded yet.');

      const leaderboard = rows
        .map((row, index) => `**${index + 1}.** <@${row.user_id}> — ${row.count} times`)
        .join('\n');
      message.channel.send(`** Exile Leaderboard <:crying:1285606636853137560> **\n${leaderboard}`);
    });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);