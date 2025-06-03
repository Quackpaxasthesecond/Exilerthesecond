module.exports = {
  name: 'gamble',
  execute: async (message, args, context) => {
    const { db, gambleCooldowns } = context;
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
    const hiCount = res.rows[0]?.count || 0;
    if (hiCount < amount) return message.reply('You do not have enough hi to gamble that amount.');
    // Coin flip
    const win = Math.random() < 0.5;
    // 3% exile chance
    const exileChance = Math.random() < 0.02;
    if (win) {
      // 1% chance for 100x multiplier
      if (Math.random() < 0.01) {
        const mult = 100;
        const winnings = amount * mult;
        await db.query('UPDATE hi_usages SET count = count + $1 WHERE user_id = $2', [winnings, userId]);
        message.reply(`JACKPOT! You won the 100x mult and gained ${winnings} hi!`);
      } else {
        await db.query('UPDATE hi_usages SET count = count + $1 WHERE user_id = $2', [amount, userId]);
        message.reply(`You won! Your hi count increased by ${amount}.`);
      }
    } else {
      await db.query('UPDATE hi_usages SET count = count - $1 WHERE user_id = $2', [amount, userId]);
      message.reply(`You lost! Your hi count decreased by ${amount}.`);
    }
    if (exileChance) {
      // Exile logic: add your own exile implementation here
      message.reply('Unlucky! You have been exiled by the gambling gods!');
      // Optionally, call your exile command or logic here
    }
    gambleCooldowns.set(userId, now);
  }
};
