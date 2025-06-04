module.exports = {
  name: 'gamble',
  execute: async (message, args, context) => {
    const { db, gambleCooldowns, ROLE_IDS } = context;
    const userId = message.author.id;
    const now = Date.now();
    const cooldown = 0.5 * 1000; // 0.5 seconds
    if (gambleCooldowns.has(userId) && now - gambleCooldowns.get(userId) < cooldown) {
      const secs = ((cooldown - (now - gambleCooldowns.get(userId))) / 1000).toFixed(2);
      return message.reply(`You must wait ${secs} more second(s) before gambling again.`);
    }
    const amount = parseInt(args[0], 10);
    if (!amount || amount <= 0) return message.reply('Usage: `-gamble <amount>`');
    // Check user hi count
    const res = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [userId]);
    let hiCount = res.rows[0]?.count || 0;
    if (hiCount < amount) return message.reply('You do not have enough hi to gamble that amount.');
    // Coin flip
    const win = Math.random() < 0.5;
    // 2% exile chance
    const exileChance = Math.random() < 0.02;
    let resultMsg = '';
    if (win) {
      // 1% chance for 100x multiplier
      if (Math.random() < 0.01) {
        const mult = 100;
        const winnings = amount * mult;
        await db.query('UPDATE hi_usages SET count = count + $1 WHERE user_id = $2', [winnings, userId]);
        resultMsg = `JACKPOT! You won the 100x mult and gained ${winnings} hi!`;
      } else {
        await db.query('UPDATE hi_usages SET count = count + $1 WHERE user_id = $2', [amount, userId]);
        resultMsg = `You won! Your hi count increased by ${amount}.`;
      }
    } else {
      await db.query('UPDATE hi_usages SET count = count - $1 WHERE user_id = $2', [amount, userId]);
      resultMsg = `You lost! Your hi count decreased by ${amount}.`;
    }
    // Get updated hi count
    const newRes = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [userId]);
    hiCount = newRes.rows[0]?.count || 0;
    resultMsg += `\nYour new hi count: ${hiCount}`;
    message.reply(resultMsg);
    if (exileChance) {
      // Exile logic: actually add the exiled role
      try {
        const member = await message.guild.members.fetch(userId);
        await member.roles.add(ROLE_IDS.exiled);
        await member.roles.remove(ROLE_IDS.swaggers);
        await member.roles.remove(ROLE_IDS.uncle);
        await db.query('INSERT INTO exiles (issuer, target) VALUES ($1, $2)', [message.author.id, userId]);
        message.channel.send(`<@${userId}> has been exiled by the gambling gods!`);
      } catch (err) {
        message.channel.send('Tried to exile you, but something went wrong.');
      }
    }
    gambleCooldowns.set(userId, now);
  }
};
