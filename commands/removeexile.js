module.exports = {
  name: 'removeexile',
  execute: async (message, args, context) => {
    const { db, checkCooldown, confirmAction } = context;
    if (checkCooldown(message.author.id, '-removeexile', message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can modify leaderboard records.");
    }
    const target = message.mentions.members.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply("Usage: `-removeexile @user <positive number>`");
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to remove up to ${amount} exiles for ${target.user.username}.`);
    if (!confirmed) return message.channel.send('Action cancelled.');
    try {
      await db.query(
        `DELETE FROM exiles WHERE id IN (
          SELECT id FROM exiles WHERE target = $1 ORDER BY timestamp ASC LIMIT $2
        )`,
        [target.id, amount]
      );
      message.channel.send(`Removed up to ${amount} exile${amount > 1 ? 's' : ''} for ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('Error removing exile entries.');
    }
  }
};
