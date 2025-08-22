module.exports = {
  name: 'killwitari',
  description: 'Killwitari is disabled.',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const text = 'Killwitari has been disabled and removed from the shop.';
    if (isInteraction) return message.reply({ content: text, ephemeral: true });
    return message.reply(text);
  }
};
