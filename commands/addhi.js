module.exports = {
  name: 'addhi',
  execute: async (message, args, context) => {
    const { db, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-addhi', message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can modify hi records.");
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply("Usage: `-addhi @user <positive number>`");
    }
    try {
      await db.query(`INSERT INTO hi_usages (user_id, count) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + $2`, [target.id, amount]);
      message.channel.send(`Added ${amount} hi to ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('Error adding fake hi entries.');
    }
  }
};
