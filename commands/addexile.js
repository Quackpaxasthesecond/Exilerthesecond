module.exports = {
  name: 'addexile',
  description: 'Add exiles to a user (owner only)',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to add exiles to',
      type: 6,
      required: true
    },
    {
      name: 'amount',
      description: 'Number of exiles to add',
      type: 4,
      required: true
    }
  ],
  execute: async (message, args, context) => {
    const { db, checkCooldown } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-addexile', message, message.member)) return;
    if (message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = "Only the server owner can modify leaderboard records.";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      const text = "Usage: `-addexile @user <positive number>`";
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    try {
      const values = [];
      for (let i = 0; i < amount; i++) {
        values.push(`('${message.author.id}', '${target.id}')`);
      }
      await db.query(`INSERT INTO exiles (issuer, target) VALUES ${values.join(',')}`);
  const text = `Added ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`;
  if (isInteraction) return message.reply({ content: text, ephemeral: true });
  return message.channel.send(text);
    } catch (err) {
      console.error(err);
      const text = 'Error adding exile entries.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
