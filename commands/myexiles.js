module.exports = {
  name: 'myexiles',
  description: 'Show how many people you exiled (mods/admins only)',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { db, ROLE_IDS, checkCooldown } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-myexiles', message, message.member)) return;
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      const text = "buddy you are not a moderator. slow down 😅😅😅";
      // Keep this message public even for slash invocations (mods/admins only command)
      return message.reply(text);
    }
    try {
      const res = await db.query(
        `SELECT COUNT(*) as count FROM exiles WHERE issuer = $1`,
        [message.author.id]
      );
      const count = res.rows[0].count;
      const text = `you've murdered ${count} people.`;
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    } catch (err) {
      console.error(err);
      const text = 'Error checking your exile record.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
