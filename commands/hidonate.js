module.exports = {
  name: 'hidonate',
  execute: async (message, args, context) => {
    const { db } = context;
    if (args.length < 2) return message.reply('Usage: -hidonate @user <amount>');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1], 10);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: -hidonate @user <amount>');
    if (target.id === message.author.id) return message.reply('You cannot donate hi to yourself.');
    // Check sender hi count
    const res = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [message.author.id]);
    const senderHi = res.rows[0]?.count || 0;
    if (senderHi < amount) return message.reply('You do not have enough hi to donate that amount.');
    // Transfer hi
    await db.query('UPDATE hi_usages SET count = count - $1 WHERE user_id = $2', [amount, message.author.id]);
    await db.query('INSERT INTO hi_usages (user_id, count) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET count = hi_usages.count + $2', [target.id, amount]);
    message.reply(`You donated ${amount} hi to ${target.username}!`);
    try {
      const member = await message.guild.members.fetch(target.id);
      member.send(`${message.author.username} donated you ${amount} hi!`);
    } catch {}
  }
};
