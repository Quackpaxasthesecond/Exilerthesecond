module.exports = {
  name: 'currenthi',
  description: 'Show your current hi, streak, and chain',
  slash: true,
  publicSlash: true,
  postToChannel: false,
  options: [],
  execute: async (message, args, context) => {
    const { db } = context;
    const userId = message.author.id;
    // Get hi count
    const hiRes = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [userId]);
    const hiCount = hiRes.rows[0]?.count || 0;
    // Get streak
    const streakRes = await db.query('SELECT streak FROM hi_streaks WHERE user_id = $1', [userId]);
    const streak = streakRes.rows[0]?.streak || 0;
    // Get chain (guild-wide)
    const chainRes = await db.query('SELECT chain_count FROM hi_chains WHERE guild_id = $1', [message.guild.id]);
    const chain = chainRes.rows[0]?.chain_count || 0;
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`Current hi: ${hiCount}\nCurrent streak: ${streak}\nCurrent chain: ${chain}`);
  return message.reply(`Current hi: ${hiCount}\nCurrent streak: ${streak}\nCurrent chain: ${chain}`);
  }
};
