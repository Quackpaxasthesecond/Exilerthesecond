const { Client, GatewayIntentBits } = require('discord.js');
const { Client: PgClient } = require('pg');
require('dotenv').config();
const http = require('http');

// HTTP server for uptime monitoring
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
});
server.listen(3000, '0.0.0.0', () => {
  console.log('HTTP server ready on port 3000');
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// PostgreSQL DB
const db = new PgClient({
  connectionString: process.env.POSTGRES_URL,
});
db.connect()
  .then(() => console.log('Connected to PostgreSQL database.'))
  .catch(err => console.error('Postgres connection error:', err));

// Create table if not exists (run at startup)
db.query(`
  CREATE TABLE IF NOT EXISTS exiles (
    id SERIAL PRIMARY KEY,
    issuer TEXT NOT NULL,
    target TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error(err));

const ROLE_IDS = {
  exiled: '1208808796890337350',
  swaggers: '1202948499193335828',
  uncle: '1351986650754056354',
  mod: '1353414310499455027',
  admin: '1351985637602885734',
};

const SPECIAL_MEMBERS = [
  '1346764665593659393', '1234493339638825054', '1149822228620382248',
  '1123873768507457536', '696258636602802226', '512964486148390922',
  '1010180074990993429', '464567511615143962', '977923308387455066',
  '800291423933038612', '872408669151690755', '1197176029815517257',
];

const cooldowns = new Map();

function checkCooldown(userId, command, message) {
  const key = `${userId}_${command}`;
  const now = Date.now();
  const cooldown = cooldowns.get(key);
  if (cooldown && now - cooldown < 2000) {
    message.reply('slow down buddy. you are clicking too fast.');
    return true;
  }
  cooldowns.set(key, now);
  return false;
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('Exiling buddies.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === '-help') {
    if (checkCooldown(message.author.id, command, message)) return;
    const helpMessage = `
**Bot Commands:**
- \`-exile @user\` : Exile a user (mods/admins only)
- \`-unexile @user\` : Unexile a user (mods/admins only)
- \`-myexiles\` : Show how many people you exiled (mods/admins only)
- \`-leaderboard\` : Show the top exiled users
- \`-hi\` : random stuffs :3
    `;
    return message.channel.send(helpMessage);
  }

  if (command === '-exile') {
    if (checkCooldown(message.author.id, command, message)) return;

    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("you aint exiling anyone buddy bro.");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to exile.');
    if (target.user.bot) return; // Silently ignore bot exile attempt
    if (target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.username} is already exiled!`);

    try {
      await target.roles.add(ROLE_IDS.exiled);
      await target.roles.remove(ROLE_IDS.swaggers);
      await target.roles.remove(ROLE_IDS.uncle);
      message.channel.send(`${target.user.username} has been exiled.`);

      await db.query(
        `INSERT INTO exiles (issuer, target) VALUES ($1, $2)`,
        [message.author.id, target.id]
      );
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while trying to exile the user.');
    }
  }

  if (command === '-unexile') {
    if (checkCooldown(message.author.id, command, message)) return;

    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) return message.reply("nice try buddy");

    const target = message.mentions.members.first();
    if (!target) return message.reply('Please mention a valid user to unexile.');
    if (!target.roles.cache.has(ROLE_IDS.exiled)) return message.reply(`${target.user.username} is not exiled!`);

    try {
      await target.roles.remove(ROLE_IDS.exiled);
      if (SPECIAL_MEMBERS.includes(target.id)) {
        await target.roles.add(ROLE_IDS.uncle);
        message.channel.send(`${target.user.username} the unc has been unexiled`);
      } else {
        message.channel.send(`${target.user.username} has been unexiled.`);
      }
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while trying to unexile the user.');
    }
  }

  if (command === '-myexiles') {
    if (checkCooldown(message.author.id, command, message)) return;

    if (
      !message.member.roles.cache.has(ROLE_IDS.mod) &&
      !message.member.roles.cache.has(ROLE_IDS.admin) &&
      message.guild.ownerId !== message.author.id
    ) {
      return message.reply("buddy you are not a moderator. slow down 😅😅😅");
    }

    try {
      const res = await db.query(
        `SELECT COUNT(*) as count FROM exiles WHERE issuer = $1`,
        [message.author.id]
      );
      const count = res.rows[0].count;
      message.reply(`you've murdered ${count} people.`);
    } catch (err) {
      console.error(err);
      message.reply('Error checking your exile record.');
    }
  }

  if (command === '-leaderboard') {
    if (checkCooldown(message.author.id, command, message)) return;

    try {
      const res = await db.query(
        `SELECT target, COUNT(*) as exile_count FROM exiles GROUP BY target ORDER BY exile_count DESC LIMIT 10`
      );
      if (res.rows.length === 0) {
        return message.channel.send('No exiles have been recorded yet.');
      }

      let leaderboard = '**Exile Leaderboard <:crying:1285606636853137560>**:\n';

      for (let i = 0; i < res.rows.length; i++) {
        const member = await message.guild.members.fetch(res.rows[i].target).catch(() => null);
        const name = member ? member.user.username : `Unknown (${res.rows[i].target})`;
        leaderboard += `${i + 1}. ${name} - ${res.rows[i].exile_count} exiles\n`;
      }

      message.channel.send(leaderboard);
    } catch (err) {
      console.error(err);
      message.channel.send('An error occurred while fetching the leaderboard.');
    }
  }

  if (command === '-hi') {
  if (checkCooldown(message.author.id, command, message)) return;

  if (
    !message.member.roles.cache.has(ROLE_IDS.mod) &&
    !message.member.roles.cache.has(ROLE_IDS.admin) &&
    message.guild.ownerId !== message.author.id
  ) {
    if (Math.random() < 0.01) { // 1% chance
      try {
        await message.member.roles.add(ROLE_IDS.exiled);
        await message.member.roles.remove(ROLE_IDS.swaggers);
        await message.member.roles.remove(ROLE_IDS.uncle);
        message.channel.send(`${message.author.username} just got exiled for using -hi 😭`);
        await db.query(
          `INSERT INTO exiles (issuer, target) VALUES ($1, $2)`,
          [message.author.id, message.author.id]
        );
        return; // stop here, so no roast is sent
      } catch (err) {
        console.error(err);
        message.reply('you lucky as fuck for not getting exiled at 10% chance');
        return;
      }
    }
  }

    const members = await message.guild.members.fetch();
    const filtered = members.filter(m => !m.user.bot && m.id !== message.author.id);
    if (filtered.size === 0) return message.reply("you will die....");

    const randomMember = filtered.random();
    const roasts = [
      `${randomMember.user.username} is fat and huge.`,
      `${randomMember.user.username} weighs 700 pounds.`,
      `${randomMember.user.username} is huge in mass.`,
      `${randomMember.user.username} Is big and round`,
      `${randomMember.user.username} has their own center of mass`,
      `${randomMember.user.username} is morbidly a beast`,
      `${randomMember.user.username}'s pronouns are lbs/kg/tons.`,
      `${randomMember.user.username} is usagi.`,
      `${randomMember.user.username} will eventually turn into a star with their mass`,
      `${randomMember.user.username} has their own gravitational force`,
      `${randomMember.user.username} is huge in mass.`,
      `${randomMember.user.username} has an orbit around them`,
      `${randomMember.user.username} is Fat Bald Friend.`,
      `https://cdn.discordapp.com/attachments/992551367187120243/1315406613019885638/flop.gif?ex=682ae41f&is=6829929f&hm=d02718a4dda13dd2d67c98da5d41cd7f741c1b08d18f5a5cbef30de159747754&`,
      `https://cdn.discordapp.com/attachments/1331265060089106482/1366888527291355176/ezgif-4a5d7dd059300a.gif?ex=682af964&is=6829a7e4&hm=94de809464ef15d141e96b9c476426e18229f1257e864b2f73c84d001f58f153&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1373626077687054386/eed79d5e9d0639297e0a2945066c7b4c.jpg?ex=682b1879&is=6829c6f9&hm=070bd6caf6b2d2a4bd540eddf2b671c633d1d346dba2d2b0c8f9b8d9e9c0b6e2&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1372776697753239632/booty.mp4?ex=682aa46d&is=682952ed&hm=a4e572d784abf0d8d5ba08eae1ea826ef0a61dbfd5f38c9eb4662fa5cc78d0f3&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1372942743780724826/image.png?ex=682b3f12&is=6829ed92&hm=a608e3473c1e0971a81c15d4cda73c90471490b9d478439e651b129a1f27a06d&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1370433056703385640/file.png?ex=682aaf7e&is=68295dfe&hm=73239c1dd6f358b82065059215a1c683d5ee0b6aeee0c0f19a2dfddfe53df51c&`,
      `https://cdn.discordapp.com/attachments/1351980844579033180/1373685945764675624/cachedVideo.mov?ex=682b503b&is=6829febb&hm=e2d07a2434830d8e2e1a1a55da5f5f8798691854a6ed4efe2b862ca57bf063f6&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281564222488317962/20240903_104834.jpg?ex=682b0a30&is=6829b8b0&hm=09b0a5e2363e5fdab7ad40b83b16ab51f2848c552961751f5939edbee4a91b&`,
      `https://d.vxtwitter.com/blephin_/status/1748019919885832217?t=qzcI7cbwZEJ8uUUdmht9yA&s=19`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281292405458604094/togif-1.gif?ex=682ab5ca&is=6829644a&hm=954795300df86533f743bdccee7cc433f2be6e876346e63d8814ddc37b2318f8&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281270802209050654/GWqYRMUacAAryc5.jpg?ex=682aa1ac&is=6829502c&hm=0decb70c2ce275ee997d6c5c621dad352938cadea2d3df18ed8121b26288b5c3&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281255798252769301/image0.gif?ex=682b3c72&is=6829eaf2&hm=479c2d500ba4f809032c66efbe94f7da2356949870255c62163906d0bc901a15&`,
      `https://tenor.com/view/backshots-working-out-backshot-machine-gif-12785549926344490376`,
      `https://cdn.discordapp.com/attachments/803635095733796905/1277832802389200977/225019E9-EF52-4CE8-9921-47CEFD018820.gif?ex=682aa609&is=68295489&hm=79552d35175469bb62fb177bb6b5642ba3b611b7132c0b67a9c3a7e7e27ed8b2&`,
      `https://cdn.discordapp.com/attachments/803635095733796905/1280051210703081554/this-shit-laced-laced.gif?ex=682acf16&is=68297d96&hm=8daa57fe95957c11996b3e7a0d7a6ba8a20c6dfb36cbe4d266461a1e9e8a0cfe&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281235855843000421/goku.jpg?ex=682b29e0&is=6829d860&hm=af44c68f2d3c744309aec9879196f352976600845487a117efacf19160d87645&`,
      `https://cdn.discordapp.com/attachments/1221441946615152680/1281233486291927102/dyson_vacuum.png?ex=682b27ab&is=6829d62b&hm=a0235b1e4f2e25aa35b5d10422d486e6f57c42a56bce0285a23b739e79720dd0&`,
      `https://cdn.discordapp.com/attachments/1064378659579899925/1273250349049712731/copy_85B464E9-5340-42B2-8BCC-BF0044E4EE9A.gif?ex=682b1dcb&is=6829cc4b&hm=d6e7057e59727c9e15823dfeb2bcf557974e&`,
      `sybau bro 🥀🥀🥀🥀`,
      `https://cdn.discordapp.com/attachments/1202269251621097576/1373609947673268224/attachment-7.gif?ex=682b0973&is=6829b7f3&hm=54930ad2074e3862c27ce7a88dbbcee7f40db88582ecfde101edc8d27697ff96&`,
      `https://cdn.discordapp.com/attachments/1351980844579033180/1373685945764675624/cachedVideo.mov?ex=682b503b&is=6829febb&hm=e2d07a2434830d8e2e1a1a55da5f5f8798691854a6ed4efe2b862ca57bf063f6&`,
      `https://cdn.discordapp.com/attachments/1351980844579033180/1373686778955038720/snapins-ai_3615571726075825390.mp4?ex=682b5101&is=6829ff81&hm=2cdaad98516cb1a76c665fce39f42467f2b56c0707aac88&`,
      `https://cdn.discordapp.com/attachments/1351980844579033180/1373686779445645442/nectarplasm_1747139048582.mov?ex=682b5102&is=6829ff82&hm=750037a46c4bb80fe4e734742d8f421958f78a75773befb3a1f5&`,
      `https://cdn.discordapp.com/attachments/1351980844579033180/1373686779839774851/B4Efp2SCMAAvEQH.jpg?ex=682b5102&is=6829ff82&hm=dc446216c6aa1f28b6f29e7d3bd0f37612a0583e19f9d1c0b1564e9285717d&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374053574027382794/20250514_113055.jpg?ex=682ca69c&is=682b551c&hm=2593f42a944f027692b882e9388fbb914e75651e0159363cc6c07214bf83f9f3&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374055440203386970/bricked.png?ex=682ca859&is=682b56d9&hm=36a22b3242e79e00811051669a7c9a38005efa3921c2b949ffe4858b45f9576b&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374053389574602913/laundry.webp?ex=682ca670&is=682b54f0&hm=635a7c22fd6623869cc8d37e3c66a75360cb0a9ba1b73547c33f0b5a0f5e7a73&`,
      `I WILL FOLD YOU LIKE LAUNDRY`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374055544717053952/dasher.jpg?ex=682ca872&is=682b56f2&hm=446cd084b86c2d56e6434370ef39f3ab1e581f7ef1c6066e8b27cc21262158d9&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374053056324571327/20250519_234533.jpg?ex=682ca621&is=682b54a1&hm=2897638c64caf0106c58f2f509d44f32761b3293725bc6f89bfe382095a17050&`,        `https://cdn.discordapp.com/attachments/1374052923956269136/1374053005355126804/6d9553d6361be9f839844a5a73ce1b10986d611fd316f91b21f19487cc952611_1.jpg?ex=682ca615&is=682b5495&hm=81678692420598451fdb88b1c09c7b51beb0319d9e3bfa23e64e1dfe38be273c&`,
      `https://tenor.com/view/agamatsu-deepwoken-twerk-gif-18285698406762040484`,
      `https://tenor.com/view/agamatsu-gif-27363955`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374055910959218769/image.png?ex=682ca8c9&is=682b5749&hm=06ca8ff374a5dc401fc2291d97609be2e56d079d53643cc21dbb1d1e472e0bb3&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374055951954612246/IMG_4449-1.jpg?ex=682ca8d3&is=682b5753&hm=e86fba6885cd4460b7fbd57ec652d4d9b746e22b336677a7a8a004772a89e8a3&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374055992765055137/image.png?ex=682ca8dd&is=682b575d&hm=89272e977e709fa2f1501915b73a5de68fa73dcc7b6c4d0f7384759bd204c16f&`,
      `https://cdn.discordapp.com/emojis/825445146668826664.gif?v=1`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1374044366817067108/image0.gif?ex=682c9e09&is=682b4c89&hm=cb8ddc59298f181c08e5d6f61e661f897531840b8844f81df2e251a6facaa974&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1374043912167227493/images_7_8.jpg?ex=682c9d9d&is=682b4c1d&hm=47c8ffdbc091596a275def3dc3fe5433dd2d94a36d7d875b3f22bb488c173283&`,
      `https://tenor.com/view/oppenheimer-cillian-murphy-cillian-murphy-peaky-blinders-gif-1787947313354313976`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1374040963160346756/image0.gif?ex=682c9ade&is=682b495e&hm=3b01fd3efc8c0a6610ca283c69d8e64657bce4575c9007a482215261419cd087&`,
      `https://tenor.com/view/king-von-stare-king-von-stare-gif-5096460164055963067`,
      `https://tenor.com/view/ishowspeed-unimpressed-not-interested-not-funny-annoying-gif-6241214810509976351`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1374017551583023154/image-126.png.jpg?ex=682c8510&is=682b3390&hm=543d482b9b87e00d348536549a9aa068ae8aca84498d0016aa7ddd388608b37e&`,
      `sim is bald btw`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373995782340083872/snapins-ai_3585662182260004945.mp4?ex=682c70ca&is=682b1f4a&hm=d2a15e7fbbce7a83233a88a0308674b107e0eaf87705a865276ba840a0259b92&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373996466523209851/cachedVideo.mov?ex=682c716d&is=682b1fed&hm=329f1a62f2a1c72a583250acac43ed270bfdcbe2230dc7f5a38b084bee4c83ee&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373995351194992680/snapins-ai_3516169711338260114.mp4?ex=682c7063&is=682b1ee3&hm=6057124a13d151c57181f72c6de051fc28ccc5342a00a7ffec49162232cdfd22&`,
      `https://tenor.com/view/speed-ishowspeed-speedy-ishowspeedy-crashout-gif-12313702839187803425`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373980846045790270/20241005_134411.jpg?ex=682c62e1&is=682b1161&hm=a3f98df8f8c30244fca2c595c536b60b5642f3aaa5aac06d6572f0b9b7a67e26&`,
      `https://tenor.com/view/scorsese-absolute-cinema-meme-gif-9523375912274476782`,
      `https://tenor.com/view/lets-take-a-look-leon-kennedy-resident-evil-gif-6340805119084790948`,
      `https://tenor.com/view/bunny-bunny-carry-carrying-away-bunny-bunny-walk-chill-bunny-gif-718057308746791294`,
      `https://media.discordapp.net/attachments/1241730734679658518/1282495493779361845/VID_30480702_130721_390.mov?ex=682bca81&is=682a7901&hm=145f43e92df9778bab9fa0414581889735925c9d45ef93f032bc27ffcd6098be&`,
      `https://tenor.com/view/markiplier-burning-robert-helpmann-markiplier-getting-over-it-rage-gif-1734552878806861009`,
      `https://tenor.com/view/9-hour-work-day-based-gif-4669037067252061146`,
      `https://tenor.com/view/yourrage-yourage-chair-bounce-bouncing-gif-6962769865165567051`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373947147816534017/KopAgce.png?ex=682c437e&is=682af1fe&hm=05af5106479f43a58ca52ddb7d2527e590f611d11b5c333922abaf778ee9f39f&`,
      `https://imgur.com/fw94Eek`,
      `https://cdn.discordapp.com/attachments/1349492755046465596/1371238071898734843/AveriThink.gif?ex=682c4bb8&is=682afa38&hm=0bf83f655462940e9d1e98fd266e8d7310cd626df68dac861562a561267d4817&`,
      `https://tenor.com/view/kagurabachi-if-you-laugh-if-you-laugh-you-go-to-hell-kagurabachi-if-you-laugh-speed-gif-7884817524351810051`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373942271065722890/20250519_113556.jpg?ex=682c3ef4&is=682aed74&hm=86e80fab9cd84ed7e733a404b0791b9b4d792957b1189ccf5dee37bee213b546&`,
      `https://cdn.discordapp.com/attachments/1278492520384430124/1300802712044306463/2FA4296C-344B-4C13-AD15-C6FFF8C14A85.gif?ex=682c796e&is=682b27ee&hm=4e0e5a4c683e2e3864febddcad3109250e1126c669a00ab963368d36eb6b9d82&`,
      `https://cdn.discordapp.com/attachments/732027496719057037/1349495074454638622/togif.gif?ex=682c4bfa&is=682afa7a&hm=0ff08eff4faab2771241e6a80bb4fbb6771053a8925e49c1d3f67de8bc87b0af&`,
      `https://tenor.com/view/shu-arknights-sui-gif-7073468061133619170`,
      `https://d.vxtwitter.com/bestshortclip/status/1924187600547451219?t=KPs2xHKRQpu05akd-cqLGQ&s=19`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373937292556632074/IMG_8833.jpg?ex=682c3a51&is=682ae8d1&hm=e0e9f6a00a9c4aee821d35c1a5d309c6a59313ed3b666dbcee531a2bdc1532bc&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373935617125257247/IMG_3221.png?ex=682c38c1&is=682ae741&hm=f3e87e9ef02a92722785a034ba033d9fb5baa04505223b10c249fcf58ece4595&`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373927647670702080/snapins-ai_3625323534249447872.mp4?ex=682c3155&is=682adfd5&hm=676ad95e866c5a82363a4e5dfb564c2631c60f7ce34c8356d15f5223be5e656c&`,
      `https://d.ddinstagram.com/reel/DJs3a9WxxPN/?igsh=MTRzdTNybDhodXVmMQ==`,
      `https://tenor.com/view/nodding-soyjak-pissluffare-soy-gif-25061889`,
      `https://tenor.com/view/rich-off-airpods-richoffairpods-stack-band-bandforband-gif-4351078540525453133`,
      `https://tenor.com/view/atlanta-get-out-the-way-move-move-out-the-way-awesome-gif-9589871793576093914`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373906700532453417/20250519_081412.jpg?ex=682c1dd3&is=682acc53&hm=21427794a636cd70851a496812711dcdb61ceaa41c085a3f07104056c5295a0d&`,
      `https://tenor.com/view/cillianmurphygun-cillianmurphy-jazmincoded-gif-3811002643797340103`,
      `https://tenor.com/view/the-duke-of-erisia-deepwoken-clinomi-deepwoken-meme-roblox-gif-3637178336489571589`,
      `https://tenor.com/view/what-da-hell-is-a-polar-bear-doin-in-arlington-texas-polar-bear-arlington-texas-gif-1601479263998601493`,
      `https://d.vxtwitter.com/scavenger2063/status/1923823049805115800?t=7k2Qr3MeNpRVboJRnY8IsA&s=19`,
      `https://d.ddinstagram.com/reel/DI13yF7xleD/?igsh=MnVhanA1ajkwczAw`,
      `https://tenor.com/view/nishiki-nishikiyama-shoot-shooting-die-gif-3150317105408931899`,
      `https://d.vxtwitter.com/heavyfortress/status/1923847634072003042?t=gXlggKPXLzkXpcIleGBtDA&s=19`,
      `https://tenor.com/view/funny-fall-spank-stage-gif-16760144`,
      `https://cdn.discordapp.com/attachments/1351976782131363880/1373707675527020576/20250518_190345.jpg?ex=682c0d38&is=682abbb8&hm=baba7572ffc330df30e07c5c40cbb642cacd1d3031adf1ee9e757e1c7ec1f516&`,
      `https://tenor.com/view/skeleto-skeleton-fire-hell-burn-gif-26129219`,
      `https://tenor.com/view/yakuza-kiryu-nishiki-yakuza-0-yakuza-funny-gif-10862016214677208445`,
      `https://cdn.discordapp.com/attachments/1202269251621097576/1374057239572250735/amen2.png?ex=682caa06&is=682b5886&hm=80cc40476edd04a04064ea31dc33e37422c6321dcaa584ecf7fb8d77b4d070ea&`,
      `https://gif.fxtwitter.com/tweet_video/GrMSk99XoAAExdf.gif`,
      `https://cdn.discordapp.com/attachments/1214579258261766215/1373974311349653547/image.png?ex=682c5ccb&is=682b0b4b&hm=45b181fde969b803125906b9bad63445194a718f8aa78b8663672accbef0b2cf&`,
      `https://tenor.com/view/china-money-smile-blessing-god-gif-11424213571694975890`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373929223995261019/20250519_151037.jpg?ex=682c32cd&is=682ae14d&hm=c446a32c1a40db0e8d76867bddff44866a86d891908f59a48212192ce7266329&`,
      `https://tenor.com/view/baking-anime-baki-anime-fight-apple-fritter-gif-19725296`,
      `https://tenor.com/view/tiger-dog-gif-9172069397548984647`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373860400310911087/IMG_3853.png?ex=682c9b74&is=682b49f4&hm=4b905c2157ee871b4cb6a64bcdac06af4c0d68255176e81a364562a6eef79396&`,
      `https://tenor.com/view/low-tier-god-ltg-lowtiergod-barber-fade-gif-11105391279061661445`,
      `https://tenor.com/view/ashton-hall-ashton-hall-gta-5-rage-gif-1364330757071934468`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373458947222278174/image.png?ex=682c7712&is=682b2592&hm=ec3cb93ff0b1adef4ee4068c215f61bb41b230b6f3d80fbf60b0c92337addbf0&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373403715712581825/IMG_3935.jpg?ex=682c43a2&is=682af222&hm=d9bbea6c685206ff7af852bea33b2e5895ebcb4f78811ae9b4a1b2504e593a5f&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373344258546860132/image.png?ex=682c0c42&is=682abac2&hm=e06a99a302522f4dc55c8fafd05235e290a40ee9e84aaee2edbda8369c40daab&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373253626000314450/IMG_20250516_222126_446.jpg?ex=682c609a&is=682b0f1a&hm=f48df64c1c986fad5e8b075384046321f0f06d39a6014bf9c7311cbc49546ae4&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373233484155588779/Screenshot_20250503_101948_Instagram.png?ex=682c4dd8&is=682afc58&hm=c91d0959e9bd236e849a4c48f9b6134470de27df2b7f288c85aaa4ee01961bbf&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373228246291845201/image0.png?ex=682c48f7&is=682af777&hm=f2bf3dd4049f46904cc69104714763d7920f5ca7508d4fb456bd37a311b82614&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373192319364497438/IMG_7510.jpg?ex=682c2781&is=682ad601&hm=8341e789d87f3a75ccd85ae1302f0cecdda533437d20549d3ad5ef999ff29fac&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1373063569217683486/remix-291ecd77-aa87-4fda-98d8-13e2b3e94cd2.png?ex=682c5859&is=682b06d9&hm=8b5167f386a478544abb2b72833a7182f3f9c3de70b8bc17773daf939c8b6a89&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372924607643914290/image.png?ex=682c7fae&is=682b2e2e&hm=0b458ca6455028f9125b71c2b8c884125d97ac9853ccc23b857f4dcf9ef013b8&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372915322943701004/IMG_1061.png?ex=682c7708&is=682b2588&hm=ce2f54723f5b35eeba69351b103b5216e6ccb51ac6e8ff56211bda014ba80126&`,
      `https://tenor.com/view/little-chinese-boys-scurry-to-me-like-rats-sam-tailor-samtailor-suit-chinese-boys-gif-15774853514705455882`,
      `https://tenor.com/view/attention-seeking-rabbit-bunny-cute-awesome-gif-10442048648275714876`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372808511762726912/IMG_3854.png?ex=682c138e&is=682ac20e&hm=32b807001c765e7974840b54c13b34e4e27271e8cc322260439fe9716a951bc9&`,
      `https://cdn.discordapp.com/attachments/1208928697378275409/1366493788704608308/togif.gif?ex=682c2cc3&is=682adb43&hm=a7818b2042e4477aa17508c4152d0f0987ad6caf75730b7b4b96141d8892fc53&`,
      `https://cdn.discordapp.com/attachments/1273158855689244734/1367787809871495239/image.gif?ex=682c44aa&is=682af32a&hm=4ff9085e76de12e63c37bdd154d8c824dbe43cb2c08474130366781044965cac&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372450139205271662/IMG_3852.png?ex=682c174c&is=682ac5cc&hm=c8bf4b9ffe5e2a2f66ee038a009d57d704c361e2825be9428f182b312e9a2335&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372337561355288628/guys_what_breed_is_thiscats.jpg?ex=682c5733&is=682b05b3&hm=a12c172093ffeb7d6f9d104055677a85ab705869dcd6c1bc8ab96820ab8dcfbc&`,
      `https://cdn.discordapp.com/attachments/1243997048718495864/1268135354334974005/ezgif.com-video-to-gif_1.gif?ex=682c4895&is=682af715&hm=0d3e18ffe13f6d9bbe132dc99ea91d0e027a934728cfe2baf0641dd25a7bffa8&`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372292546289471601/IMG_5309.png?ex=682c2d46&is=682adbc6&hm=40418101e8bb9775df36d3cc782d600a8f8df513861022eee5200ee7d8b9ac00&`,
      `https://tenor.com/view/goku-prowler-goku-goku-mad-goku-dbs-dbs-gif-11120329515669448575`,
      `https://d.fixupx.com/ZERODMC5/status/1922471642254516271?t=Rmdx1IhgCwqog-trnceidw&s=19`,
      `https://cdn.discordapp.com/attachments/1277665563451199552/1372211412482658547/IMG_3007.webp?ex=682c8a77&is=682b38f7&hm=7a2066cdc75bd72972b5e00a875714a65ed54252cc54d871b48ce69b861ad8e8&`,
      `https://tenor.com/view/legend-4x-soap-legend-4x-sap-penthouse-backshots-gif-9078843770739247009`,
      `https://tenor.com/view/convenient-store-soap-legend-4x-gif-11492371569526361169`,
      `https://tenor.com/view/trash-can-floating-trash-can-garbage-rubbish-soap-gif-1326801645248012893`,
      `https://tenor.com/view/santa-santa-soap-santa-soap-gif-legend-4x-buffalo-wild-wings-soap-gif-4950479730416799474`,
      `https://tenor.com/view/barnes-and-noble-library-4x-legend-4x-legend-soap-soap-gif-2300793613653863013`,
      `https://tenor.com/view/legend-4x-soap-legend-4-x-soap-red-robin-backshots-gif-9378008123558657750`,
      `https://tenor.com/view/legend-4x-soap-hospital-gif-17717532597315888642`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374061372903788737/KILLALLPMFANS.gif?ex=682cade0&is=682b5c60&hm=6184cf4f1eca19e52f5c1db6a3547ee21f62a73b6c850c360100d4241f9f40b4&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374061372580692008/IMG_4804.png?ex=682cade0&is=682b5c60&hm=2dceb97681881e76ce7439b003585fd9aad2e9e40f32c0352c9ccf0dbf32cf2e&`,
      `${randomMember.user.username} is a balding chud 💔`,
      `https://tenor.com/view/king-engine-gif-14418252691903487661`,
      `https://tenor.com/view/5x30-workout-workoutmeme-meme-5x30meme-gif-7631146929495570394`,
      `https://tenor.com/view/12-f-police-fuck-gif-10445238489736079726`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374068242657841334/GMHRqjWXcAEN7m6.png?ex=682cb446&is=682b62c6&hm=21f6f9951f57818e3b3d0a22e2d3ab85d0531f8dc6a1e8c340994df2dc2f548c&`,
      `Tiger drop negates any damage`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374068674272694332/GHuEogvXAAAvUeL.jpg?ex=682cb4ac&is=682b632c&hm=abdc14a0620d3cdc41d8d2a9547363f70d6d08c825c5e6b54798d843694ae37d&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374070181986570340/Screenshot_2025_0519_183839.png?ex=682cb614&is=682b6494&hm=665b58c14d6f191ac1d77fe7d8a393ae370108611507866812441ac9a7c2c2fa&`,
      `UNTIL NOTICED <:crying:1285606636853137560>`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374073621865300089/boly.gif?ex=682cb948&is=682b67c8&hm=19670d0563291da67f0dbfeadb07b20717493e09d468122fadd1edb724b391fc&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374073622339125402/IMG_4531.jpg?ex=682cb948&is=682b67c8&hm=d131f7f55ebc6a5f8ac1530a29359b6b0acca4a5b1d196cfb12a431ae9c6ffcc&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374073644031938621/Screenshot_2024_1122_210756.png?ex=682cb94d&is=682b67cd&hm=4a059ccc98c75a6bfb2fbe8e8578871e8e85d4b0d2cb6dcb3bc19ecb6c1286ab&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374073926707056651/20250407_000818.jpg?ex=682cb991&is=682b6811&hm=50e131b33fefde0a3cdddb809cbf13fc7a3b41ff3bb189133071923392e1fe64&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374074328353603707/artworks-7WGlRXYa9TKmjBrd-OlI33w-t500x500.png?ex=682cb9f0&is=682b6870&hm=e8a57bcc41c56838007d5d69ef3e077e2f84d0f5156ca593619b2d19457ebc94&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374074428048150631/image.png?ex=682cba08&is=682b6888&hm=44dc8f981a2ec6812c19055e5bb077866e13507584769b2fac21f1f1b45b7260&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374074489947557908/does-this-sub-like-dumps-v0-csdxnyqee09d1.jpg?ex=682cba17&is=682b6897&hm=e305486ea4e82962a6e4bb48c951466e29985783536c519323e63358f36d7560&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374076594787717160/WDvZgB4p.png?ex=682cbc0d&is=682b6a8d&hm=81fdd642532cea726c8fc1b5482f490c75ba76a3e75c754d7809eb43639d86f7&`,
      `https://cdn.discordapp.com/attachments/1374052923956269136/1374076636454195342/Snapinsta.app_video_AQO0PXRhkK5Wjo1-u7Xd7qKJTtfJwLlnWr9PEtIspbmbBWxEfEX0EhKNwNLvYd3vZDxbzYCW4IrZsSNh57QaDkSSnGV8aI4Y0ZvTKw4.mp4?ex=682cbc17&is=682b6a97&hm=fa13a8874c90ab22a141a27added9013eae1853d3461788ecf4dcbcea8fc8451&`,
`https://cdn.discordapp.com/attachments/1374052923956269136/1374087035161284628/IMG_3456.jpg?ex=682cc5c6&is=682b7446&hm=4416d44ef71aa19496f03b1d7019f50e6fe5336c35fb86517c1af969a87f0a5c&`,
`https://cdn.discordapp.com/attachments/1374052923956269136/1374087049379840070/IMG_3483.jpg?ex=682cc5c9&is=682b7449&hm=16adcbe9c210bbea0ac2d7f33eb5ff3ab4b7c10cdffd40fd7e21f63580d62980&`,
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    message.channel.send(roast);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});