module.exports = {
  name: 'resetleaderboard',
  description: 'Reset a user’s leaderboard score (owner only)',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to reset leaderboard for',
      type: 6,
      required: true
    }
  ],
  execute: async (message, args, context) => {
    const { db, checkCooldown, confirmAction } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-resetleaderboard', message, message.member)) return;
    if (message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = "Only the server owner can reset exile records.";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const target = message.mentions.members.first();
    if (!target) {
      const text = 'Please mention a valid user to reset their leaderboard score.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to reset all exiles for ${target.user.username}.`);
    if (!confirmed) {
      const text = 'Action cancelled.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    }
    try {
      await db.query(`DELETE FROM exiles WHERE target = $1`, [target.id]);
      const text = `Leaderboard record reset for ${target.user.username}.`;
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.channel.send(text);
    } catch (err) {
      console.error(err);
      const text = 'An error occurred while resetting the leaderboard record.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
