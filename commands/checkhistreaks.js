module.exports = {
  name: 'checkhistreaks',
  description: 'Check your (or another user’s) current hi streak',
  slash: true,
  // prefer editing/replying to the interaction instead of posting to channel
  publicSlash: true,
  postToChannel: false,
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
  const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
  // Prefer the interaction/options user when invoked as a slash command, otherwise use mention/author
  const user = isInteraction ? (args.getUser ? args.getUser('user') || message.user : message.user) : (message.mentions?.users?.first() || message.author);
  const userId = user.id;
  const streak = hiStreaks[userId]?.streak || 0;
    if (streak > 0) {
      if (isInteraction || module.exports.postToChannel === false) return message.reply(`${user.username} is on a HI streak of ${streak}!`);
      return message.channel.send(`${user.username} is on a HI streak of ${streak}!`);
    } else {
      if (isInteraction || module.exports.postToChannel === false) return message.reply(`${user.username} does not have a HI streak right now.`);
      return message.channel.send(`${user.username} does not have a HI streak right now.`);
    }
  }
};
