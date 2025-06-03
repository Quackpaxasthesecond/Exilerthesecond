const roasts = require('../roasts');
const hiExileMessages = require('../hiExileMessages');

module.exports = {
  name: 'hi',
  execute: async (message, args, context) => {
    const { db, hiStreaks, HI_STREAK_RESET, hiDuels, hiState, HI_CHAIN_WINDOW, HI_COMBO_WINDOW, FUNNY_EMOJIS, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS } = context;
    const userId = message.author.id;
    const now = Date.now();
    // Hi streak logic (same as before)
    if (!hiStreaks[userId] || now - hiStreaks[userId].last > HI_STREAK_RESET) {
      hiStreaks[userId] = { streak: 1, last: now };
    } else {
      hiStreaks[userId].streak++;
      hiStreaks[userId].last = now;
    }
    if (hiStreaks[userId].streak > 1 && hiStreaks[userId].streak % 5 === 0) {
      message.channel.send(`${message.author.username} is on a hi streak of ${hiStreaks[userId].streak}!`);
    }
    // Hi duel scoring
    const guildId = message.guild.id;
    if (hiDuels[guildId] && hiDuels[guildId].accepted && now < hiDuels[guildId].endTime) {
      if (hiDuels[guildId].scores[userId] === undefined) hiDuels[guildId].scores[userId] = 0;
      hiDuels[guildId].scores[userId]++;
    }
    // Hi chain
    if (now - hiState.lastTimestamp <= HI_CHAIN_WINDOW) {
      hiState.chainCount++;
      if (hiState.chainCount > hiState.chainRecord) {
        hiState.chainRecord = hiState.chainCount;
        message.channel.send(`New HI CHAIN RECORD! ${hiState.chainRecord} in a row! 🔥`);
      }
    } else {
      hiState.chainCount = 1;
    }
    hiState.lastTimestamp = now;
    // Hi combo
    if (!hiState.comboUsers.includes(message.author.username)) {
      hiState.comboUsers.push(message.author.username);
    }
    if (hiState.comboTimeout) clearTimeout(hiState.comboTimeout);
    hiState.comboTimeout = setTimeout(() => {
      if (hiState.comboUsers.length > 1) {
        message.channel.send(`HI COMBO! ${hiState.comboUsers.join(', ')}! 💥`);
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
    // Increment hi usage count in DB
    try {
      await db.query(`INSERT INTO hi_usages (user_id, count) VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + 1`, [message.author.id]);
      // Hi crown logic omitted for brevity
    } catch (err) {
      console.error('Failed to increment hi usage or update hi crown:', err);
    }
  }
};
