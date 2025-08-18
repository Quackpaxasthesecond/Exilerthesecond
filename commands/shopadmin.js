module.exports = {
  name: 'shopadmin',
  description: 'Admin: list purchases, revoke an item, or refund hi',
  slash: true,
  options: [
    { name: 'action', description: 'list|revoke|refund', type: 3, required: true },
    { name: 'user', description: 'Target user id or mention (for revoke/refund)', type: 6, required: false },
    { name: 'id', description: 'Inventory id (for revoke/refund)', type: 4, required: false },
    { name: 'amount', description: 'Amount to refund (for refund)', type: 4, required: false }
  ],
  execute: async (message, args, context) => {
    const { db } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (!message.guild || message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = 'Only the server owner can use this command.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const action = isInteraction ? args.getString('action') : args[0];
    if (action === 'list') {
      const target = isInteraction ? (args.getUser('user') && args.getUser('user').id) : (args[1] && args[1].replace(/[^0-9]/g, ''));
      if (!target) {
        const text = 'Usage: shopadmin list <user>';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
      try {
        const res = await db.query('SELECT id, item, metadata, expires, created_at FROM hi_shop_inventory WHERE user_id = $1 ORDER BY created_at DESC', [target]);
        if (res.rows.length === 0) {
          const text = 'No purchases for that user.';
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        const lines = res.rows.map(r => `${r.id}: ${r.item} (expires: ${r.expires ? new Date(Number(r.expires)).toLocaleString() : 'never'})`);
        const text = 'Purchases:\n' + lines.join('\n');
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      } catch (e) {
        console.error(e);
        const text = 'Error listing purchases.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
    }
    if (action === 'revoke' || action === 'refund') {
      // prefix form: shopadmin revoke <id> [amount]
      const id = isInteraction ? args.getInteger('id') : parseInt(args[1], 10);
      if (!id) {
        const text = 'Usage: shopadmin revoke|refund <id> [amount]';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
      try {
        const res = await db.query('SELECT * FROM hi_shop_inventory WHERE id = $1', [id]);
        if (res.rows.length === 0) return message.reply('No such purchase id.');
        const row = res.rows[0];
        await db.query('DELETE FROM hi_shop_inventory WHERE id = $1', [id]);
        if (action === 'refund') {
          const amount = isInteraction ? args.getInteger('amount') : parseInt(args[2], 10);
          if (!amount || isNaN(amount) || amount <= 0) return message.reply('Specify a positive refund amount.');
          await db.query('UPDATE hi_usages SET count = COALESCE(count,0) + $1 WHERE user_id = $2', [amount, row.user_id]);
          const text = `Refunded ${amount} hi to <@${row.user_id}> and revoked purchase ${id}.`;
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        const text = `Revoked purchase ${id} for <@${row.user_id}>.`;
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      } catch (e) {
        console.error(e);
        const text = 'Error modifying purchase.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
    }
    const help = 'Usage: shopadmin list <user> | shopadmin revoke <id> | shopadmin refund <id> <amount>';
    if (isInteraction) return message.reply({ content: help, ephemeral: true });
    return message.reply(help);
  }
};
