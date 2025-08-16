const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'leaderboard',
  description: 'Show the top exiled users',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { db, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-leaderboard', message, message.member)) return;
    try {
      const res = await db.query(
        `SELECT target, COUNT(*) as exile_count FROM exiles GROUP BY target ORDER BY exile_count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
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
      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.channel.send('An error occurred while fetching the leaderboard.');
    }
  }
};
