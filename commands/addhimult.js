module.exports = {
  name: 'addhimult',
  description: 'Owner: add a temporary hi multiplier (scope: global or user)',
  slash: true,
  options: [
    { name: 'scope', description: 'global or user', type: 3, required: true },
    { name: 'user', description: 'User (required when scope=user)', type: 6, required: false },
    { name: 'multiplier', description: 'Multiplier value (e.g. 2)', type: 4, required: true },
    { name: 'minutes', description: 'Duration in minutes', type: 4, required: true }
  ],
  execute: async (message, args, context) => {
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const { db } = context; // not used but keep signature
    // Only server owner may run this
    if (!message.guild || message.guild.ownerId !== (message.author?.id || message.user?.id)) {
      const text = 'Only the server owner can use this command.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }

    // Parse params for prefix-style and interaction-style
    let scope, targetUserId, multiplier, minutes;
    if (isInteraction) {
      scope = args.getString('scope');
      const u = args.getUser && args.getUser('user');
      targetUserId = u ? u.id : null;
      multiplier = args.getInteger('multiplier');
      minutes = args.getInteger('minutes');
    } else {
      // prefix: -addhimult <global|user> [@user] <multiplier> <minutes>
      scope = args[0];
      if (args[1] && args[1].startsWith('<@')) {
        const id = args[1].replace(/[^0-9]/g, '');
        targetUserId = id;
        multiplier = parseInt(args[2], 10);
        minutes = parseInt(args[3], 10);
      } else {
        multiplier = parseInt(args[1], 10);
        minutes = parseInt(args[2], 10);
      }
    }

    if (!scope || !multiplier || !minutes || isNaN(multiplier) || isNaN(minutes)) {
      const text = 'Usage: -addhimult <global|user> [@user] <multiplier> <minutes>';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
    scope = scope.toLowerCase();
    if (scope === 'user' && !targetUserId) {
      const text = 'When scope is `user`, mention a target user.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }

    // Ensure global.hiMultipliers exists
    if (!global.hiMultipliers) global.hiMultipliers = { global: null, users: {} };

    const expiresAt = Date.now() + minutes * 60 * 1000;

    if (scope === 'global') {
      // Clear existing timeout
      if (global.hiMultipliers.global && global.hiMultipliers.global.timeout) clearTimeout(global.hiMultipliers.global.timeout);
      const timeout = setTimeout(() => { global.hiMultipliers.global = null; }, minutes * 60 * 1000);
      global.hiMultipliers.global = { multiplier: Number(multiplier), expires: expiresAt, timeout };
  const text = `Set global HI multiplier x${multiplier} for ${minutes} minute(s).`;
  if (isInteraction) return message.reply({ content: text, ephemeral: true });
  return message.reply(text);
    }

    // per-user
    if (global.hiMultipliers.users[targetUserId] && global.hiMultipliers.users[targetUserId].timeout) clearTimeout(global.hiMultipliers.users[targetUserId].timeout);
    const timeout = setTimeout(() => { delete global.hiMultipliers.users[targetUserId]; }, minutes * 60 * 1000);
    global.hiMultipliers.users[targetUserId] = { multiplier: Number(multiplier), expires: expiresAt, timeout };
  const text = `Set HI multiplier x${multiplier} for <@${targetUserId}> for ${minutes} minute(s).`;
  if (isInteraction) return message.reply({ content: text, ephemeral: true });
  return message.reply(text);
  }
};
