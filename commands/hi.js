const roasts = require('../roasts');
const hiExileMessages = require('../hiExileMessages');

module.exports = {
  name: 'hi',
  execute: async (message, args, context) => {
    const { db, HI_STREAK_RESET, hiDuels, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS } = context;
    const userId = message.author.id;
    const now = Date.now();
    // Block hi command in specific channels
    const HI_BLOCKED_CHANNELS = ['1374052923956269136', '1351976782131363880', '1208809645205094481'];
    if (HI_BLOCKED_CHANNELS.includes(message.channel.id)) {
      return message.reply('The -hi command is disabled in this channel.');
    }
    // --- Persistent Hi Streaks (6h reset) ---
    const streakRes = await db.query('SELECT streak, last FROM hi_streaks WHERE user_id = $1', [userId]);
    let streak = 1;
    let last = now;
    if (streakRes.rows.length > 0) {
      const lastTime = new Date(streakRes.rows[0].last).getTime();
      if (now - lastTime > 6 * 60 * 60 * 1000) {
        streak = 1;
      } else {
        streak = streakRes.rows[0].streak + 1;
      }
    }
    await db.query('INSERT INTO hi_streaks (user_id, streak, last) VALUES ($1, $2, to_timestamp($3 / 1000.0)) ON CONFLICT (user_id) DO UPDATE SET streak = $2, last = to_timestamp($3 / 1000.0)', [userId, streak, now]);
    if (streak > 1 && streak % 5 === 0) {
      message.channel.send(`${message.author.username} is on a hi streak of ${streak}!`);
    }
    // --- Persistent Hi Chain (guild-wide) ---
    const chainRes = await db.query('SELECT chain_count, chain_record, last_timestamp FROM hi_chains WHERE guild_id = $1', [message.guild.id]);
    let chain = 1;
    let chainRecord = 1;
    let lastChain = now;
    if (chainRes.rows.length > 0) {
      const lastChainTime = new Date(chainRes.rows[0].last_timestamp).getTime();
      if (now - lastChainTime <= HI_CHAIN_WINDOW) {
        chain = chainRes.rows[0].chain_count + 1;
        chainRecord = Math.max(chain, chainRes.rows[0].chain_record);
      } else {
        chain = 1;
        chainRecord = chainRes.rows[0].chain_record;
      }
    }
    await db.query('INSERT INTO hi_chains (guild_id, chain_count, chain_record, last_timestamp) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0)) ON CONFLICT (guild_id) DO UPDATE SET chain_count = $2, chain_record = $3, last_timestamp = to_timestamp($4 / 1000.0)', [message.guild.id, chain, chainRecord, now]);
    if (chain > 1 && chain === chainRecord) {
      message.channel.send(`New HI CHAIN RECORD! ${chainRecord} in a row! 🔥`);
    }
    // Hi duel scoring
    const guildId = message.guild.id;
    if (hiDuels[guildId] && hiDuels[guildId].accepted && now < hiDuels[guildId].endTime) {
      if (hiDuels[guildId].scores[userId] === undefined) hiDuels[guildId].scores[userId] = 0;
      hiDuels[guildId].scores[userId]++;
    }
    // Hi combo
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
    // Increment hi usage count in DB with booster multiplier
    let hiIncrement = 1;
    const member = await message.guild.members.fetch(userId);
    if (member.roles.cache.has('1212713296495382538')) {
      hiIncrement = 2;
    }
    try {
      await db.query(`INSERT INTO hi_usages (user_id, count) VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + $2`, [message.author.id, hiIncrement]);
      // Hi crown logic omitted for brevity
    } catch (err) {
      console.error('Failed to increment hi usage or update hi crown:', err);
    }
  }
};
