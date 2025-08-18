module.exports = {
  name: 'buy',
  description: 'Buy an item from the HI shop',
  slash: true,
  options: [
    { name: 'item', description: 'Item key to buy', type: 3, required: true }
  ],
  execute: async (message, args, context) => {
    const { db, ROLE_IDS, timers } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const buyerId = message.author?.id || message.user?.id;
    const guild = message.guild;

    let item = null;
    if (isInteraction) item = args.getString('item'); else item = args[0];
    if (!item) {
      const text = 'Usage: -buy <item>';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }

    const items = {
      xp_multiplier: { cost: 2000, durationMs: 60 * 60 * 1000 },
      extra_luck: { cost: 600, durationMs: 60 * 60 * 1000 },
      random_exile: { cost: 5000, durationMs: 10 * 60 * 1000 },
      // permanent special ability that requires admin-revocation to remove
      killwitari: { cost: 200000, durationMs: null }
    };

    const chosen = items[item];
    if (!chosen) {
      const text = 'Unknown item. Use -shop to see available items.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }

  const shopHelpers = require('../lib/shopHelpers');
  try {
      // Ensure the inventory table exists (defensive; migration should handle this)
      await db.query(`
        CREATE TABLE IF NOT EXISTS hi_shop_inventory (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          item TEXT NOT NULL,
          metadata JSONB,
          expires BIGINT,
          created_at BIGINT NOT NULL
        )
      `);

      // check balance
      const res = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [buyerId]);
      const balance = res.rows[0] ? Number(res.rows[0].count) : 0;
      if (balance < chosen.cost) {
        const text = `You need ${chosen.cost} hi to buy ${item}. You have ${balance} hi.`;
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      // deduct hi
      await db.query('UPDATE hi_usages SET count = GREATEST(count - $1, 0) WHERE user_id = $2', [chosen.cost, buyerId]);

      const now = Date.now();
      if (item === 'random_exile') {
        // pick random eligible member
        if (!guild) {
          const text = 'Guild context required for random_exile.';
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        const members = await guild.members.fetch().catch(() => null);
        if (!members) {
          const text = 'Could not fetch guild members.';
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        const pool = members.filter(m => !m.user.bot && m.id !== buyerId && m.id !== guild.ownerId).map(m => m);
        if (pool.length === 0) {
          const text = 'No eligible member found to exile.';
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        const target = pool[Math.floor(Math.random() * pool.length)];
        // add exiled role
        await target.roles.add(ROLE_IDS.exiled).catch(() => null);
        // schedule unexile
        const timeoutMs = chosen.durationMs;
        const timeout = setTimeout(async () => {
          const refreshed = await (guild.members.fetch(target.id).catch(() => null));
          if (refreshed && refreshed.roles.cache.has(ROLE_IDS.exiled)) {
            await refreshed.roles.remove(ROLE_IDS.exiled).catch(() => null);
          }
          if (timers && timers.has) timers.delete && timers.delete(target.id);
        }, timeoutMs);
        if (timers && timers.set) timers.set(target.id, timeout);

  // record inventory/action and return id
  const insertRes = await db.query('INSERT INTO hi_shop_inventory (user_id, item, metadata, expires, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id', [buyerId, item, JSON.stringify({ target: target.id }), now + chosen.durationMs, now]);
  const insertedId = insertRes.rows[0] ? insertRes.rows[0].id : null;

  const text = `You exchanged ${chosen.cost} hi to exile ${target.user.username} for ${Math.round(chosen.durationMs/60000)} minutes.${insertedId ? ` (purchase id: ${insertedId})` : ''}`;
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

    // for other items, add inventory entry
    const expires = chosen.durationMs ? now + chosen.durationMs : null;
    // For extra_luck, store luck as percentage points in metadata (default 10)
    const metadata = item === 'extra_luck' ? JSON.stringify({ luck: 10 }) : JSON.stringify({});
  const insertRes = await db.query('INSERT INTO hi_shop_inventory (user_id, item, metadata, expires, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id', [buyerId, item, metadata, expires, now]);
  const insertedId = insertRes.rows[0] ? insertRes.rows[0].id : null;
  // If buying extra_luck, compute user's current total luck and show it
  if (item === 'extra_luck') {
    const shopHelpers = require('../lib/shopHelpers');
    const current = await shopHelpers.getActiveEffects(db, buyerId).catch(() => ({}));
    const totalLuck = current && current.extra_luck ? current.extra_luck : 0;
    const text = `Successfully purchased extra_luck (+10%). Your current total luck bonus is now ${totalLuck}% for gambling and random exile calculations.${insertedId ? ` (purchase id: ${insertedId})` : ''}`;
    if (isInteraction) return message.reply({ content: text, ephemeral: true });
    return message.reply(text);
  }
  const text = `Successfully purchased ${item}.${insertedId ? ` (purchase id: ${insertedId})` : ''}`;
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    } catch (err) {
      console.error(err);
      const text = 'An error occurred while processing your purchase.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
