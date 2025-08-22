module.exports = {
  name: 'shadegambit',
  description: 'Use Shade\'s Gambit on a target: 3 coin flips vs target, most matching heads/tails wins; loser is exiled. Permanent, 2h cooldown.',
  slash: true,
  publicSlash: true,
  options: [ { name: 'target', description: 'User to challenge', type: 6, required: true } ],
  execute: async (message, args, context) => {
    const { db, ROLE_IDS } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const userId = message.author?.id || message.user?.id;
    const guild = message.guild;
    const targetId = (isInteraction ? args.getUser('target')?.id : (message.mentions && message.mentions.users && message.mentions.users.first() ? message.mentions.users.first().id : args[0]));
    if (!targetId) {
      const text = 'Usage: -shadegambit @target';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    if (targetId === userId) {
      const text = 'You cannot target yourself with Shade\'s Gambit.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    // Prevent targeting bots or server owner or protected roles
    try {
      const targetMember = guild ? await guild.members.fetch(targetId).catch(() => null) : null;
      if (targetMember && (targetMember.user.bot || targetMember.id === guild?.ownerId)) {
        const text = 'You cannot target that user.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
    } catch {}

    try {
      // Ensure permanent ownership
      const owned = await db.query('SELECT id FROM hi_shop_inventory WHERE user_id = $1 AND item = $2 AND expires IS NULL', [userId, 'shade_gambit']);
      if (owned.rows.length === 0) {
        const text = 'You do not own Shade\'s Gambit. Buy it with -buy shade_gambit.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      // Ensure cooldown table exists (defensive)
      await db.query(`CREATE TABLE IF NOT EXISTS shade_gambit_cooldowns (user_id TEXT PRIMARY KEY, last_used BIGINT)`);
      const cooldownRow = await db.query('SELECT last_used FROM shade_gambit_cooldowns WHERE user_id = $1', [userId]);
      const now = Date.now();
      const COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours
      if (cooldownRow.rows.length > 0) {
        const last = Number(cooldownRow.rows[0].last_used || 0);
        if (now - last < COOLDOWN) {
          const rem = Math.ceil((COOLDOWN - (now - last)) / 1000);
          const text = `Shade's Gambit is on cooldown. Try again in ${rem} seconds.`;
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
      }

      // Resolve 3 coin flips for each side immediately
      function flip3() {
        const flips = [0,0,0].map(() => Math.random() < 0.5 ? 'H' : 'T');
        const heads = flips.filter(x => x === 'H').length;
        return { flips, heads };
      }
      const userResult = flip3();
      const targetResult = flip3();
      // Determine winner by comparing heads counts (most heads wins). In tie, compare tails (equivalently), if still tie, choose random winner
      let winnerId = null;
      if (userResult.heads > targetResult.heads) winnerId = userId;
      else if (userResult.heads < targetResult.heads) winnerId = targetId;
      else {
        // tie on heads -> compare tails (which is 3 - heads)
        const userT = 3 - userResult.heads;
        const targetT = 3 - targetResult.heads;
        if (userT > targetT) winnerId = userId;
        else if (userT < targetT) winnerId = targetId;
        else {
          // exact tie, random winner
          winnerId = Math.random() < 0.5 ? userId : targetId;
        }
      }

      const loserId = winnerId === userId ? targetId : userId;

      // Apply exile to loser
      if (guild) {
        try {
          const loserMember = await guild.members.fetch(loserId).catch(() => null);
          if (loserMember) {
            await loserMember.roles.add(ROLE_IDS.exiled).catch(() => null);
            await loserMember.roles.remove(ROLE_IDS.swaggers).catch(() => null);
            await loserMember.roles.remove(ROLE_IDS.uncle).catch(() => null);
          }
        } catch (e) {}
      }
      const issuerId = userId;
      await db.query('INSERT INTO exiles (issuer, target) VALUES ($1, $2)', [issuerId, loserId]);

      // Update cooldown
      await db.query('INSERT INTO shade_gambit_cooldowns (user_id, last_used) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_used = $2', [userId, now]);

      const reply = `Shade's Gambit results:\nUser flips: ${userResult.flips.join(' ')} (heads: ${userResult.heads})\nTarget flips: ${targetResult.flips.join(' ')} (heads: ${targetResult.heads})\nWinner: <@${winnerId}> — Loser exiled: <@${loserId}>`;
      if (isInteraction) return message.reply({ content: reply });
      return message.reply(reply);
    } catch (err) {
      console.error('Shade Gambit error:', err);
      const text = 'An error occurred while using Shade\'s Gambit.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
