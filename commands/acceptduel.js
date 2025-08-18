// In-memory duel state (should be moved to a persistent store for production)
if (!global.hiDuels) global.hiDuels = {};
const hiDuels = global.hiDuels;

module.exports = {
  name: 'acceptduel',
  description: 'Accept a HI DUEL challenge',
  slash: true,
  publicSlash: true,
  postToChannel: false,
  options: [],
  execute: async (input, args, context) => {
    const message = input;
    const guildId = message.guild.id;
    const duel = hiDuels[guildId];
    if (!duel || duel.accepted) {
      return message.reply('There is no pending HI DUEL challenge to accept!');
    }
    if (message.author.id !== duel.target) {
      return message.reply('Only the challenged user can accept the HI DUEL!');
    }
    duel.accepted = true;
    duel.scores = {};
    duel.startTime = Date.now();
    duel.endTime = duel.startTime + 60 * 1000; // 1 minute
    const startMsg = `HI DUEL between <@${duel.challenger}> and <@${duel.target}> has started! You have 1 minute to use as many -hi's as possible!`;
    if (message._isFromInteraction || module.exports.postToChannel === false) {
      return message.reply(startMsg);
    }
    return message.channel.send(startMsg);
    // 10-second interval reminders
    const intervalId = setInterval(() => {
      if (!hiDuels[guildId] || !hiDuels[guildId].accepted) {
        clearInterval(intervalId);
        return;
      }
      const secondsLeft = Math.floor((duel.endTime - Date.now()) / 1000);
        if (secondsLeft > 0 && secondsLeft % 10 === 0 && secondsLeft !== 60) {
        if (message._isFromInteraction || module.exports.postToChannel === false) {
          return message.reply(`${secondsLeft} seconds left in the HI DUEL!`);
        }
        return message.channel.send(`${secondsLeft} seconds left in the HI DUEL!`);
      }
      if (secondsLeft <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);
    // End duel after 1 minute
    setTimeout(() => {
      if (!hiDuels[guildId] || !hiDuels[guildId].accepted) return;
      const scores = hiDuels[guildId].scores;
      const cScore = scores[duel.challenger] || 0;
      const tScore = scores[duel.target] || 0;
      let resultMsg = `HI DUEL OVER! <@${duel.challenger}>: ${cScore} - <@${duel.target}>: ${tScore}\n`;
      if (cScore > tScore) {
        resultMsg += `<@${duel.challenger}> wins!`;
        duel.winner = duel.challenger;
        duel.loser = duel.target;
      } else if (tScore > cScore) {
        resultMsg += `<@${duel.target}> wins!`;
        duel.winner = duel.target;
        duel.loser = duel.challenger;
      } else {
        resultMsg += `It's a tie!`;
        duel.winner = null;
        duel.loser = null;
      }
      if (cScore >= 60) resultMsg += `\nBonus: <@${duel.challenger}> hit 60+ hi's!`;
      if (tScore >= 60) resultMsg += `\nBonus: <@${duel.target}> hit 60+ hi's!`;
      // Winner/loser count
      if (duel.winner && duel.loser) {
        duel.winnerCount = (duel.winnerCount || 0) + 1;
        duel.loserCount = (duel.loserCount || 0) + 1;
        resultMsg += `\n<@${duel.winner}> has won ${duel.winnerCount} duel(s). <@${duel.loser}> has lost ${duel.loserCount} duel(s).`;
      }
      if (message._isFromInteraction || module.exports.postToChannel === false) {
        return message.reply(resultMsg);
      }
      return message.channel.send(resultMsg);
      delete hiDuels[guildId];
    }, 60 * 1000);
  }
};

// Export hiDuels for use in hi.js and other files
module.exports.hiDuels = hiDuels;
