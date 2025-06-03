module.exports = {
  name: 'unexile',
  execute: async (message, args, context) => {
    const { db, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-unexile', message, message.member)) return;
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("nice try buddy");
    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to unexile.');
    if (!target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.username} is not exiled!`);
    try {
      await target.roles.remove(ROLE_IDS.exiled);
      const isUncle = SPECIAL_MEMBERS.includes(target.id);
      const isSwagger = SWAGGER_MEMBERS.includes(target.id);
      if (isUncle && isSwagger) {
        await target.roles.add([ROLE_IDS.uncle, ROLE_IDS.swaggers]);
        message.channel.send(`${target.user.username} the unc has been unexiled. with their lil swag too ig `);
      } else if (isUncle) {
        await target.roles.add(ROLE_IDS.uncle);
        message.channel.send(`${target.user.username} the unc has been unexiled`);
      } else if (isSwagger) {
        await target.roles.add(ROLE_IDS.swaggers);
        message.channel.send(`${target.user.username} has been unexiled. with their lil swag too ig`);
      } else {
        message.channel.send(`${target.user.username} has been unexiled.`);
      }
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while trying to unexile the user.');
    }
  }
};
