module.exports = {
  name: 'currentchain',
  description: 'Show the current and record hi chain for the server',
  slash: true,
  publicSlash: true,
  postToChannel: false,
  options: [],
  execute: async (message, args, context) => {
    const { db } = context;
    const guildId = message.guild.id;
    const res = await db.query('SELECT chain_count, chain_record FROM hi_chains WHERE guild_id = $1', [guildId]);
    const chain = res.rows[0]?.chain_count || 0;
    const record = res.rows[0]?.chain_record || 0;
    if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`Current HI chain: ${chain}\nHI chain record: ${record}`);
    return message.reply(`Current HI chain: ${chain}\nHI chain record: ${record}`);
  }
};
