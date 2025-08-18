module.exports = {
  name: 'removeexile',
  description: 'Remove exiles from a user (owner only)',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to remove exiles from',
      type: 6,
      required: true
    },
    {
      name: 'amount',
      description: 'Number of exiles to remove',
      type: 4,
      required: true
    }
  ],
  execute: async (message, args, context) => {
    const { db, checkCooldown, confirmAction } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-removeexile', message, message.member)) return;
    if (message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = "Only the server owner can modify leaderboard records.";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      const text = "Usage: `-removeexile @user <positive number>`";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to remove up to ${amount} exiles for ${target.user.username}.`);
    if (!confirmed) {
      const text = 'Action cancelled.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    }
    try {
      await db.query(
        `DELETE FROM exiles WHERE id IN (
          SELECT id FROM exiles WHERE target = $1 ORDER BY timestamp ASC LIMIT $2
        )`,
        [target.id, amount]
      );
      const text = `Removed up to ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`;
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    } catch (err) {
      console.error(err);
      const text = 'Error removing exile entries.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
