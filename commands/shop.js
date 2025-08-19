module.exports = {
  name: 'shop',
  description: 'View the HI shop and available items',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { EmbedBuilder } = require('discord.js');
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const embed = new EmbedBuilder()
      .setTitle('HI Shop')
      .setDescription('Exchange your HI for temporary boosts and effects.')
      .addFields(
  { name: 'hi_mult', value: 'x2 HI for 60 minutes  Cost: 2,000 hi', inline: false },
  { name: 'extra_luck', value: '+10% gamble luck for 60 minutes   Cost: 600 hi', inline: false },
  { name: 'cavendish', value: 'Permanent ability: 3x HI gain; 1/6 chance to be destroyed (increases with luck) — Cost: 750 hi', inline: false },
  { name: 'predictor', value: 'Permanent ability: every 4th gamble reveals the outcome in advance — Cost: 50,000 hi', inline: false },
  { name: 'killwitari', value: 'Permanent ability: kills witari — Cost: 200,000 hi — good luck buying it', inline: false }
      )
      .setFooter({ text: 'Use -buy <item> to purchase. Example: -buy extra_luck' });

    if (isInteraction) return message.reply({ embeds: [embed], ephemeral: true });
    return message.reply({ embeds: [embed] });
  }
};
