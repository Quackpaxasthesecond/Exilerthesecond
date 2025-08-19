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
      hi_mult: { cost: 2000, durationMs: 60 * 60 * 1000 },
      extra_luck: { cost: 600, durationMs: 60 * 60 * 1000 },
  // random_exile removed
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

      const now = Date.now();

      // Check user's hi balance
      const usageRes = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [buyerId]);
      const hiCount = usageRes.rows[0]?.count || 0;
      if (hiCount < chosen.cost) {
        const text = 'You do not have enough hi to purchase that item.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      // Handle permanent, single-stock item: killwitari
      if (item === 'killwitari') {
        const owned = await db.query('SELECT id FROM hi_shop_inventory WHERE user_id = $1 AND item = $2 AND expires IS NULL', [buyerId, 'killwitari']);
        if (owned.rows.length > 0) {
          const text = 'You already own Killwitari (one per user).';
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        // Deduct cost and record permanent purchase
        await db.query('UPDATE hi_usages SET count = count - $1 WHERE user_id = $2', [chosen.cost, buyerId]);
        const insertRes = await db.query('INSERT INTO hi_shop_inventory (user_id, item, metadata, expires, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id', [buyerId, 'killwitari', JSON.stringify({}), null, now]);
        const insertedId = insertRes.rows[0]?.id || null;
        const text = `Successfully purchased Killwitari for ${chosen.cost} hi.${insertedId ? ` (purchase id: ${insertedId})` : ''}`;
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      // Timed items (hi_mult, extra_luck)
      const expires = chosen.durationMs ? now + chosen.durationMs : null;
      const metadata = item === 'extra_luck' ? JSON.stringify({ luck: 10 }) : (item === 'hi_mult' ? JSON.stringify({ multiplier: 2 }) : JSON.stringify({}));

      // Deduct cost and insert inventory row
      await db.query('UPDATE hi_usages SET count = count - $1 WHERE user_id = $2', [chosen.cost, buyerId]);
      const insertRes2 = await db.query('INSERT INTO hi_shop_inventory (user_id, item, metadata, expires, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id', [buyerId, item, metadata, expires, now]);
      const insertedId2 = insertRes2.rows[0]?.id || null;

      if (item === 'extra_luck') {
        const current = await shopHelpers.getActiveEffects(db, buyerId).catch(() => ({}));
        const totalLuck = current && current.extra_luck ? current.extra_luck : 0;
        const text = `Successfully purchased extra_luck (+10%). Your current total luck bonus is now ${totalLuck}% for gambling calculations.${insertedId2 ? ` (purchase id: ${insertedId2})` : ''}`;
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      const text = `Successfully purchased ${item}.${insertedId2 ? ` (purchase id: ${insertedId2})` : ''}`;
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
