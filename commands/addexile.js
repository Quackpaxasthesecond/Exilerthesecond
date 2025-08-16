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
    if (checkCooldown(message.author.id, '-addexile', message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can modify leaderboard records.");
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply("Usage: `-addexile @user <positive number>`");
    }
    try {
      const values = [];
      for (let i = 0; i < amount; i++) {
        values.push(`('${message.author.id}', '${target.id}')`);
      }
      await db.query(`INSERT INTO exiles (issuer, target) VALUES ${values.join(',')}`);
      message.channel.send(`Added ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('Error adding fake exile entries.');
    }
  }
};
