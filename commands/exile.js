module.exports = {
  name: 'exile',
  description: 'Exile a user (mods/admins only)',
  slash: true,
  publicSlash: true,
  postToChannel: false,
  options: [
    { name: 'user', description: 'User to exile', type: 6, required: true },
    { name: 'minutes', description: 'Duration in minutes', type: 4, required: false }
  ],
  execute: async (input, args, context) => {
    const isInteraction = typeof input?.isChatInputCommand === 'function' && input.isChatInputCommand();
    const interaction = isInteraction ? input : null;
    const message = !isInteraction ? input : null;
    const { db, timers, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, checkCooldown } = context;

    try {
      // resolve target and duration
      let targetMember = null;
      let duration = null;
      if (isInteraction) {
        const user = args.getUser('user');
        duration = args.getInteger('minutes');
        if (user && input.guild) targetMember = await input.guild.members.fetch(user.id).catch(() => null);
      } else {
        if (checkCooldown(message.author.id, '-exile', message, message.member)) return;
        targetMember = message.mentions.members.first();
        duration = args[1] ? parseInt(args[1], 10) : null;
      }

      if (!targetMember) {
        if (isInteraction) return interaction.reply({ content: 'Please mention a valid user to exile.', ephemeral: true });
        return message.reply('Please mention a valid user to exile. Usage: `-exile @user [minutes]`');
      }

      if (!isInteraction) {
        if (!message.member.roles.cache.has(ROLE_IDS.mod) && !message.member.roles.cache.has(ROLE_IDS.admin) && message.guild.ownerId !== message.author.id) {
          return message.reply("you aint exiling anyone buddy bro. <:silence:1182339569874636841>");
        }
      }

      await targetMember.roles.add(ROLE_IDS.exiled);
      await targetMember.roles.remove(ROLE_IDS.swaggers);
      await targetMember.roles.remove(ROLE_IDS.uncle);
      await db.query(`INSERT INTO exiles (issuer, target) VALUES ($1, $2)`, [ isInteraction ? interaction.user.id : message.author.id, targetMember.id ]);

      if (duration && !isNaN(duration) && duration > 0) {
        const notify = `${targetMember.user.username} has been exiled for ${duration} minutes.`;
        if (isInteraction || module.exports.postToChannel === false) {
          if (message && message.reply) await message.reply(notify); else await interaction.reply({ content: notify, ephemeral: true });
        } else {
          message.channel.send(notify);
        }
        if (timers.has(targetMember.id)) clearTimeout(timers.get(targetMember.id));
        const timeout = setTimeout(async () => {
          const refreshed = isInteraction ? await input.guild.members.fetch(targetMember.id).catch(() => null) : await message.guild.members.fetch(targetMember.id).catch(() => null);
          if (refreshed && refreshed.roles.cache.has(ROLE_IDS.exiled)) {
            await refreshed.roles.remove(ROLE_IDS.exiled);
                  if (SPECIAL_MEMBERS.includes(refreshed.id)) {
                    await refreshed.roles.add(ROLE_IDS.uncle);
                    if (message && message._isFromInteraction) await message.reply(`${refreshed.user.username} the unc has been automatically unexiled.`); else message.channel.send(`${refreshed.user.username} the unc has been automatically unexiled.`);
                  } else if (SWAGGER_MEMBERS.includes(refreshed.id)) {
                    await refreshed.roles.add(ROLE_IDS.swaggers);
                    if (message && message._isFromInteraction) await message.reply(`${refreshed.user.username} the swagger has been automatically unexiled.`); else message.channel.send(`${refreshed.user.username} the swagger has been automatically unexiled.`);
                  } else {
                    if (message && message._isFromInteraction) await message.reply(`${refreshed.user.username} has been automatically unexiled.`); else message.channel.send(`${refreshed.user.username} has been automatically unexiled.`);
                  }
          }
          timers.delete(targetMember.id);
        }, duration * 60 * 1000);
        timers.set(targetMember.id, timeout);
      } else {
        const notify = `${targetMember.user.username} has been exiled.`;
  if (isInteraction) await interaction.reply({ content: notify, ephemeral: true }); else message.channel.send(notify);
      }
    } catch (err) {
      console.error(err);
      if (isInteraction) return interaction.reply({ content: 'An error occurred while trying to exile the user.', ephemeral: true });
      return message.reply('An error occurred while trying to exile the user.');
    }
  }
};
