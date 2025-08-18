module.exports = {
  name: 'revokeperma',
  description: 'Admin: revoke a permanent shop item from a user (new command).',
  slash: true,
  options: [
    { name: 'user', description: 'User to revoke from', type: 6, required: true },
    { name: 'item', description: 'Item key to revoke (e.g. killwitari)', type: 3, required: true }
  ],
  execute: async (message, args, context) => {
    const { db } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const invokerId = message.author?.id || message.user?.id;
    // Only allow server owner or admin role to run
    if (!message.guild) return message.reply('This command must be run in a guild.');
    const member = message.member;
    const isOwner = message.guild.ownerId === invokerId;
    const isAdmin = member && member.roles && member.roles.cache && (member.roles.cache.has(context.ROLE_IDS?.admin) || member.roles.cache.has(context.ROLE_IDS?.mod));
    if (!isOwner && !isAdmin) {
      const text = 'Only server owner or admins may revoke permanent items.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }

    const target = isInteraction ? args.getUser('user') : message.mentions.users.first();
    const item = isInteraction ? args.getString('item') : args[1];
    if (!target || !item) {
      const text = 'Usage: /revokeperma <user> <item>';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }

    try {
      // Delete inventory entries for this permanent item (expires IS NULL)
      const del = await db.query('DELETE FROM hi_shop_inventory WHERE user_id = $1 AND item = $2 AND expires IS NULL RETURNING id', [target.id, item]);
      if (del.rows.length === 0) {
        const text = `No permanent '${item}' found for <@${target.id}>.`;
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      // If the item has persistent cooldowns or other side tables, clean them
      if (item === 'killwitari') {
        await db.query('DELETE FROM killwitari_cooldowns WHERE user_id = $1', [target.id]);
      }

      const text = `Revoked permanent '${item}' from <@${target.id}> (removed ${del.rows.length} record(s)).`;
      if (isInteraction) return message.reply({ content: text, ephemeral: false });
      return message.reply(text);
    } catch (e) {
      console.error(e);
      const text = 'Error revoking permanent item.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
