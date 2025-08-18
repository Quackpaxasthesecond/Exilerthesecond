const roasts = require('../roasts');
const hiExileMessages = require('../hiExileMessages');
const { hiDuels } = require('./acceptduel');

module.exports = {
  name: 'hi',
  description: 'Use this for random fun! Try it often for streaks, combos, and roasts.',
  // keep -hi prefix-only
  slash: false,
  options: [],
  execute: async (input, args, context) => {
    // support both message-style and interaction-adapted messageLike
    const isInteraction = typeof input?.isChatInputCommand === 'function' && input.isChatInputCommand();
    const message = !isInteraction ? input : input; // index adapter provides message-like object for interactions
    const { db, HI_STREAK_RESET, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS } = context;
    // Block hi command in specific channels
    const HI_BLOCKED_CHANNELS = ['1374052923956269136', '1351976782131363880', '1208809645205094481'];
    if (HI_BLOCKED_CHANNELS.includes(message.channel.id)) {
      return message.reply('The -hi command is disabled in this channel.');
    }
    // --- Persistent Hi Streaks (6h reset) ---
    const streakRes = await db.query('SELECT streak, last FROM hi_streaks WHERE user_id = $1', [message.author.id]);
    let streak = 1;
    let last = Date.now();
    if (streakRes.rows.length > 0) {
      const lastTime = new Date(streakRes.rows[0].last).getTime();
      if (Date.now() - lastTime > 6 * 60 * 60 * 1000) {
        streak = 1;
      } else {
        streak = streakRes.rows[0].streak + 1;
      }
    }
    await db.query('INSERT INTO hi_streaks (user_id, streak, last) VALUES ($1, $2, to_timestamp($3 / 1000.0)) ON CONFLICT (user_id) DO UPDATE SET streak = $2, last = to_timestamp($3 / 1000.0)', [message.author.id, streak, Date.now()]);
    if (streak > 1 && streak % 5 === 0) {
      message.channel.send(`${message.author.username} is on a hi streak of ${streak}!`);
    }
    // --- Persistent Hi Chain (guild-wide) ---
    const chainRes = await db.query('SELECT chain_count, chain_record, last_timestamp FROM hi_chains WHERE guild_id = $1', [message.guild.id]);
    let chain = 1;
    let chainRecord = 1;
    let lastChain = Date.now();
    if (chainRes.rows.length > 0) {
      const lastChainTime = new Date(chainRes.rows[0].last_timestamp).getTime();
      if (Date.now() - lastChainTime <= HI_CHAIN_WINDOW) {
        chain = chainRes.rows[0].chain_count + 1;
        chainRecord = Math.max(chain, chainRes.rows[0].chain_record);
      } else {
        chain = 1;
        chainRecord = chainRes.rows[0].chain_record;
      }
    }
    await db.query('INSERT INTO hi_chains (guild_id, chain_count, chain_record, last_timestamp) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0)) ON CONFLICT (guild_id) DO UPDATE SET chain_count = $2, chain_record = $3, last_timestamp = to_timestamp($4 / 1000.0)', [message.guild.id, chain, chainRecord, Date.now()]);
    if (chain > 1 && chain === chainRecord) {
      message.channel.send(`New HI CHAIN RECORD! ${chainRecord} in a row! 🔥`);
    }
    // Hi duel scoring
    const guildId = message.guild.id;
    if (hiDuels[guildId] && hiDuels[guildId].accepted && Date.now() < hiDuels[guildId].endTime) {
      if (hiDuels[guildId].scores[message.author.id] === undefined) hiDuels[guildId].scores[message.author.id] = 0;
      hiDuels[guildId].scores[message.author.id]++;
    }
    // Hi combo
    if (!context.hiState) context.hiState = { comboUsers: [], comboTimeout: null };
    const hiState = context.hiState;
    if (!hiState.comboUsers.includes(message.author.username)) {
      hiState.comboUsers.push(message.author.username);
    }
    if (hiState.comboTimeout) clearTimeout(hiState.comboTimeout);
    hiState.comboTimeout = setTimeout(() => {
      if (hiState.comboUsers.length > 1) {
        message.channel.send(`HI COMBO! ${hiState.comboUsers.join(', ')}! \uD83D\uDCA5`);
      }
      hiState.comboUsers = [];
    }, HI_COMBO_WINDOW);
    // Pick a random member and roast them
  const members = await message.guild.members.fetch();
    const filtered = members.filter(m => !m.user.bot && m.id !== message.author.id);
    if (filtered.size === 0) return message.reply("you will die....");
    const randomMember = filtered.random();
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    // Fix: Actually use RNG for roast/image, not just quotes
    if (roast.startsWith('http')) {
      message.channel.send(roast);
    } else if (roast.includes('{user}')) {
      message.channel.send(roast.replace('{user}', randomMember.user.username));
    } else {
      message.channel.send(roast);
    }
    // Random emoji reaction
    if (Math.random() < 0.2) {
      try {
        const emoji = FUNNY_EMOJIS[Math.floor(Math.random() * FUNNY_EMOJIS.length)];
        await message.react(emoji);
      } catch {}
    }
    // --- HI ZONE 2x Multiplier ---
    if (!context.hiZone) context.hiZone = {};
    const hiZone = context.hiZone;
    const userId = message.author.id;
    const now = Date.now();
    // 2% chance to enter HI ZONE for 10 minutes
    if (!hiZone[userId] || hiZone[userId].expires < now) {
      if (Math.random() < 0.02) {
        hiZone[userId] = { expires: now + 10 * 60 * 1000 };
        message.channel.send(`${message.author.username} has entered the HI ZONE! 2x hi for 10 minutes! 🔥`);
      }
    }
    // Increment hi usage count in DB with booster multiplier and temporary multipliers
    let hiIncrement = 1;
    if (hiZone[userId] && hiZone[userId].expires > now) {
      hiIncrement = 2;
    } else {
      // legacy booster role (guard role lookup)
      let member = null;
      try { member = await message.guild.members.fetch(userId); } catch {}
      if (member && member.roles && member.roles.cache && member.roles.cache.has('1212713296495382538')) {
        hiIncrement = 2;
      }
    }

    // Apply global/user multipliers if set via addhimult
    let totalMultiplier = 1;
    try {
      if (global.hiMultipliers) {
        if (global.hiMultipliers.global && global.hiMultipliers.global.multiplier) {
          totalMultiplier *= Number(global.hiMultipliers.global.multiplier) || 1;
        }
        if (global.hiMultipliers.users && global.hiMultipliers.users[userId] && global.hiMultipliers.users[userId].multiplier) {
          totalMultiplier *= Number(global.hiMultipliers.users[userId].multiplier) || 1;
        }
      }
    } catch (e) { /* ignore */ }

    const finalIncrement = Math.max(1, Math.floor(hiIncrement * totalMultiplier));
    try {
      await db.query(`INSERT INTO hi_usages (user_id, count) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + $2`, [message.author.id, finalIncrement]);
      // Hi crown logic omitted for brevity
    } catch (err) {
      console.error('Failed to increment hi usage or update hi crown:', err);
    }
  }
};
