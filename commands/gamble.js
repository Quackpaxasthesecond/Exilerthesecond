module.exports = {
  name: 'gamble',
  description: 'Bet your hi count for a 50/50 chance to double or lose the amount.',
  slash: true,
  publicSlash: true,
  postToChannel: false,
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
  const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
  const userId = message.author?.id || message.user?.id;
  const now = Date.now();
    const cooldown = 0.5 * 1000; // 0.5 seconds
    if (gambleCooldowns.has(userId) && now - gambleCooldowns.get(userId) < cooldown) {
      const secs = ((cooldown - (now - gambleCooldowns.get(userId))) / 1000).toFixed(2);
      if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`You must wait ${secs} more second(s) before gambling again.`);
      return message.channel.send(`You must wait ${secs} more second(s) before gambling again.`);
    }

    // parse amount (support slash options)
    const amount = (typeof args.getInteger === 'function') ? args.getInteger('amount') : parseInt(args[0], 10);
    if (!amount || amount <= 0) {
      const text = 'Usage: `-gamble <amount>`';
      if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    }

    // Check user hi count
    const res = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [userId]);
    let hiCount = res.rows[0]?.count || 0;
    if (hiCount < amount) {
      const text = 'You do not have enough hi to gamble that amount.';
      if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    }

    // Coin flip, modified by extra_luck
    const shopHelpers = require('../lib/shopHelpers');
    const active = await shopHelpers.getActiveEffects(db, userId).catch(() => ({}));
  const extraLuckPct = active && active.extra_luck ? Number(active.extra_luck) : 0; // percentage points
  // win chance is 50% base plus extraLuckPct percent (e.g. 10 => 60% win chance) but capped
  const winChance = Math.min(0.95, 0.5 + (extraLuckPct / 100));
  const win = Math.random() < winChance;
  // exile chance: base 2%, increased by extra luck (each 10% luck increases exile chance by 0.5%)
  const exileBase = 0.02;
  const exileIncrease = Math.min(0.5, (extraLuckPct / 10) * 0.005);
  const exileChance = Math.min(0.9, exileBase + exileIncrease);

    let resultMsg = '';
    // compute payout reduction: more extra_luck => smaller normal win payout
    // cap penalty at 90% to avoid zero payout
    const luckPenalty = Math.min(0.9, extraLuckPct / 100);
    if (win) {
      // 1% chance for 100x multiplier (jackpot unaffected)
      if (Math.random() < 0.01) {
        const mult = 100;
        const winnings = amount * mult;
        await db.query('UPDATE hi_usages SET count = count + $1 WHERE user_id = $2', [winnings, userId]);
        resultMsg = `JACKPOT! You won the 100x mult and gained ${winnings} hi!`;
      } else {
        // normal win scaled down by luckPenalty
        const gain = Math.max(1, Math.floor(amount * (1 - luckPenalty)));
        await db.query('UPDATE hi_usages SET count = count + $1 WHERE user_id = $2', [gain, userId]);
        const penaltyPct = Math.round(luckPenalty * 100);
        resultMsg = `You won! Your hi count increased by ${gain} (reduced by ${penaltyPct}% due to extra luck).`;
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

    // handle possible exile
    if (Math.random() < exileChance) {
      try {
        if (message.guild) {
          const member = await message.guild.members.fetch(userId).catch(() => null);
          if (member) {
            await member.roles.add(ROLE_IDS.exiled).catch(() => null);
            await member.roles.remove(ROLE_IDS.swaggers).catch(() => null);
            await member.roles.remove(ROLE_IDS.uncle).catch(() => null);
          }
        }
  const issuerId = message.author?.id || message.user?.id || userId;
  await db.query('INSERT INTO exiles (issuer, target) VALUES ($1, $2)', [issuerId, userId]);
        resultMsg += `\n<@${userId}> has been exiled by the gambling gods!`;
        // schedule unexile
        setTimeout(async () => {
          try {
            if (!message.guild) return;
            const refreshed = await message.guild.members.fetch(userId).catch(() => null);
            if (refreshed && refreshed.roles.cache.has(ROLE_IDS.exiled)) {
              await refreshed.roles.remove(ROLE_IDS.exiled).catch(() => null);
              if (context.SPECIAL_MEMBERS && context.SPECIAL_MEMBERS.includes(refreshed.id)) {
                await refreshed.roles.add(ROLE_IDS.uncle).catch(() => null);
              } else if (context.SWAGGER_MEMBERS && context.SWAGGER_MEMBERS.includes(refreshed.id)) {
                await refreshed.roles.add(ROLE_IDS.swaggers).catch(() => null);
              }
            }
          } catch (e) {}
        }, 3 * 60 * 1000);
      } catch (err) {
        resultMsg += `\n(Tried to auto-exile you, but something went wrong.)`;
      }
    }

    gambleCooldowns.set(userId, now);
    if (message._isFromInteraction || module.exports.postToChannel === false) await message.reply(resultMsg);
    else await message.channel.send(resultMsg);

    // Cavendish: every 4th gamble predicts and may break
    try {
      const shopHelpers2 = require('../lib/shopHelpers');
      const active2 = await shopHelpers2.getActiveEffects(db, userId).catch(() => ({}));
      if (active2 && active2.cavendish) {
        // track gamble counts in-memory map on context
        if (!global.cavGambles) global.cavGambles = {};
        const cg = global.cavGambles;
        cg[userId] = (cg[userId] || 0) + 1;
        if (cg[userId] % 4 === 0) {
          // prediction: we can prepend a note about predicted outcome
          const prediction = win ? 'win' : 'lose';
          // destruction chance base 1/6, scaled by extraLuckPct modestly
          const baseChance = 1/6;
          const luckScale = Math.min(1, extraLuckPct / 100); // 0..1
          const destroyChance = Math.min(0.9, baseChance + baseChance * luckScale);
          if (Math.random() < destroyChance) {
            // destroy cavendish: delete permanent row
            await db.query('DELETE FROM hi_shop_inventory WHERE user_id = $1 AND item = $2', [userId, 'cavendish']);
            if (message._isFromInteraction || module.exports.postToChannel === false) await message.reply(`Cavendish predicted you would ${prediction} — but it BROKE! The permanent is lost.`);
            else await message.channel.send(`Cavendish predicted you would ${prediction} — but it BROKE! The permanent is lost.`);
          } else {
            if (message._isFromInteraction || module.exports.postToChannel === false) await message.reply(`Cavendish predicted you would ${prediction} — it held.`);
            else await message.channel.send(`Cavendish predicted you would ${prediction} — it held.`);
          }
        }
      }
    } catch (e) { /* ignore errors from cavendish handling */ }
    return;
  }
};
