const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'streakleader',
  description: 'Show the top users with the highest current hi streaks',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { hiStreaks } = context;
    // Build a leaderboard of top hi streaks (current, not all-time)
    const streakArray = Object.entries(hiStreaks)
      .filter(([id, s]) => s.streak > 0)
      .sort((a, b) => b[1].streak - a[1].streak)
      .slice(0, 10);
    if (streakArray.length === 0) {
      return message.channel.send('No hi streaks have been recorded yet.');
    }
    let leaderboard = '**HI Streak Leaderboard**\n';
    for (let i = 0; i < streakArray.length; i++) {
      let member;
      try {
        member = await message.guild.members.fetch(streakArray[i][0]);
      } catch {
        member = null;
      }
      const name = member ? member.user.username : `Unknown (${streakArray[i][0]})`;
      leaderboard += `${i + 1}. ${name} - ${streakArray[i][1].streak} streak\n`;
    }
    const embed = new EmbedBuilder()
      .setTitle('HI Streak Leaderboard')
      .setDescription(leaderboard)
      .setColor(0x00b894);
    message.channel.send({ embeds: [embed] });
  }
};
