module.exports = {
  name: 'removehi',
  description: 'Remove hi from a user (owner only)',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to remove hi from',
      type: 6,
      required: true
    },
    {
      name: 'amount',
      description: 'Amount of hi to remove',
      type: 4,
      required: true
    }
  ],
  execute: async (message, args, context) => {
    const { db, checkCooldown, confirmAction } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-removehi', message, message.member)) return;
    if (message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = "Only the server owner can modify hi records.";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      const text = "Usage: `-removehi @user <positive number>`";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to remove up to ${amount} hi from ${target.user.username}.`);
    if (!confirmed) {
      const text = 'Action cancelled.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    }
    try {
      // Remove up to the specified amount from the user's hi_usages count
      await db.query('UPDATE hi_usages SET count = GREATEST(count - $1, 0) WHERE user_id = $2', [amount, target.id]);
      const text = `Removed up to ${amount} hi from ${target.user.username}.`;
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    } catch (err) {
      console.error(err);
      const text = 'Error removing hi entries.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
