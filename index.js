const timers = new Map();
const { Client, GatewayIntentBits } = require('discord.js');
const { Client: PgClient } = require('pg');
require('dotenv').config();
const http = require('http');
const roasts = require('./roasts');

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

// PostgreSQL DB
const db = new PgClient({
  connectionString: process.env.POSTGRES_URL,
});
db.connect()
  .then(() => console.log('Connected to PostgreSQL database.'))
  .catch(err => console.error('Postgres connection error:', err));

// Create table if not exists (run at startup)
db.query(`
  CREATE TABLE IF NOT EXISTS exiles (
    id SERIAL PRIMARY KEY,
    issuer TEXT NOT NULL,
    target TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error(err));

const ROLE_IDS = {
  exiled: '1208808796890337350',
  swaggers: '1202948499193335828',
  uncle: '1351986650754056354',
  mod: '1353414310499455027',
  admin: '1351985637602885734',
};

const SPECIAL_MEMBERS = [ // Uncle refugeers
  '1346764665593659393', '1234493339638825054', '1149822228620382248',
  '1123873768507457536', '696258636602802226', '512964486148390922',
  '1010180074990993429', '464567511615143962', '977923308387455066',
  '800291423933038612', '872408669151690755', '1197176029815517257',
  '832354579890569226',
];

const SWAGGER_MEMBERS = [ 
 '696258636602802226',
 '699154992891953215',
 '1025984312727842846',
 '800291423933038612',
 '832354579890569226',
];

const cooldowns = new Map();

function checkCooldown(userId, command, message) {
  const key = `${userId}_${command}`;
  const now = Date.now();
  const cooldown = cooldowns.get(key);
  if (cooldown && now - cooldown < 2000) {
    message.reply('slow down buddy. you are clicking too fast.');
    return true;
  }
  cooldowns.set(key, now);
  return false;
}
async function confirmWithReactions(message, promptText) {
  const confirmMsg = await message.channel.send(promptText);
  await confirmMsg.react('✅');
  await confirmMsg.react('❌');

  const filter = (reaction, user) =>
    ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;

  try {
    const collected = await confirmMsg.awaitReactions({
      filter,
      max: 1,
      time: 15000,
      errors: ['time']
    });

    const reaction = collected.first();
    return reaction.emoji.name === '✅';
  } catch {
    return false;
  }
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
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("you aint exiling anyone buddy bro. <:silence:1182339569874636841>");
    }

    const target = message.mentions.members.first();
    const durationArg = args[1] ? parseInt(args[1], 10) : null;

    if (!target) {
      return message.reply('Please mention a valid user to exile. Usage: `-exile @user [minutes]`');
    }

    if (target.roles.cache.has(ROLE_IDS.exiled)) {
      return message.reply(`${target.user.tag} is already exiled!`);
    }

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);

      // Log all exiles immediately
      await db.query(
        `INSERT INTO exiles (issuer, target) VALUES ($1, $2)`,
        [message.author.id, target.id]
      );

      if (durationArg && !isNaN(durationArg) && durationArg > 0) {
        message.channel.send(`${target.user.username} has been exiled for ${durationArg} minutes.`);
        
        if (timers.has(target.id)) clearTimeout(timers.get(target.id));
        
        const timeout = setTimeout(async () => {
          const refreshed = await message.guild.members.fetch(target.id).catch(() => null);
          if (refreshed && refreshed.roles.cache.has(ROLE_IDS.exiled)) {
            await refreshed.roles.remove(ROLE_IDS.exiled);
            
            // Restore appropriate role
            if (SPECIAL_MEMBERS.includes(refreshed.id)) {
              await refreshed.roles.add(ROLE_IDS.uncle);
              message.channel.send(`${refreshed.user.username} the unc has been automatically unexiled.`);
            } else if (SWAGGER_MEMBERS.includes(refreshed.id)) {
              await refreshed.roles.add(ROLE_IDS.swaggers);
              message.channel.send(`${refreshed.user.username} the swagger has been automatically unexiled.`);
            } else {
              message.channel.send(`${refreshed.user.username} has been automatically unexiled.`);
            }
          }
          timers.delete(target.id);
        }, durationArg * 60 * 1000);
        
        timers.set(target.id, timeout);
      } else {
        message.channel.send(`${target.user.username} has been exiled.`);
      }
    } catch (error) {
      console.error(error);
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

    // Restore roles based on membership
    const isUncle = SPECIAL_MEMBERS.includes(target.id);
    const isSwagger = SWAGGER_MEMBERS.includes(target.id);

    if (isUncle && isSwagger) {
      await target.roles.add([ROLE_IDS.uncle, ROLE_IDS.swaggers]);
      message.channel.send(`${target.user.username} the unc has been unexiled. with their lil swag too ig `);
    } else if (isUncle) {
      await target.roles.add(ROLE_IDS.uncle);
      message.channel.send(`${target.user.username} the unc has been unexiled`);
    } else if (isSwagger) {
      await target.roles.add(ROLE_IDS.swaggers);
      message.channel.send(`${target.user.username} has been unexiled. with their lil swag too ig`);
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

    try {
      const res = await db.query(
        `SELECT COUNT(*) as count FROM exiles WHERE issuer = $1`,
        [message.author.id]
      );
      const count = res.rows[0].count;
      message.reply(`you've murdered ${count} people.`);
    } catch (err) {
      console.error(err);
      message.reply('Error checking your exile record.');
    }
  }

  if (command === '-leaderboard') {
    if (checkCooldown(message.author.id, command, message)) return;

    try {
      const res = await db.query(
        `SELECT target, COUNT(*) as exile_count FROM exiles GROUP BY target ORDER BY exile_count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
        return message.channel.send('No exiles have been recorded yet.');
      }

      let leaderboard = '**Exile Leaderboard <:crying:1285606636853137560>**:\n';

      for (let i = 0; i < res.rows.length; i++) {
        const member = await message.guild.members.fetch(res.rows[i].target).catch(() => null);
        const name = member ? member.user.username : `Unknown (${res.rows[i].target})`;
        leaderboard += `${i + 1}. ${name} - ${res.rows[i].exile_count} exiles\n`;
      }

      message.channel.send(leaderboard);
    } catch (err) {
      console.error(err);
      message.channel.send('An error occurred while fetching the leaderboard.');
    }
  }

if (command === '-hi') {
  if (checkCooldown(message.author.id, command, message)) return;

  // 1% chance to exile the message author (non-mods/admins)
  if (
    !message.member.roles.cache.has(ROLE_IDS.mod) &&
    !message.member.roles.cache.has(ROLE_IDS.admin) &&
    message.guild.ownerId !== message.author.id
  ) {
    if (Math.random() < 0.01) {
      try {
        const wasSwagger = message.member.roles.cache.has(ROLE_IDS.swaggers);
        const wasUncle = message.member.roles.cache.has(ROLE_IDS.uncle);

        await message.member.roles.add(ROLE_IDS.exiled);
        await message.member.roles.remove(ROLE_IDS.swaggers);
        await message.member.roles.remove(ROLE_IDS.uncle);

        await db.query(
          `INSERT INTO exiles (issuer, target) VALUES ($1, $2)`,
          [message.author.id, message.author.id]
        );

        message.channel.send(`${message.author.username} just got exiled for using -hi 😭`);

        setTimeout(async () => {
          try {
            await message.member.roles.remove(ROLE_IDS.exiled);

            if (wasUncle || SPECIAL_MEMBERS.includes(message.author.id)) {
              await message.member.roles.add(ROLE_IDS.uncle);
            }
            if (wasSwagger || SWAGGER_MEMBERS.includes(message.author.id)) {
              await message.member.roles.add(ROLE_IDS.swaggers);
            }

            message.channel.send(`${message.author.username} has been automatically unexiled after 5 minutes.`);
          } catch (err) {
            console.error('Failed to auto-unexile:', err);
          }
        }, 5 * 60 * 1000);
        return;
      } catch (err) {
        console.error(err);
        message.reply('you lucky as hell for dodging that 1% exile chance');
        return;
      }
    }
  }

  // Pick a random member and roast them
  const members = await message.guild.members.fetch();
  const filtered = members.filter(m => !m.user.bot && m.id !== message.author.id);
  if (filtered.size === 0) return message.reply("you will die....");

  const randomMember = filtered.random();
  const roast = roasts[Math.floor(Math.random() * roasts.length)];

  if (roast.startsWith('http')) {
    message.channel.send(roast); // Direct media link
  } else if (roast.includes('{user}')) {
    message.channel.send(roast.replace('{user}', randomMember.user.username)); // Replace {user}
  } else {
    message.channel.send(`${randomMember.user.username} ${roast}`); // Append name by default
  }
}

// Add exile entries manually
if (command === '-addexile') {
  if (message.guild.ownerId !== message.author.id) {
    return message.reply("Only the server owner can modify leaderboard records.");
  }

  const target = message.mentions.members.first();
  const amount = parseInt(args[1], 10);

  if (!target || isNaN(amount) || amount <= 0) {
    return message.reply("Usage: `-addexile @user <positive number>`");
  }

  try {
    const values = [];
    for (let i = 0; i < amount; i++) {
      values.push(`('${message.author.id}', '${target.id}')`);
    }

    await db.query(
      `INSERT INTO exiles (issuer, target) VALUES ${values.join(',')}`
    );

    message.channel.send(`Added ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`);
  } catch (err) {
    console.error(err);
    message.reply('Error adding fake exile entries.');
  }
}

// Remove exile entries
if (command === '-removeexile') {
  if (message.guild.ownerId !== message.author.id) {
    return message.reply("Only the server owner can modify leaderboard records.");
  }

  const target = message.mentions.members.first();
  const amount = parseInt(args[1], 10);

  if (!target || isNaN(amount) || amount <= 0) {
    return message.reply("Usage: `-removeexile @user <positive number>`");
  }

  const confirmed = await confirmWithReactions(message, `Remove up to ${amount} exile${amount > 1 ? 's' : ''} from ${target.user.username}? React with ✅ to confirm or ❌ to cancel.`);
  if (!confirmed) return message.channel.send('Action cancelled.');

  try {
    await db.query(
      `DELETE FROM exiles WHERE target = $1 ORDER BY timestamp ASC LIMIT $2`,
      [target.id, amount]
    );

    message.channel.send(`Removed up to ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`);
  } catch (err) {
    console.error(err);
    message.reply('Error removing exile entries.');
  }
}

if (command === '-resetleaderboard') {
  if (message.guild.ownerId !== message.author.id) {
    return message.reply("Only the server owner can reset exile records.");
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply('Please mention a valid user to reset their leaderboard score.');
  }

  const confirmed = await confirmWithReactions(message, `Are you sure you want to completely reset ${target.user.username}'s exile record? React with ✅ to confirm or ❌ to cancel.`);
  if (!confirmed) return message.channel.send('Action cancelled.');

  try {
    await db.query(`DELETE FROM exiles WHERE target = $1`, [target.id]);
    message.channel.send(`Leaderboard record reset for ${target.user.username}.`);
  } catch (err) {
    console.error(err);
    message.reply('An error occurred while resetting the leaderboard record.');
  }
}
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});