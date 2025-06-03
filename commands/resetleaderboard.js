module.exports = {
  name: 'resetleaderboard',
  execute: async (message, args, context) => {
    const { db, checkCooldown, confirmAction } = context;
    if (checkCooldown(message.author.id, '-resetleaderboard', message, message.member)) return;
    if (message.guild.ownerId !== message.author.id) {
      return message.reply("Only the server owner can reset exile records.");
    }
    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('Please mention a valid user to reset their leaderboard score.');
    }
    const confirmed = await confirmAction(message, `Type \`yes\` to reset all exiles for ${target.user.username}.`);
    if (!confirmed) return message.channel.send('Action cancelled.');
    try {
      await db.query(`DELETE FROM exiles WHERE target = $1`, [target.id]);
      message.channel.send(`Leaderboard record reset for ${target.user.username}.`);
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while resetting the leaderboard record.');
    }
  }
};
