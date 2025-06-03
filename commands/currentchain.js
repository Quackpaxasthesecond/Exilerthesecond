module.exports = {
  name: 'currentchain',
  execute: async (message, args, context) => {
    const { db } = context;
    const guildId = message.guild.id;
    const res = await db.query('SELECT chain_count, chain_record FROM hi_chains WHERE guild_id = $1', [guildId]);
    const chain = res.rows[0]?.chain_count || 0;
    const record = res.rows[0]?.chain_record || 0;
    message.reply(`Current HI chain: ${chain}\nHI chain record: ${record}`);
  }
};
