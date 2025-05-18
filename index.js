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

const cooldowns = new Map();

function checkCooldown(userId, command, message) {
  const key = `${userId}_${command}`;
  const now = Date.now();
  const cooldown = cooldowns.get(key);
  if (cooldown && now - cooldown < 5000) {
    message.reply('slow down buddy. you are clicking too fast.');
    return true;
  }
  cooldowns.set(key, now);
  return false;
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Exiling buddies.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === '-help') {
    if (checkCooldown(message.author.id, command, message)) return;
    const helpMessage = `
**Bot Commands:**
- \`-exile @user\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-myexiles\` : Show how many people you exiled (mods/admins only)
- \`-leaderboard\` : Show the top exiled users
- \`-hi\` : random stuffs :3
    `;
    return message.channel.send(helpMessage);
  }

  if (command === '-exile') {
    if (checkCooldown(message.author.id, command, message)) return;

    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("you aint exiling anyone buddy bro.");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to exile.');
    if (target.user.bot) return; // Silently ignore bot exile attempt
    if (target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.username} is already exiled!`);

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);
      message.channel.send(`${target.user.username} has been exiled.`);

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
    if (checkCooldown(message.author.id, command, message)) return;

    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("nice try buddy");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to unexile.');
    if (!target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.username} is not exiled!`);

    try {
      await target.roles.remove(ROLE_IDS.exiled);
      if (SPECIAL_MEMBERS.includes(target.id)) {
        await target.roles.add(ROLE_IDS.uncle);
        message.channel.send(`${target.user.username} the unc has been unexiled`);
      } else {
        message.channel.send(`${target.user.username} has been unexiled.`);
      }
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while trying to unexile the user.');
    }
  }

  if (command === '-myexiles') {
    if (checkCooldown(message.author.id, command, message)) return;

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
    if (checkCooldown(message.author.id, command, message)) return;

    db.all(
      `SELECT target, COUNT(*) as exile_count FROM exiles GROUP BY target ORDER BY exile_count DESC LIMIT 10`,
      [],
      async (err, rows) => {
        if (err) {
          console.error(err);
          return message.channel.send('An error occurred while fetching the leaderboard.');
        }

        if (rows.length === 0) {
          return message.channel.send('No exiles have been recorded yet.');
        }

        let leaderboard = '**Exile Leaderboard <:crying:1285606636853137560>**:\n';

        for (let i = 0; i < rows.length; i++) {
          const member = await message.guild.members.fetch(rows[i].target).catch(() => null);
          const name = member ? member.user.username : `Unknown (${rows[i].target})`;
          leaderboard += `${i + 1}. ${name} - ${rows[i].exile_count} exiles\n`;
        }

        message.channel.send(leaderboard);
      }
    );
  }

  if (command === '-hi') {
    if (checkCooldown(message.author.id, command, message)) return;

    const members = await message.guild.members.fetch();
    const filtered = members.filter(m => !m.user.bot && m.id !== message.author.id);
    if (filtered.size === 0) return message.reply("you will die....");

    const randomMember = filtered.random();
    const roasts = [
      `${randomMember.user.username} is fat and huge.`,
      `${randomMember.user.username} weighs 700 pounds.`,
      `${randomMember.user.username} is huge in mass.`,
      `${randomMember.user.username} Is big and round`,
      `${randomMember.user.username} has their own center of mass`,
      `${randomMember.user.username} is morbidly a beast`,
      `${randomMember.user.username}'s pronouns are lbs/kg/tons.`,
      `${randomMember.user.username} is usagi.`,
      `${randomMember.user.username} will eventually turn into a star with their mass`,
      `${randomMember.user.username} has their own gravitational force`,
      `${randomMember.user.username} is huge in mass.`,
      `${randomMember.user.username} has an orbit around them`,
      `${randomMember.user.username} is Fat Bald Friend.`,
      `https://cdn.discordapp.com/attachments/992551367187120243/1315406613019885638/flop.gif?ex=682ae41f&is=6829929f&hm=d02718a4dda13dd2d67c98da5d41cd7f741c1b08d18f5a5cbef30de159747754&`,
      `https://cdn.discordapp.com/attachments/1331265060089106482/1366888527291355176/ezgif-4a5d7dd059300a.gif?ex=682af964&is=6829a7e4&hm=94de809464ef15d141e96b9c476426e18229f1257e864b2f73c84d0014d00032&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1373626077687054386/eed79d5e9d0639297e0a2945066c7b4c.jpg?ex=682b1879&is=6829c6f9&hm=070bd6caf6b2d2a4bd540eddf2b671c633d1d346dba2dd2cb5609fe3766dfb55&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1372776697753239632/booty.mp4?ex=682aa46d&is=682952ed&hm=a4e572d784abf0d8d5ba08eae1ea826ef0a61dbfd5f38c9eb4662fa5cc78d0f3&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1372942743780724826/image.png?ex=682b3f12&is=6829ed92&hm=a608e3473c1e0971a81c15d4cda73c90471490b9d478439e651b129a1f27a06d&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1370433056703385640/file.png?ex=682aaf7e&is=68295dfe&hm=73239c1dd6f358b82065059215a1c683d5ee0b6aeee0c0f19a2dfddfe53df51c&`,
      `https://d.vxtwitter.com/i/status/1831897540524114354`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281564222488317962/20240903_104834.jpg?ex=682b0a30&is=6829b8b0&hm=09b0a5e2363e5fdab7ad40b83b16ab51f2848c552961751f5939edbee4a91bf9&`,
      `https://d.vxtwitter.com/blephin_/status/1748019919885832217?t=qzcI7cbwZEJ8uUUdmht9yA&s=19`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281292405458604094/togif-1.gif?ex=682ab5ca&is=6829644a&hm=954795300df86533f743bdccee7cc433f2be6e876346e63d8814ddc37b2318f8&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281270802209050654/GWqYRMUacAAryc5.jpg?ex=682aa1ac&is=6829502c&hm=0decb70c2ce275ee997d6c5c621dad352938cadea2d3df18ed8121b26288b575&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281255798252769301/image0.gif?ex=682b3c72&is=6829eaf2&hm=479c2d500ba4f809032c66efbe94f7da2356949870255c62163906d0bc901a15&`,
      `https://tenor.com/view/backshots-working-out-backshot-machine-gif-12785549926344490376`,
      `https://cdn.discordapp.com/attachments/803635095733796905/1277832802389200977/225019E9-EF52-4CE8-9921-47CEFD018820.gif?ex=682aa609&is=68295489&hm=79552d35175469bb62fb177bb6b5642ba3b611b713699207a47d5a75baf1316c&`,
      `https://cdn.discordapp.com/attachments/803635095733796905/1280051210703081554/this-shit-laced-laced.gif?ex=682acf16&is=68297d96&hm=8daa57fe95957c11996b3e7a0d7a6ba8a20c6dfb36cbe4d266461a1e95b991f9&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281235855843000421/goku.jpg?ex=682b29e0&is=6829d860&hm=af44c68f2d3c744309aec9879196f352976600845487a117efacf19160d87645&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281233486291927102/dyson_vacuum.png?ex=682b27ab&is=6829d62b&hm=a0235b1e4f2e25aa35b5d10422d486e6f57c42a56bce0285a23b739e79720dd0&`,
      `https://cdn.discordapp.com/attachments/1064378659579899925/1273250349049712731/copy_85B464E9-5340-42B2-8BCC-BF0044E4EE9A.gif?ex=682b1dcb&is=6829cc4b&hm=d6e7057e59727c9e15823dfeb2bcf557974eba99683596267752e2fca26e40d3&`,
      `sybau bro 🥀🥀🥀🥀`
      `https://cdn.discordapp.com/attachments/1202269251621097576/1373609947673268224/attachment-7.gif?ex=682b0973&is=6829b7f3&hm=54930ad2074e3862c27ce7a88dbbcee7f40db88582ecfde101edc8d27697ff96&`,
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    message.channel.send(roast);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});
