module.exports = {
  name: 'gamble',
  description: 'Bet your hi count for a 50/50 chance to double or lose the amount.',
  slash: true,
  options: [
    {
      name: 'amount',
      description: 'Amount to gamble',
      type: 4, // INTEGER
      required: true
    }
  ],
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
  // Coin flip, modified by extra_luck
  const shopHelpers = require('../lib/shopHelpers');
  const active = await shopHelpers.getActiveEffects(db, userId).catch(() => ({}));
  const extraLuckPct = active && active.extra_luck ? Number(active.extra_luck) : 0; // percentage points
  // win chance is 50% base plus extraLuckPct percent (e.g. 10 => 60% win chance)
  const winChance = Math.min(0.99, 0.5 + (extraLuckPct / 100));
  const win = Math.random() < winChance;
  // exile chance: base 2%, reduced by extra luck (each 10% luck reduces exile chance by 0.5%)
  const exileBase = 0.02;
  const exileReduction = Math.min(0.019, (extraLuckPct / 10) * 0.005);
  const exileChance = Math.max(0, exileBase - exileReduction);
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
  // append current luck info
  resultMsg += `\nYour current gamble luck bonus: ${extraLuckPct}% (applies to win chance)`;
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(resultMsg);
  return message.reply(resultMsg);
  if (exileChance) {
      // Exile logic: actually add the exiled role
      try {
        const member = await message.guild.members.fetch(userId);
        await member.roles.add(ROLE_IDS.exiled);
        await member.roles.remove(ROLE_IDS.swaggers);
        await member.roles.remove(ROLE_IDS.uncle);
        await db.query('INSERT INTO exiles (issuer, target) VALUES ($1, $2)', [message.author.id, userId]);
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`<@${userId}> has been exiled by the gambling gods!`);
  return message.channel.send(`<@${userId}> has been exiled by the gambling gods!`);
        // --- Auto unexile after 3 minutes ---
        setTimeout(async () => {
          const refreshed = await message.guild.members.fetch(userId).catch(() => null);
          if (refreshed && refreshed.roles.cache.has(ROLE_IDS.exiled)) {
            await refreshed.roles.remove(ROLE_IDS.exiled);
            if (context.SPECIAL_MEMBERS && context.SPECIAL_MEMBERS.includes(refreshed.id)) {
              await refreshed.roles.add(ROLE_IDS.uncle);
                if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`${refreshed.user.username} the unc has been automatically unexiled.`);
                return message.channel.send(`${refreshed.user.username} the unc has been automatically unexiled.`);
            } else if (context.SWAGGER_MEMBERS && context.SWAGGER_MEMBERS.includes(refreshed.id)) {
              await refreshed.roles.add(ROLE_IDS.swaggers);
                if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`${refreshed.user.username} the swagger has been automatically unexiled.`);
                return message.channel.send(`${refreshed.user.username} the swagger has been automatically unexiled.`);
            } else {
                    if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`${refreshed.user.username} has been automatically unexiled.`);
                    return message.channel.send(`${refreshed.user.username} has been automatically unexiled.`);
            }
          }
        }, 3 * 60 * 1000);
      } catch (err) {
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply('Tried to exile you, but something went wrong.');
  return message.channel.send('Tried to exile you, but something went wrong.');
      }
    }
    gambleCooldowns.set(userId, now);
  }
};
