const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'hilb',
  description: 'Show the top users who used -hi',
  slash: true,
  publicSlash: true,
  postToChannel: false,
  options: [],
  execute: async (message, args, context) => {
  const { db, checkCooldown } = context;
  const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
  if (checkCooldown(message.author.id, '-hileaderboard', message, message.member)) return;
    try {
      const res = await db.query(
        `SELECT user_id, count FROM hi_usages ORDER BY count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
        if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply('No hi have been recorded yet.');
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
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply({ embeds: [embed] });
  return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply('An error occurred while fetching the hi leaderboard.');
      return message.channel.send('An error occurred while fetching the hi leaderboard.');
    }
  }
};
