module.exports = {
  name: 'help',
  execute: async (message, args, context) => {
    const { checkCooldown } = context;
    if (checkCooldown(message.author.id, 'help', message)) return;

    const helpMessage = `
**Bot Commands:**
- \`-exile @user [minutes]\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-myexiles\` : Show how many people you exiled (mods/admins only)
- \`-leaderboard\` : Show the top exiled users
- \`-hi\` : Random stuff
- \`-hileaderboard\` : Show the top users who used -hi
    `;
    message.channel.send(helpMessage);
  }
};
