const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'hilb',
  description: 'Show the top users who used -hi',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { db, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-hileaderboard', message, message.member)) return;
    try {
      const res = await db.query(
        `SELECT user_id, count FROM hi_usages ORDER BY count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
        return message.channel.send('No hi have been recorded yet.');
      }
      let leaderboard = '';
      for (let i = 0; i < res.rows.length; i++) {
        let member;
        try {
          member = await message.guild.members.fetch(res.rows[i].user_id);
        } catch {
          member = null;
        }
        const name = member ? member.user.username : `Unknown (${res.rows[i].user_id})`;
        leaderboard += `${i + 1}. ${name} - ${res.rows[i].count} hi\n`;
      }
      const embed = new EmbedBuilder()
        .setTitle('HI Leaderboard')
        .setDescription(leaderboard)
        .setColor(0x00b894);
      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.channel.send('An error occurred while fetching the hi leaderboard.');
    }
  }
};
