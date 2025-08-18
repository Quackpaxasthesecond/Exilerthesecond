module.exports = {
  name: 'shop',
  description: 'View the HI shop and available items',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const text = `Available shop items:\n\n` +
      `1) xp_multiplier - x2 XP for 60 minutes (cost: 50000 hi)\n` +
      `2) extra_luck - +10 luck for 60 minutes (cost: 25000 hi)\n` +
      `3) random_exile - Exile a random member for 10 minutes (cost: 100000 hi)\n\n` +
      `To purchase: -buy <item>\n` +
      `Examples:\n` +
      `-buy xp_multiplier\n` +
      `-buy random_exile`;

    if (isInteraction) return message.reply({ content: text, ephemeral: true });
    return message.reply(text);
  }
};
