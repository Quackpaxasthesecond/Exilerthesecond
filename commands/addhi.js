module.exports = {
  name: 'addhi',
  execute: async (message, args, context) => {
    const { db, checkCooldown } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-addhi', message, message.member)) return;
    if (message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = "Only the server owner can modify hi records.";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      const text = "Usage: `-addhi @user <positive number>`";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    try {
      await db.query(`INSERT INTO hi_usages (user_id, count) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + $2`, [target.id, amount]);
  const text = `Added ${amount} hi to ${target.user.username}.`;
  if (isInteraction) return message.reply({ content: text, ephemeral: true });
  return message.channel.send(text);
    } catch (err) {
      console.error(err);
      const text = 'Error adding hi entries.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
