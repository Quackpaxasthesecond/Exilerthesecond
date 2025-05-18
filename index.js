const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const http = require('http');

// HTTP server for uptime monitoring
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

// SQLite DB
const db = new sqlite3.Database('./exiles.db', (err) => {
  if (err) console.error(err);
  else console.log('Connected to SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS exiles (
  issuer TEXT NOT NULL,
  target TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

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
    const helpMessage = `
**Bot Commands:**
- \`-exile @user\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-myexiles\` : Show how many people you exiled (mods/admins only)
- \`-leaderboard\` : Show the top exiled users
- \`-fat\` : Randomly calls someone fat
    `;
    return message.channel.send(helpMessage);
  }

  if (command === '-exile') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("you aint exiling anyone buddy bro.");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to exile.');
    if (target.user.bot) return message.reply("you can't exile a bot. even if it's huge.");
    if (target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.tag} is already exiled!`);

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);
      message.channel.send(`${target.user.tag} has been exiled.`);

      // Record exile in the database
      db.run(
        `INSERT INTO exiles (issuer, target) VALUES (?, ?)`,
        [message.author.id, target.id],
        (err) => {
          if (err) console.error(err);
        }
      );
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while trying to unexile the user.');
    }
  }

  if (command === '-myexiles') {
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("buddy you are not a moderator. slow down 😅😅😅");
    }

    db.get(`SELECT COUNT(*) as count FROM exiles WHERE issuer = ?`, [message.author.id], (err, row) => {
      if (err) {
        console.error(err);
        return message.reply('Error checking your exile record.');
      }
      const count = row ? row.count : 0;
      message.reply(`you've murdered ${count} people.`);
    });
  }

  if (command === '-leaderboard') {
    db.all(
      `SELECT target, COUNT(*) as exile_count FROM exiles GROUP BY target ORDER BY exile_count DESC LIMIT 10`,
      [],
      (err, rows) => {
        if (err) {
          console.error(err);
          return message.channel.send('An error occurred while fetching the leaderboard.');
        }

        if (rows.length === 0) {
          return message.channel.send('No exiles have been recorded yet.');
        }

        const leaderboard = rows
          .map((row, index) => `${index + 1}. <@${row.target}> - ${row.exile_count} exiles`)
          .join('\n');

        message.channel.send(`**Exile Leaderboard <:crying:1285606636853137560>**:\n${leaderboard}`);
      }
    );
  }

  if (command === '-fat') {
    const members = await message.guild.members.fetch();
    const filtered = members.filter(m => !m.user.bot && m.id !== message.author.id);
    if (filtered.size === 0) return message.reply("you will die....");

    const randomMember = filtered.random();
    const roasts = [
      `${randomMember} is fat and huge.`,
      `${randomMember} weighs 700 pounds.`,
      `${randomMember} is huge in mass.`,
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    message.channel.send(roast);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});