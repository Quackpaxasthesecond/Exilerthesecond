const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'leaderboard',
  description: 'Show the top exiled users',
  slash: true,
  publicSlash: true,
  postToChannel: false,
  options: [],
  execute: async (message, args, context) => {
    const { db, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-leaderboard', message, message.member)) return;
    try {
      const res = await db.query(
        `SELECT target, COUNT(*) as exile_count FROM exiles GROUP BY target ORDER BY exile_count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
        if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply('No exiles have been recorded yet.');
        return message.channel.send('No exiles have been recorded yet.');
      }
      let leaderboard = '**Exile Leaderboard <:crying:1285606636853137560>**:\n';
      for (let i = 0; i < res.rows.length; i++) {
        const member = await message.guild.members.fetch(res.rows[i].target).catch(() => null);
        const name = member ? member.user.username : `Unknown (${res.rows[i].target})`;
        leaderboard += `${i + 1}. ${name} - ${res.rows[i].exile_count} exiles\n`;
      }
      const embed = new EmbedBuilder()
        .setDescription(leaderboard)
        .setColor(0x7289da);
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply({ embeds: [embed] });
  return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply('An error occurred while fetching the leaderboard.');
      return message.channel.send('An error occurred while fetching the leaderboard.');
    }
  }
};
