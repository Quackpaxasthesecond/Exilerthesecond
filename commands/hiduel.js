const { EmbedBuilder } = require('discord.js');
const { hiDuels } = require('./acceptduel');

// In-memory duel state (should be moved to a persistent store for production)
hiDuels = {};

module.exports = {
  name: 'hiduel',
  execute: async (message, args, context) => {
    const { db } = context;
    const challenger = message.author;
    const target = message.mentions.users.first();
    if (!target || target.id === challenger.id) {
      return message.reply('You must mention someone else to challenge to a HI DUEL!');
    }
    const guildId = message.guild.id;
    if (hiDuels[guildId] && hiDuels[guildId].accepted && Date.now() < hiDuels[guildId].endTime) {
      return message.reply('A HI DUEL is already in progress in this server!');
    }
    hiDuels[guildId] = {
      challenger: challenger.id,
      target: target.id,
      accepted: false,
      scores: {},
      startTime: null,
      endTime: null
    };
    message.channel.send(`${target}, you have been challenged to a HI DUEL by ${challenger}! Type -acceptduel to accept. Most -hi's in 1 minute wins!`);
  }
};

// Accept duel command (should be in acceptduel.js, but included here for reference)
// module.exports = {
//   name: 'acceptduel',
//   execute: async (message, args, context) => {
//     // ...accept logic...
//   }
// };
