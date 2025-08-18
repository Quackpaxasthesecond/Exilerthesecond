module.exports = {
  name: 'killwitari',
  description: 'kill witari ability if you own it (4 hours cd) .',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
  const { db } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const userId = message.author?.id || message.user?.id;

    try {
      // Check inventory for permanent killwitari
      const res = await db.query('SELECT id FROM hi_shop_inventory WHERE user_id = $1 AND item = $2', [userId, 'killwitari']);
      if (res.rows.length === 0) {
        const text = 'You do not own the Killwitari ability. Purchase it from the shop.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      // Cooldown logic: 4 hours for regular members, no cooldown for owner/mods/admins
      const member = message.member;
      const now = Date.now();
      const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
      const isOwner = message.guild && message.guild.ownerId === userId;
      const isPrivileged = isOwner || (member && member.roles && member.roles.cache && (member.roles.cache.has(context.ROLE_IDS?.admin) || member.roles.cache.has(context.ROLE_IDS?.mod)));

      if (!isPrivileged) {
        // Fetch last_used from persistent cooldown table
        const cdRes = await db.query('SELECT last_used FROM killwitari_cooldowns WHERE user_id = $1', [userId]);
        if (cdRes.rows.length && cdRes.rows[0].last_used) {
          const last = Number(cdRes.rows[0].last_used);
          if (now - last < COOLDOWN_MS) {
            const remaining = COOLDOWN_MS - (now - last);
            const minutes = Math.ceil(remaining / 60000);
            const text = `Killwitari is on cooldown for ${minutes} more minute(s).`;
            if (isInteraction) return message.reply({ content: text, ephemeral: true });
            return message.reply(text);
          }
        }
        // Record usage
        await db.query('INSERT INTO killwitari_cooldowns (user_id, last_used) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET last_used = $2', [userId, now]);
      } else {
        // privileged users: don't record cooldowns, but you may want to audit usage later
      }

      // Effect: remove mod role and exile the configured target user
      const TARGET_ID = '1025984312727842846';
      try {
        const guild = message.guild;
        if (!guild) {
          const text = 'Guild context required to use Killwitari.';
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        const targetMember = await guild.members.fetch(TARGET_ID).catch(() => null);
        if (!targetMember) {
          const text = `Could not find target user <@${TARGET_ID}> in this guild.`;
          if (isInteraction) return message.reply({ content: text, ephemeral: true });
          return message.reply(text);
        }
        // remove mod role if present
        const modRole = context.ROLE_IDS && context.ROLE_IDS.mod;
        if (modRole && targetMember.roles.cache.has(modRole)) {
          await targetMember.roles.remove(modRole).catch(() => null);
        }
        // add exiled role
        const exiledRole = context.ROLE_IDS && context.ROLE_IDS.exiled;
        if (exiledRole) {
          await targetMember.roles.add(exiledRole).catch(() => null);
        }
        const text = `${message.author.username} used Killwitari: <@${TARGET_ID}> has been stripped of mod role and exiled.`;
        if (isInteraction) return message.reply({ content: text, ephemeral: false });
        return message.channel.send(text);
      } catch (e) {
        console.error('Killwitari effect error', e);
        const text = 'Failed to apply Killwitari effect.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }
    } catch (e) {
      console.error(e);
      const text = 'Error killing witari :(';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
