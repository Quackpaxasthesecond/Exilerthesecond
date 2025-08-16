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
    if (checkCooldown(message.author.id, '-removehi', message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can modify hi records.");
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply("Usage: `-removehi @user <positive number>`");
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to remove up to ${amount} hi from ${target.user.username}.`);
    if (!confirmed) return message.channel.send('Action cancelled.');
    try {
      // Remove up to the specified amount from the user's hi_usages count
      await db.query('UPDATE hi_usages SET count = GREATEST(count - $1, 0) WHERE user_id = $2', [amount, target.id]);
      message.channel.send(`Removed up to ${amount} hi from ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('Error removing hi entries.');
    }
  }
};
