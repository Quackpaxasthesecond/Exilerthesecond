module.exports = {
  name: 'inventory',
  description: 'Show your shop inventory',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { db } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const userId = message.author?.id || message.user?.id;
    const shopHelpers = require('../lib/shopHelpers');
    try {
      const res = await db.query('SELECT item, metadata, expires, created_at FROM hi_shop_inventory WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      if (res.rows.length === 0) {
        const text = 'Your inventory is empty.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
      const lines = res.rows.map(r => {
        const item = r.item;
        const expires = r.expires ? new Date(Number(r.expires)).toLocaleString() : 'never';
        return `${item} - expires: ${expires}`;
      });
      const text = 'Your inventory:\n' + lines.join('\n');
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    } catch (err) {
      console.error(err);
      const text = 'Could not fetch your inventory.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
