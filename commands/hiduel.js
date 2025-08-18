const { EmbedBuilder } = require('discord.js');

// In-memory duel state (should be moved to a persistent store for production)
// Only define hiDuels if not already set by another module
if (!global.hiDuels) global.hiDuels = {};
const hiDuels = global.hiDuels;

module.exports = {
  name: 'hiduel',
  description: 'Challenge someone to a HI DUEL',
  slash: true,
  // make slash replies public but avoid posting to the channel directly
  publicSlash: true,
  postToChannel: false,
  options: [ { name: 'user', description: 'User to challenge', type: 6, required: true } ],
  execute: async (input, args, context) => {
    const isInteraction = typeof input?.isChatInputCommand === 'function' && input.isChatInputCommand();
    const message = input;
    const challenger = message.author;
    const target = (isInteraction ? (args.getUser ? args.getUser('user') : null) : message.mentions.users.first());
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
    // If invoked via slash, edit the deferred reply instead of posting to channel
  if (message._isFromInteraction || module.exports.postToChannel === false) return message.reply(`${target}, you have been challenged to a HI DUEL by ${challenger}! Type -acceptduel to accept. Most -hi's in 1 minute wins!`);
  return message.channel.send(`${target}, you have been challenged to a HI DUEL by ${challenger}! Type -acceptduel to accept. Most -hi's in 1 minute wins!`);
  }
};

// Accept duel command (should be in acceptduel.js, but included here for reference)
// module.exports = {
//   name: 'acceptduel',
//   execute: async (message, args, context) => {
//     // ...accept logic...
//   }
// };
