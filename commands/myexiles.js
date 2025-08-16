module.exports = {
  name: 'myexiles',
  description: 'Show how many people you exiled (mods/admins only)',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { db, ROLE_IDS, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-myexiles', message, message.member)) return;
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("buddy you are not a moderator. slow down 😅😅😅");
    }
    try {
      const res = await db.query(
        `SELECT COUNT(*) as count FROM exiles WHERE issuer = $1`,
        [message.author.id]
      );
      const count = res.rows[0].count;
      message.reply(`you've murdered ${count} people.`);
    } catch (err) {
      console.error(err);
      message.reply('Error checking your exile record.');
    }
  }
};
