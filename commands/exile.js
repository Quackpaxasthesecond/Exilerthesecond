module.exports = {
  name: 'exile',
  description: 'Exile a user (mods/admins only)',
  slash: true,
  options: [
    {
      name: 'user',
      description: 'User to exile',
      type: 6,
      required: true
    },
    {
      name: 'minutes',
      description: 'Duration in minutes',
      type: 4,
      required: false
    }
  ],
  execute: async (message, args, context) => {
    const { db, timers, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, checkCooldown } = context;
    if (checkCooldown(message.author.id, '-exile', message, message.member)) return;
    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("you aint exiling anyone buddy bro. <:silence:1182339569874636841>");
    }
    const target = message.mentions.members.first();
    const durationArg = args[1] ? parseInt(args[1], 10) : null;
    if (!target) {
      return message.reply('Please mention a valid user to exile. Usage: `-exile @user [minutes]`');
    }
    if (target.roles.cache.has(ROLE_IDS.exiled)) {
      return message.reply(`${target.user.tag} is already exiled!`);
    }
    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);
      await db.query(
        `INSERT INTO exiles (issuer, target) VALUES ($1, $2)`,
        [message.author.id, target.id]
      );
      if (durationArg && !isNaN(durationArg) && durationArg > 0) {
        message.channel.send(`${target.user.username} has been exiled for ${durationArg} minutes.`);
        if (timers.has(target.id)) clearTimeout(timers.get(target.id));
        const timeout = setTimeout(async () => {
          const refreshed = await message.guild.members.fetch(target.id).catch(() => null);
          if (refreshed && refreshed.roles.cache.has(ROLE_IDS.exiled)) {
            await refreshed.roles.remove(ROLE_IDS.exiled);
            if (SPECIAL_MEMBERS.includes(refreshed.id)) {
              await refreshed.roles.add(ROLE_IDS.uncle);
              message.channel.send(`${refreshed.user.username} the unc has been automatically unexiled.`);
            } else if (SWAGGER_MEMBERS.includes(refreshed.id)) {
              await refreshed.roles.add(ROLE_IDS.swaggers);
              message.channel.send(`${refreshed.user.username} the swagger has been automatically unexiled.`);
            } else {
              message.channel.send(`${refreshed.user.username} has been automatically unexiled.`);
            }
          }
          timers.delete(target.id);
        }, durationArg * 60 * 1000);
        timers.set(target.id, timeout);
      } else {
        message.channel.send(`${target.user.username} has been exiled.`);
      }
    } catch (error) {
      console.error(error);
      message.reply('An error occurred while trying to exile the user.');
    }
  }
};
