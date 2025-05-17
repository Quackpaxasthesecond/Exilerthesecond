const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const http = require('http');
const sqlite3 = require('sqlite3').verbose();

// SQLite DB setup
const db = new sqlite3.Database('./exiles.db', (err) => {
  if (err) return console.error('DB Error:', err.message);
  console.log('Connected to SQLite DB.');
});
db.run(`CREATE TABLE IF NOT EXISTS exiles (
  user_id TEXT PRIMARY KEY,
  count INTEGER
)`);

// HTTP server for uptime pinging
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
  '1346764665593659393', '1234493339638825054', '1149822228620382248',
  '1123873768507457536', '696258636602802226', '512964486148390922',
  '1010180074990993429', '464567511615143962', '977923308387455066',
  '800291423933038612', '872408669151690755', '1197176029815517257',
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
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("<:silence:1182339569874636841>");

    return message.channel.send(`
**Bot Commands:**
- \`-exile @user\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-exileboard\` : View exile leaderboard
- \`-help\` : Show this help message (mods/admins only)
    `);
  }

  if (command === '-exile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("you aint exiling anyone buddy bro. <:silence:1182339569874636841>");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to exile.');
    if (target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.tag} is already exiled!`);

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);

      // Update exile count
      db.run(`INSERT INTO exiles (user_id, count)
              VALUES (?, 1)
              ON CONFLICT(user_id) DO UPDATE SET count = count + 1`, [target.id]);

      message.channel.send(`${target.user.tag} has been exiled.`);
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while trying to exile the user.');
    }
  }

  if (command === '-unexile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("nice try buddy");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to unexile.');
    if (!target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.tag} is not exiled!`);

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

  if (command === '-exileboard') {
    db.all(`SELECT user_id, count FROM exiles ORDER BY count DESC LIMIT 10`, async (err, rows) => {
      if (err) {
        console.error(err);
        return message.channel.send('Failed to fetch leaderboard.');
      }

      if (!rows.length) return message.channel.send('No exiles have occurred yet.');

      const leaderboard = await Promise.all(rows.map(async (row, index) => {
        const user = await client.users.fetch(row.user_id).catch(() => null);
        const name = user ? user.tag : `Unknown (${row.user_id})`;
        return `**#${index + 1}** - ${name} — ${row.count} exile(s)`;
      }));

      message.channel.send(`📜 **Exile Leaderboard** 📜\n${leaderboard.join('\n')}`);
    });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);