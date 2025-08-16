module.exports = {
  name: 'help',
  description: 'Show help for all commands',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { checkCooldown } = context;
    if (checkCooldown(message.author.id, 'help', message)) return;

    const helpMessage = `
**Bot Commands:**
- \`-exile @user [minutes]\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-myexiles\` : Show how many people you exiled (mods/admins only)
- \`-leaderboard\` : Show the top exiled users
- \`-hi\` : Use this for random fun! Try it often for streaks, combos, and roasts.
- \`-hilb\` : Show the top users who used -hi
- \`-hiduel @user\` : Challenge someone to a HI DUEL. Most -hi's in 1 minute wins (at least 60 hi's bonus!)
- \`-acceptduel\` : Accept a HI DUEL challenge. (Type this after being challenged)
- \`-checkhistreaks [@user]\` : Check your (or another user's) current hi streak. Streak resets if you don't use -hi for 12 hours.
- \`-streakleader\` : Show the top users with the highest current hi streaks
- \`-gamble <amount>\` : Bet your hi count for a 50/50 chance to double or lose the amount.
- \`-currenthi\` : Show your current hi, streak, and chain
- \`-currentchain\` : Show the current and record hi chain for the server
- \`-hidonate @user <amount>\` : Donate your hi count to another user

**Hi Command Features:**
- **Hi Streaks:** Use -hi repeatedly (within 12 hours) to build your personal streak.
- **Hi Combo:** Multiple users using -hi in a short time triggers a HI COMBO!
- **Hi Chain:** Use -hi quickly after someone else to build a chain and break records.
- **Hi Transfer:** Use -hidonate to give your hi to someone else.
- **Hi Duel:** Challenge another user to a hi duel. Use -hiduel @user to start, and -acceptduel to accept. Most -hi's in 1 minute wins. Bonus for 60+ hi's!
    `;
    message.channel.send(helpMessage);
  }
};
