const { getQuestProgress } = require('./quests');

module.exports = {
  name: 'quests',
  execute: async (message, args, context) => {
    const { db } = context;
    const userId = message.author.id;
    const progress = await getQuestProgress(db, userId);
    let msg = '**Daily Quests Progress:**\n';
    for (const q of progress) {
      msg += `${q.done ? '✅' : '❌'} ${q.desc}\n`;
    }
    message.reply(msg);
  }
};
