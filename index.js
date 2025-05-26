const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: PgClient } = require('pg');
require('dotenv').config();
const http = require('http');
const roasts = require('./roasts');

// --- Constants ---
const ROLE_IDS = {
  exiled: '1208808796890337350',
  swaggers: '1202948499193335828',
  uncle: '1351986650754056354',
  mod: '1353414310499455027',
  admin: '1351985637602885734',
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

// --- Utility ---
const timers = new Map();
const cooldowns = new Map();

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
    message.reply('Slow down!');
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

// --- Event Handlers ---
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Exiling buddies.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- Modular Commands ---
  if (commands.has(command.slice(1))) {
    const cmd = commands.get(command.slice(1));
    cmd.execute(message, args, {
      db, timers, client, checkCooldown, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, confirmAction
    });
    return;
  }

  // --- Exile Command ---
  if (command === '-exile') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;
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

  // --- Unexile Command ---
  if (command === '-unexile') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;

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

  // --- MyExiles Command ---
  if (command === '-myexiles') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;

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

  // --- Leaderboard Command ---
  if (command === '-leaderboard') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;

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

      const embed = new EmbedBuilder()
        .setTitle('')
        .setDescription(leaderboard)
        .setColor(0x7289da);
      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.channel.send('An error occurred while fetching the leaderboard.');
    }
  }

  // --- Hi Command ---
  if (command === '-hi') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;

    // Increment hi usage count in DB
    try {
      await db.query(`INSERT INTO hi_usages (user_id, count) VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + 1`, [message.author.id]);
    } catch (err) {
      console.error('Failed to increment hi usage:', err);
    }

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

  // --- Owner-only: Add Exile(s) ---
  if (command === '-addexile') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;
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
      await db.query(`INSERT INTO exiles (issuer, target) VALUES ${values.join(',')}`);
      message.channel.send(`Added ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('Error adding fake exile entries.');
    }
    return;
  }

  // --- Owner-only: Remove Exile(s) ---
  if (command === '-removeexile') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can modify leaderboard records.");
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply("Usage: `-removeexile @user <positive number>`");
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to remove up to ${amount} exiles for ${target.user.username}.`);
    if (!confirmed) return message.channel.send('Action cancelled.');
    try {
      // Use a subquery to delete by id in order of timestamp
      await db.query(
        `DELETE FROM exiles WHERE id IN (
          SELECT id FROM exiles WHERE target = $1 ORDER BY timestamp ASC LIMIT $2
        )`,
        [target.id, amount]
      );
      message.channel.send(`Removed up to ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('Error removing exile entries.');
    }
    return;
  }

  // --- Owner-only: Reset Leaderboard for a User ---
  if (command === '-resetleaderboard') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can reset exile records.");
    }
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('Please mention a valid user to reset their leaderboard score.');
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to reset all exiles for ${target.user.username}.`);
    if (!confirmed) return message.channel.send('Action cancelled.');
    try {
      await db.query(`DELETE FROM exiles WHERE target = $1`, [target.id]);
      message.channel.send(`Leaderboard record reset for ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while resetting the leaderboard record.');
    }
    return;
  }

  // --- Hi Leaderboard Command ---
  if (command === '-hileaderboard') {
    if (checkCooldown(message.author.id, command, message, message.member)) return;
    try {
      const res = await db.query(
        `SELECT user_id, count FROM hi_usages ORDER BY count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
        return message.channel.send('No hi usages have been recorded yet.');
      }
      let leaderboard = '**test**:\n';
      for (let i = 0; i < res.rows.length; i++) {
        let member;
        try {
          member = await message.guild.members.fetch(res.rows[i].user_id);
        } catch {
          member = null;
        }
        const name = member ? member.user.username : `Unknown (${res.rows[i].user_id})`;
        leaderboard += `${i + 1}. ${name} - ${res.rows[i].count} hi's\n`;
      }
      const embed = new EmbedBuilder()
        .setTitle('-hi Usage Leaderboard')
        .setDescription(leaderboard)
        .setColor(0x00b894);
      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.channel.send('An error occurred while fetching the hi leaderboard.');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});