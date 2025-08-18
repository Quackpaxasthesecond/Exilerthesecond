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
        { name: 'xp_multiplier', value: 'x2 XP for 60 minutes — Cost: 50,000 hi', inline: false },
        { name: 'extra_luck', value: '+10% gamble luck for 60 minutes — Cost: 25,000 hi', inline: false },
        { name: 'random_exile', value: 'Exile a random eligible member for 10 minutes — Cost: 100,000 hi', inline: false },
         { name: 'killwitari', value: 'Permanent ability: kills witari — Cost: 200,000 hi — good luck buying it', inline: false }
      )
  .setFooter({ text: 'Use -buy <item> to purchase. Example: -buy extra_luck — Admins can revoke permanent items with shopadmin revokeperma <user> <item>' });

    if (isInteraction) return message.reply({ embeds: [embed], ephemeral: true });
    return message.reply({ embeds: [embed] });
  }
};
