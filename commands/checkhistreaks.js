module.exports = {
  name: 'checkhistreaks',
  description: 'Check your (or another user’s) current hi streak',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to check streak for',
      type: 6,
      required: false
    }
  ],
  execute: async (message, args, context) => {
    const { hiStreaks } = context;
    const userId = message.mentions.users.first()?.id || message.author.id;
    const streak = hiStreaks[userId]?.streak || 0;
    const user = message.mentions.users.first() || message.author;
    if (streak > 0) {
      message.channel.send(`${user.username} is on a HI streak of ${streak}!`);
    } else {
      message.channel.send(`${user.username} does not have a HI streak right now.`);
    }
  }
};
