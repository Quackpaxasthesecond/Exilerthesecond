module.exports = {
  name: 'unexile',
  description: 'Unexile a user (mods/admins only)',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to unexile',
      type: 6, // USER
      required: true
    }
  ],
  execute: async (message, args, context) => {
    const { db, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, checkCooldown } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    if (checkCooldown(message.author.id, '-unexile', message, message.member)) return;
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      const text = "nice try buddy";
      // public even for interactions
      return message.reply(text);
    }
    const target = message.mentions.members.first();
    if (!target) {
      const text = 'Please mention a valid user to unexile.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    if (!target.roles.cache.has(ROLE_IDS.exiled)) {
      const text = `${target.user.username} is not exiled!`;
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    try {
      await target.roles.remove(ROLE_IDS.exiled);
      const isUncle = SPECIAL_MEMBERS.includes(target.id);
      const isSwagger = SWAGGER_MEMBERS.includes(target.id);
      if (isUncle && isSwagger) {
        await target.roles.add([ROLE_IDS.uncle, ROLE_IDS.swaggers]);
  if (message._isFromInteraction || module.exports.postToChannel === false) message.reply(`${target.user.username} the unc has been unexiled. with their lil swag too ig `); else message.channel.send(`${target.user.username} the unc has been unexiled. with their lil swag too ig `);
      } else if (isUncle) {
        await target.roles.add(ROLE_IDS.uncle);
  if (message._isFromInteraction || module.exports.postToChannel === false) message.reply(`${target.user.username} the unc has been unexiled`); else message.channel.send(`${target.user.username} the unc has been unexiled`);
      } else if (isSwagger) {
        await target.roles.add(ROLE_IDS.swaggers);
  if (message._isFromInteraction || module.exports.postToChannel === false) message.reply(`${target.user.username} has been unexiled. with their lil swag too ig`); else message.channel.send(`${target.user.username} has been unexiled. with their lil swag too ig`);
      } else {
  if (message._isFromInteraction || module.exports.postToChannel === false) message.reply(`${target.user.username} has been unexiled.`); else message.channel.send(`${target.user.username} has been unexiled.`);
      }
    } catch (err) {
      console.error(err);
      const text = 'An error occurred while trying to unexile the user.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
