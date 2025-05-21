const timers = new Map();
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

const SPECIAL_MEMBERS = [ // Uncle refugeers
  '1346764665593659393', '1234493339638825054', '1149822228620382248',
  '1123873768507457536', '696258636602802226', '512964486148390922',
  '1010180074990993429', '464567511615143962', '977923308387455066',
  '800291423933038612', '872408669151690755', '1197176029815517257',
];

const SWAGGER_MEMBERS = [ 
 '696258636602802226',
 '699154992891953215',
 '1025984312727842846',
 '800291423933038612',
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

      // Log all exiles immediately
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
            
            // Restore appropriate role
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
      
      // Restore appropriate role
      if (SPECIAL_MEMBERS.includes(target.id)) {
        await target.roles.add(ROLE_IDS.uncle);
        message.channel.send(`${target.user.username} the unc has been unexiled`);
      } else if (SWAGGER_MEMBERS.includes(target.id)) {
        await target.roles.add(ROLE_IDS.swaggers);
        message.channel.send(`${target.user.username} has been unexiled. with your little swag too ig`);
      } else {
        message.channel.send(`${target.user.username} has been unexiled.`);
      }
    } catch (err) {
      console.error(err);
      message.reply('An error occurred while trying to unexile the user.');
    }
  if (true) {
    
  }}

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
    if (Math.random() < 0.01) {
      try {
        // Store original roles before exile
        const wasSwagger = message.member.roles.cache.has(ROLE_IDS.swaggers);
        const wasUncle = message.member.roles.cache.has(ROLE_IDS.uncle);

        await message.member.roles.add(ROLE_IDS.exiled);
        await message.member.roles.remove(ROLE_IDS.swaggers);
        await message.member.roles.remove(ROLE_IDS.uncle);
        
        // Log the exile with self-as-issuer
        await db.query(
          `INSERT INTO exiles (issuer, target) VALUES ($1, $2)`,
          [message.author.id, message.author.id]
        );
        
        message.channel.send(`${message.author.username} just got exiled for using -hi 😭`);

        setTimeout(async () => {
          try {
            await message.member.roles.remove(ROLE_IDS.exiled);
            
            // Restore original role if applicable
            if (wasUncle || SPECIAL_MEMBERS.includes(message.author.id)) {
              await message.member.roles.add(ROLE_IDS.uncle);
            }
            if (wasSwagger || SWAGGER_MEMBERS.includes(message.author.id)) {
              await message.member.roles.add(ROLE_IDS.swaggers);
            }
            
            message.channel.send(`${message.author.username} has been automatically unexiled after 5 minutes.`);
          } catch (err) {
            console.error('Failed to auto-unexile:', err);
          }
        }, 5 * 60 * 1000);
        return;
      } catch (err) {
        console.error(err);
        message.reply('you lucky as fuck for not getting exiled at 1% chance');
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
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374087241638608906/ntdgm_gcm_gvcngc.mp4?ex=682d6eb7&is=682c1d37&hm=a905fb815d0eddf14893140f0574f10f4b6d51ad75ec19dcebd36d3710105f02&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374094399662854245/IMG_3360.png?ex=682d7562&is=682c23e2&hm=554c7724cdad3c19b89eaa088018feab6c85fb1b6efe4c0fa499d1ffa3264feb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374094438728597646/IMG_3386.jpg?ex=682d756b&is=682c23eb&hm=2f940e901d9fa9e06c1913e616c95b45b843811ee2a4f4a0573072ea1eac1ef8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374094509532512256/Screenshot_20250512-204837.jpg?ex=682d757c&is=682c23fc&hm=de4042d4882c97753412fd98aac1c5714518a0dc92de7f140f764ef3cceef77c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374094523197690028/IMG_3108.jpg?ex=682d757f&is=682c23ff&hm=5bd1f4e0686e5655e505c83870551d2f81632e56af23b4c63ec9c8ed1aa4d88d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374094571960533022/Screenshot_20250510-005253.jpg?ex=682d758b&is=682c240b&hm=a0e6c90d825706a9734c7095edba09bf6499872e4371e0565de85f4f71df4bb8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374094608727805972/7503209184310218006.bin.mp4?ex=682d7594&is=682c2414&hm=847d78cfeec329f035a1b2408d0e7b94b098592066a64a88ec14a986552bea24&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374139634187112468/image-126.png.jpg?ex=682cf6c3&is=682ba543&hm=b5062262cfe8a5647d5bf5c8c6beffab5f2a96b0a8cf83d7cb951ba04c6f21f7&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374139670992125962/image-144.png?ex=682cf6cb&is=682ba54b&hm=881cda6fd37ace003c545e60a0083e9fdc81343eaf68b3a3701b18241c3215b0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374141067116548237/Screenshot_2025-05-13-21-23-26-10_1c337646f29875672b5a61192b9010f9.jpg?ex=682cf818&is=682ba698&hm=1d9896ce5baff779c07869d652afbb2f38c982e89678236ac73a0f86bdc3fdbb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374199873175552020/c945905e39fd8023ca7398a4740aa8f6.jpg?ex=682d2edd&is=682bdd5d&hm=dbcf3e2d5058042528173d921f769a6a8a30f7c936a61aa4ab3a27a79542ed4f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374200190457876500/runaway-fnf.gif?ex=682d2f28&is=682bdda8&hm=6e66e3ceee7adeed08335eb0d5a10a52b9b481bd0ab5af099afd3ced2ba0cba4&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374219134346461184/Gq4MR4ObAAA8xmA.jpg?ex=682d40cd&is=682bef4d&hm=3a1efc5fcab52971ecac0ba78783677bad9495b201cad4d0e7655c8287d1d8ac&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374220998400016458/No_fighting.mp4?ex=682d4289&is=682bf109&hm=a6a2a89c31b1c63b69d4abbf3e29018ffa34fa88f68f6b618cd0a3813283a12f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374221078506766407/twitter.mp4?ex=682d429c&is=682bf11c&hm=d9d38f2a389dd310bceed54070e390952933fb61eb5007f4b8de8e59859808a4&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374235605734653952/20250508_123508.jpg?ex=682d5024&is=682bfea4&hm=ae0cc02b4c13723f85d9f574a3f82cca575145fb9e94d00263d61a5a7dea52a7&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374235639989538907/cachedVideo.mov?ex=682d502c&is=682bfeac&hm=78ddedd6c81f04daf7eb70b37a954309dfc5d8e69132cf613325a13f699bcea0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374235726144606268/IMG_4141.png?ex=682d5041&is=682bfec1&hm=8da2413e6ee731b4ad6e7e3f0bd51faa78733aaa47ccaa8b97d5fcf8a588f3ec&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374235783506034758/Trunks_.mov?ex=682d504e&is=682bfece&hm=e5f9e3761e8f6e3176a9a62c2912d5b7e84bc075b90259a86cb9b8f8bc70f0bb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374235800463478804/cachedVideo.mov?ex=682d5052&is=682bfed2&hm=b2c2218202b99cf4540b942895d5b999b207bd757623b9c8f8d056a1247b2bab&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374236008421261404/20250421_104336.jpg?ex=682d5084&is=682bff04&hm=10f65ef38539f8cd5d086510394fb835a99dac7f0a4d7973ba75b824efb1686f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374236028747120810/IMG_4118.png?ex=682d5089&is=682bff09&hm=62c4c607308b3a7b2a66a9dc584ccdf7c05e66f36caa2d0a793baf1af6cb83e5&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374236075874320485/IMG_3997.png?ex=682d5094&is=682bff14&hm=16dfb2b8d5185b815aea36028aadbb1a3c69bb6ba5ac20897a67706537a9a70d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374236168581025983/cachedVideo.mov?ex=682d50aa&is=682bff2a&hm=6e309fa509cc95c393dec3371a1c2a322b65d0b51d871d8e7b2a9c7edea9acbf&`,
        `https://tenor.com/view/glitch-class-funny-glitching-gif-1278280886870965156`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374251549584527360/20250505_090648.jpg?ex=682d5efd&is=682c0d7d&hm=086e7e102db47b4716ec64919a803bfe01e70f9fd17e5fc7034258e2f66de964&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374251575656189982/R5DotYfXjMfMd59j.bin.mp4?ex=682d5f03&is=682c0d83&hm=1d6da7471e4688f96f8f1fcf52e02538d73e643a2112bb646c6803829798f7ba&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374251758913585234/011554bc95589fde3301c3f2ba061e4d.png?ex=682d5f2f&is=682c0daf&hm=3a9d4f2b4e21b32dd03fcf1b40302187d9fa491d58568fd22879aa1875c3b63c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374252859474051153/IMG_3845.png?ex=682d6036&is=682c0eb6&hm=e26a82ef3348d16c145af7427993ccba193348bbb8a1c39576ca12a6b45758dd&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374260116408504440/image0-2.jpg?ex=682d66f8&is=682c1578&hm=470b9e60b74588d1d3272b2315263b9947dc1d9275e0e4dd8126dd61443103a5&`,
        `https://tenor.com/view/gunna-gunna-irony-fail-gif-3072952405512598422`,
        `https://tenor.com/view/lapiscel-horse-funny-quiz-gif-15349069977875529804`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374300367545958410/STW_amr.mov?ex=682d8c74&is=682c3af4&hm=a1fbedffa3997df5cf0bafd2e06187cd59e3bd81fa947ed3ad9db298229bd6d6&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374300424764526602/755.png?ex=682d8c82&is=682c3b02&hm=6d4e1765e763726828f578aedbbba238749d9453699e426d88a55e004fe09f3b&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374300533258457088/Screenshot_2025-01-25-21-15-59-22_f9ee0578fe1cc94de7482bd41accb329.jpg?ex=682d8c9c&is=682c3b1c&hm=a41df7745de50677cc5df6dbf2eca1cbee03f2176542a0f88c615ccf1ec05598&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374301253236031571/RDT_20240729_185201724152992456539125.jpg?ex=682d8d48&is=682c3bc8&hm=400cb03e42c3453bdd8a5c1ae73eea749c855518aefde6ed22d296eec5c92240&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374301866912907284/IMG_3212.jpg?ex=682d8dda&is=682c3c5a&hm=76489c0deb717010ee9eff42865de28785b793effa3ccc96e8f22cee621faac0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374303556848455712/N_Vanknightling_by_MWINS-1.gif?ex=682d8f6d&is=682c3ded&hm=814b80640ee9affa693e3b6a4d32f9b3f0218dde98b69b3776631163c2991cfe&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374303641372196936/IMG_3322.jpg?ex=682d8f81&is=682c3e01&hm=405149e66d9af713e8b5308bd744c681412ba2c955246acebad7932c5c871711&`,
        `https://tenor.com/view/freeeezeee-gif-5460290174988832181`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374303719470006342/image-330.png?ex=682d8f94&is=682c3e14&hm=248bb21788fbf4a9eedeb106591fbdf0a0886deb1e68d996fd86f42e955c8551&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374303757688373349/IMG_20250405_135305_500.jpg?ex=682d8f9d&is=682c3e1d&hm=df154b8c5b2b99ced0aaf96c6f5ec74a413f1cab5b7e80af974932690c51d342&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374303825183117403/Untitled247_20250426190407.png?ex=682d8fad&is=682c3e2d&hm=eae9ce1b93e7cc2206fd6fef17edbeb35084af9a47ddef8395ad334e9d624092&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374304096890261556/image0.jpg?ex=682d8fee&is=682c3e6e&hm=e8536906d5e136f4c8cb9aebacd630d00e89d78f08735f593fb1d0605965d620&`,
        `https://tenor.com/view/domain-expansion-infinite-void-9-hour-work-day-9-hour-work-day-gif-16286933711310234106`,
        `https://tenor.com/view/keem-baby-punch-family-ties-gif-8232811902512675329`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374344742522851359/IMG_3480.jpg?ex=682e5e88&is=682d0d08&hm=33868216d12ee2a75141c6258b6fc0b73baddb4dbb651a61093d6745cab8221d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374344766090903632/Huh.mov?ex=682e5e8e&is=682d0d0e&hm=5d2f7958250dfa05093ef8f80edc0f73ddb777b4a958f89bbe56ac21ed7ecdd8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374344864770293770/IMG_2852.jpg?ex=682e5ea5&is=682d0d25&hm=a39393684e2b12e8488638c4094139359bcadc4e1498e07440b8bdb87fb4d611&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374344894575018074/IMG_2758.jpg?ex=682e5eac&is=682d0d2c&hm=12fd6ec761b5441e6c2fc76c60fbef960d1b0607c3e1457a6dd58d21115806f0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374344972261920788/IMG_2674.jpg?ex=682e5ebf&is=682d0d3f&hm=7d7b316b4da8011f086b6e1ca4af91c80f2ece38b9846c7a1d9e1b4da2f8617d&`,
        `https://cdn.discordapp.com/attachments/1063636124565766224/1373441303068545144/copy_370514A8-D799-4D26-BF58-99E336CB40B8.gif?ex=682e60e3&is=682d0f63&hm=2d3468db7a837279f91f8489d185f2aaeec6b851e675bf1419922b57595437c6&`,
        `https://media.discordapp.net/attachments/243921135526215692/908213239039533056/caption-1.gif?ex=682ea97d&is=682d57fd&hm=3e4a9294492c1bc3ed6aad4a9b684786895441ef8cfea8f7bf396bb77db06553&`,
        `https://tenor.com/view/polar-bear-spring-flowers-sleep-sleepy-gif-519841092432216074`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374348554113519736/Screenshot_2025_0111_192541.png?ex=682e6215&is=682d1095&hm=3110582698c3ab56384c6f10d57559925cf1df4c4a216f91b87581f267cd4541&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374348955219005450/akiyama.png?ex=682e6275&is=682d10f5&hm=8b36c34a4781d1462081eeee2823cbf03a0ae4c1f654394823b1caa876bfd861&`,
        `african asses bouncing`,
        `tiddie jiggling`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374356962460045393/B1214C9E-74B4-4D4D-B346-3709ACD34F95.gif?ex=682e69ea&is=682d186a&hm=31995a2da20e1b3687248627b73f0c703993c61243edd3e4a503f928dadaec74&`,
        `https://cdn.discordapp.com/attachments/1358162872118808848/1369994442580426822/ballscratchr420_-_1919850333569765704.gif?ex=682e5d00&is=682d0b80&hm=d608d16e45a87a7f893a52179580a8694ac689c231632eb6ac280f676c40b23a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357303993827390/20250517_085156.jpg?ex=682e6a3b&is=682d18bb&hm=293907d8c26cdf74fcd4ca5f599f8c8eb686dbb9f060d77f272bd4701006d5fa&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357304287432774/20250517_112651.jpg?ex=682e6a3b&is=682d18bb&hm=1e2599fdd8bf95916c15227161c17f749d7ff5785feb7fa70b11ca281c2c5b4d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357304576577576/20250514_214410.jpg?ex=682e6a3b&is=682d18bb&hm=c34505d3c0c46264cc611d9d83615107aac9ff4a0ad9e30500392dacf6764365&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357304807522304/20250514_205939.jpg?ex=682e6a3b&is=682d18bb&hm=a863bab822dc42238648de8228b7dea066947f0eb34fe70c48bff6849d700e9e&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357305188941884/OldFreddyStaringIntoPartsServiceCam.png?ex=682e6a3b&is=682d18bb&hm=c6162a6f5075bdfbcaa725fc38d49567b4b13ff562e2a28496f4dd9382d1dd49&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357306007097356/20250514_095324.jpg?ex=682e6a3c&is=682d18bc&hm=2b15a0220d498b60af1ab3dc033cb9a00f8c9aa6b9eb7c92386f1c4c6429cb38&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357306459947109/20250514_085724.jpg?ex=682e6a3c&is=682d18bc&hm=5e4fc56bdf4577cbc5a107890830ce2f8a8c0120899e1ae5aa8c7e705b426b5b&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374357306841763911/20250512_215737.jpg?ex=682e6a3c&is=682d18bc&hm=19cc8711689fde63ff1ff3cda0ee5b3834a6bb4042bad59664d6f0b358ef4b2c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374377044326223953/1717763919_new_ezgif-4-164632c27a.gif?ex=682e7c9e&is=682d2b1e&hm=70187f96e644ab7e938449826f10a80d4be819e6e45fe94d5ef8983baa5ea582&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392388566519839/20250406_134604.jpg?ex=682e8ae8&is=682d3968&hm=598fe39d1162692c02784004470b76626dd713d46b2a68e08397c7db9a55cfae&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392389254516766/20250401_204115.jpg?ex=682e8ae8&is=682d3968&hm=4b03a78761be49d0d5c6655d75a7497b25e662f4a4a2946faa5c550ba3df693d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392389724147732/20250327_075055.jpg?ex=682e8ae8&is=682d3968&hm=e8c985894a518a5a2f1f25e2c7f97b2938657814a4ec303daf4ed186485d13ef&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392389724147732/20250327_075055.jpg?ex=682e8ae8&is=682d3968&hm=e8c985894a518a5a2f1f25e2c7f97b2938657814a4ec303daf4ed186485d13ef&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392390097567784/20250327_095221.jpg?ex=682e8ae8&is=682d3968&hm=feae4a35b5659183327bf74d608cbad9bf39ffff1f962fd8cfc1adbf1ad60e1f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392390680313986/IMG_20250321_074955.jpg?ex=682e8ae8&is=682d3968&hm=736378aefd0ae7b42fd0b27796cb348e1a62fe64097b7aca239eeef8e6c13e6c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392391288750262/EOgbXKKXsAQaAhi_edit_674851682261105.jpg?ex=682e8ae9&is=682d3969&hm=75f15de5be6df46bed6fcdbf8810fc132c71c6509e7be70d3db0194d15e6fd00&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392391863242873/20250307_131615.jpg?ex=682e8ae9&is=682d3969&hm=72162ae05d7cbc1aade41b08e7a845fe5cd3a52cfd0902d873d098a4ee699c20&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392392165363774/20250304_204328.jpg?ex=682e8ae9&is=682d3969&hm=0f4a639293d3d0386154e04d0779e8b6f6b5f6e7654bf3eb995af0cc47fef39e&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392392551104522/20240201_164014-1.jpg?ex=682e8ae9&is=682d3969&hm=355f16bb708b2bbe24d27f949dcebc51c3bb6e332c2bb35a9210327fdb4f3aca&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392393293369427/20250227_135031.jpg?ex=682e8ae9&is=682d3969&hm=ca31cb56d31db52a386f063002117186f40d0f250bec818c29c88ad9f9346ea1&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392484402167999/n9ftf6hztu081.png?ex=682e8aff&is=682d397f&hm=92d5efd9b82c12b2c3a017ff396c15d1650dbfc475d03f1752bf2540db727cf5&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392646289723495/20250225_163135.jpg?ex=682e8b25&is=682d39a5&hm=69821e50d6adaa764e55b1e5abefbe24f15aee7b7c4e3d27cdff08a79bcfeb70&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392646574932141/20250224_220624.jpg?ex=682e8b25&is=682d39a5&hm=a6fa2e0704e7cfe93453ab552f6f287c418462863e7ec693975e1f44d871ce5d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392646960676914/20250223_001026.jpg?ex=682e8b26&is=682d39a6&hm=5a0d7e73419b800de61aa39de31158930a5d274c4e81651f2215d935c53507f8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392647552209007/20250222_221828.jpg?ex=682e8b26&is=682d39a6&hm=6ff2c711690fc66da659d469618c91722daaf6fef766ceae7d8a390f9b567e8a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392648110047262/20250222_175415.jpg?ex=682e8b26&is=682d39a6&hm=ba342e58a9df17f0c70805171744ff4b61ee9b0526be427daa24b5660066fdba&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392648596455434/20250222_105048.jpg?ex=682e8b26&is=682d39a6&hm=bbc91fbeb315373ba678318bdfdefd8ba78da842cc4e74c7d4fab1c9fc2617fa&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392649145913365/20250221_184405.jpg?ex=682e8b26&is=682d39a6&hm=94e531dd15f0ee57a95ab70aa30c8d012a60c19f3c404b534eb655f52077704c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392649414344836/20250221_100914.jpg?ex=682e8b26&is=682d39a6&hm=77f012e71d3df946a6d6f48ae4511c12a36ea2852239f0a956d5d052f542140d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392649695367259/20250221_100849.jpg?ex=682e8b26&is=682d39a6&hm=b4eb4d0112677c74db8ed28bedd7dd64200c103814c34de5844332eea592d423&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392650085699747/IMG_20250219_161633.jpg?ex=682e8b26&is=682d39a6&hm=5267f5146ace3abb28d131b18e2bc4d96ae4f98e381cf22b35454e930b744293&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392877425233970/20250213_041900.jpg?ex=682e8b5c&is=682d39dc&hm=dfcfa58968ab089fe9c8a7017ce937e7f0d6beb53bee2ec38366da1cdf82fb30&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392877743997028/20250213_214959.jpg?ex=682e8b5d&is=682d39dd&hm=c85f46b5ec94b3fbc2f43b1c7ac1e92d73019a7544275dc0d9be5e60093c2979&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392878045855805/20250214_043328.jpg?ex=682e8b5d&is=682d39dd&hm=72b028f4aea69c3da364bb0e51775bac717825a03819f8cb9c24ee4f526ff948&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392878280740985/20250212_074617.jpg?ex=682e8b5d&is=682d39dd&hm=da59e88a3867c039616109032b2a1d336d9b37874ef73e8813c98727347cf599&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392878574604328/20250211_150513.jpg?ex=682e8b5d&is=682d39dd&hm=f33708c4220cf6615b2b1d0078e5485163ac9924cee18d66b924ebe5a2b1a25d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392878830194758/20250211_095524.jpg?ex=682e8b5d&is=682d39dd&hm=c16f61e6820a198d13ce80d87c8861b20f607b18f92e0f50ff221ab65ba89e75&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392879203614730/20250209_115918.jpg?ex=682e8b5d&is=682d39dd&hm=b17e2b60376ee1609dcfd193850271de793e3ef694ffe4cd16530837b5ddead0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392879409004564/20250209_130632.jpg?ex=682e8b5d&is=682d39dd&hm=d0cee25f1a701e032b89ce19b9f251b712e9a788519af9a102192f89c0d677ad&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392879635632178/20250208_112518.jpg?ex=682e8b5d&is=682d39dd&hm=a923af2519292ebf0bad32dd857d4620509ada6a8945a5e2e885e2a91b36a797&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374392880042475661/20250206_162330.jpg?ex=682e8b5d&is=682d39dd&hm=0baecb24237707634b112f5ce21dbc1f90d3b6bbbdd4e9c8e9d527d6647396a9&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393087698276473/20250206_081103.jpg?ex=682e8b8f&is=682d3a0f&hm=3194501c5fb7d29860504c29583bc3f4a5fe74ff9cea558b3b3945f27d77eb7a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393087970771005/20250206_074132.jpg?ex=682e8b8f&is=682d3a0f&hm=cd9e7dc216ed0471399c92a29910a33e6c6bbdfb55b581995ddd717c25be8677&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393088390205460/cachedVideo.mp4?ex=682e8b8f&is=682d3a0f&hm=14f2964a54d1bfbb8c93c50461ee2f8242a9c0f50dfd0d64e594274a6e97cd32&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393088851574806/20250204_162143.jpg?ex=682e8b8f&is=682d3a0f&hm=45de58cdba526703f851aa4ae03b4e001af3059fdd32d323c01ebfec5e8bdd6e&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393089061552270/20250204_204528.jpg?ex=682e8b8f&is=682d3a0f&hm=cf02dee3db51feb691d0c15bd40c0e19dd429031586d76d62025f1fe5c02d5b2&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393089325662340/20250204_142443.jpg?ex=682e8b8f&is=682d3a0f&hm=9bd6795faf86d56f3e9b6ab076dd6b5cc7339f0e5dfdfaf50b7a061a82777306&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393089535512808/20250203_122040.jpg?ex=682e8b8f&is=682d3a0f&hm=6feaf3a7f5b9e609511fca901c9f6f4bfbc2738cd546cb75cf5e57b19121958a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393089799749652/20250203_121555.jpg?ex=682e8b8f&is=682d3a0f&hm=764c4ba66ff866a5d2ba2dddc13926c599efc35f69301985257309558490d51d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393090055471196/20250203_090155.jpg?ex=682e8b8f&is=682d3a0f&hm=40e80205184c3a15a6f7a12dfff9ebcfd66b1f7672e286917951f8ec02e67236&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393090340552735/20250203_075619.jpg?ex=682e8b8f&is=682d3a0f&hm=ffdb10dbbb5babb8cbe5b0a4887271a2d9982c5508ce6d058ab1a80d45d323a3&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393251989159957/20250201_154625.jpg?ex=682e8bb6&is=682d3a36&hm=3c760a6055c208931d8636ce0a6df1532390587ec4f401938e9c2c8e1785b8c2&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393252270047303/20250201_154340.jpg?ex=682e8bb6&is=682d3a36&hm=8c2f21f05176cd8209782cf18584a425db962117e1a69ed4f1a5d55164f86d00&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393252593270885/20250201_101318.jpg?ex=682e8bb6&is=682d3a36&hm=32216a0b61c8de0e62d52c026a12d989656c3a5c53236ba7a1138eb8e05f368d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393252836544644/20250201_122912.jpg?ex=682e8bb6&is=682d3a36&hm=ab14397560e6df97e9099ab3073c496f81072cdb5016f238fe0e8f2155abbffd&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393253389930695/Sultan-GTAVe-front.png?ex=682e8bb6&is=682d3a36&hm=843083368bdfd82904294b2a98779d45a404c7bf2c7928305d9a41f560d6cc7a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393254312935454/20250130_170958.jpg?ex=682e8bb6&is=682d3a36&hm=d18dc1c7e9f0ed39ab878674a9d47a0d246c8fc24fc372e3c4ef76a6ef9caedf&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393254774181969/20250130_151835.jpg?ex=682e8bb6&is=682d3a36&hm=348d36a22c87dcc39d01fd4f3dedc3b12170b5ac1d077102f984820cc6fbb1aa&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393255286014053/20250129_160138.jpg?ex=682e8bb7&is=682d3a37&hm=df611e7a5ae1c751a3588afb9887ee19fd62d3cbd69aa79bd3437857c847336f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393255676088402/20250129_095420.jpg?ex=682e8bb7&is=682d3a37&hm=31e35d36a21b3711a905ae1057047e70a52cbe343738587aa00ed9da97d106c7&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393255994720326/20250129_075243.jpg?ex=682e8bb7&is=682d3a37&hm=38c15f511ec5707d53c99dd3706508b9b184dc69e6d0b6149b6635af844fefb2&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393362895081532/20250128_041420.jpg?ex=682e8bd0&is=682d3a50&hm=381c8d913ca75182878e22fe211a51b63df1aa9c2ed39cf7d1338077e26acbe1&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393363108724746/20250126_224901.jpg?ex=682e8bd0&is=682d3a50&hm=d7134c15e5259aa96ee1619cd0ec3f237c21438b378a181c2f9701256328a5b5&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393363423428698/20250126_233649.jpg?ex=682e8bd0&is=682d3a50&hm=38f91eb080326f44f68e698481c83aaed7fddff859cd38b2703a62bd6a60e6b8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393363658444880/20250126_135339.jpg?ex=682e8bd0&is=682d3a50&hm=7a1958a7b5793e73a19b29903929bc7ba346f0ea0253799ef87835695950f8e6&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393363918225620/20250126_135055.jpg?ex=682e8bd0&is=682d3a50&hm=eb460cc800e72c129ddaad8902a95bec7c8d2889c19a8a3312bc37459b8b62ff&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393364153237525/20250126_124221.jpg?ex=682e8bd1&is=682d3a51&hm=84b6d5d94ee4561d20a0ff74dfc12661601e25f0a6293d05df3f8ab037689741&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393364409225216/20250126_134214.jpg?ex=682e8bd1&is=682d3a51&hm=967159bfb80c22d60825b621abf087b7522f7e3c8ffe463065a8f442b1cffa96&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393364635451453/IMG_20250126_040122.jpg?ex=682e8bd1&is=682d3a51&hm=7bd86d1ed702301a58d42327d2f81a534646f70e7e6fe17a6fdba342c440cb07&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393364841103550/20250126_011506.jpg?ex=682e8bd1&is=682d3a51&hm=4e57fdf87ec1654727bbb4f36046087cbbfeadd1406d206c7869fd49eee7ec3d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393365080313928/20250125_121638.jpg?ex=682e8bd1&is=682d3a51&hm=768a31b98023864b7f4d9d35090848df5c2bca693b3751cbc9d037526b1e943e&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393688716738730/20250124_075845.jpg?ex=682e8c1e&is=682d3a9e&hm=1b82242a3cd640f6c65045ed84ffacc1cf444571c2d3ec0d6bffa1d34fc81fca&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393688960012389/20250124_075256.jpg?ex=682e8c1e&is=682d3a9e&hm=d412509d229575ab7403d51c30f3c994b9e65a2ebb8f07f6f33e9f49c6d1fceb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393689211928607/20250123_214908.jpg?ex=682e8c1e&is=682d3a9e&hm=e0f1585fc88802c991614589630bdc260d3b4ccefb8cfc4b22430b9cc965d6a4&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393689475907594/20241230_162654.jpg?ex=682e8c1e&is=682d3a9e&hm=b3a9901bc115880b47874724de7a52cd95a35d8cbf4afa580373dfdb75e1aa02&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393689719308368/20250123_115559.jpg?ex=682e8c1e&is=682d3a9e&hm=524d3bef72a4d96b361eca87018e2214278a4b079d4306a348f1e59a3fb91cb6&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393691409485965/20250123_081340.jpg?ex=682e8c1f&is=682d3a9f&hm=35a2ca5ae37758876b437276522807cd31a5e92134980cd479692cfe06739abd&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393691770454066/20250123_081419_edit_55120022485481.jpg?ex=682e8c1f&is=682d3a9f&hm=ba4cea060e8d06268cc47503186607294571a473bc1cf612cc86113f9693995f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393692177043547/20250122_130635.jpg?ex=682e8c1f&is=682d3a9f&hm=bd913c636cc4c864dd2f857925863df19d0558e396325953e8e65340afc093f4&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393692529496205/20250119_224410.jpg?ex=682e8c1f&is=682d3a9f&hm=ba1bf633b7316639dad32ea994036dad2b1646149652ed7c35562aa6a87847b0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393693125218364/20250119_162753.jpg?ex=682e8c1f&is=682d3a9f&hm=9d5fc264964bfad86981a988b917bbb1054c4760a299d69f81c63c8e7394b0d1&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393870485557269/GfazL_0bcAAORWO.jpg?ex=682e8c49&is=682d3ac9&hm=95dae0f4ea69467be7f75855a3790990d0734c4d752d522a9fe7f3eb7d63cc80&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374393966719664229/7508510b606594802090bac54ed74bdf.jpg?ex=682e8c60&is=682d3ae0&hm=dbeba7e6303fd8e507133b7cd58f779b5bd1d40c92d1f4777b15f386160e851f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394040262332466/vegeta.webp?ex=682e8c72&is=682d3af2&hm=6fdc4915ffa4509118d111d58cd5dd252cf2c93216cda38648fdf55ec5e2d6e5&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394042183585943/20250112_011826.jpg?ex=682e8c72&is=682d3af2&hm=89b12493f60b0f3eae558993ecf8d1d7d287bf354eff1c68bd8d6181955b4309&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394042431045780/20250111_221649.jpg?ex=682e8c72&is=682d3af2&hm=159f2a0dbc37b246ea162614fce40d224f062547202642e89292042855a6fa52&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394042431045780/20250111_221649.jpg?ex=682e8c72&is=682d3af2&hm=159f2a0dbc37b246ea162614fce40d224f062547202642e89292042855a6fa52&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394042657411072/20250111_213259.jpg?ex=682e8c72&is=682d3af2&hm=11e4c41a869e8f9d38408ed8aee1d2989b73cd75171d5532940a90bc43bedf0e&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394042875379833/20250111_164824.jpg?ex=682e8c72&is=682d3af2&hm=7eb5df249bcc693ebb2cf397ec1dae0d8e1347c867e18176c9b4c847e3eabfb7&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394043160723496/20250110_133604.jpg?ex=682e8c72&is=682d3af2&hm=1d4bcc0770574a0d1d83e910ae5c566ee37cb885a3152d27e9dfac121129f01a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394043445805229/20250110_101557.jpg?ex=682e8c72&is=682d3af2&hm=d4e4a16913c0a722952a40c0bec1b248428648c68035dd8517245240a778c51e&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394043731148870/20250110_100036.jpg?ex=682e8c73&is=682d3af3&hm=7bef0480bebfaf0efa9f9255487b0fc7315d67588a1031e5fbf0d4103cd9c185&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394044184137728/20250110_030520.jpg?ex=682e8c73&is=682d3af3&hm=048bf91b3c30e702c4c517b5dc7405fd81407f863e33acefab12fd4c850e57da&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394044590981191/20250106_221416.jpg?ex=682e8c73&is=682d3af3&hm=a4beec2036bf35708c0765f7add3dbd6fbaf25a61299718cf8b05e9f88b8cb77&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394044863615107/20250106_160722.jpg?ex=682e8c73&is=682d3af3&hm=27e57316aeb7155659316cf01321d42d20d770004e4cc259c006de9c3d3a49f6&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394094192820296/20250118_131213.jpg?ex=682e8c7f&is=682d3aff&hm=a25e53ed3747b8edf83e0b0ce59b78ffd5ec9e1344b8508669cfa2bcb4381626&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394094511456358/20250118_043130.jpg?ex=682e8c7f&is=682d3aff&hm=407ce0a92d41843881f9c055831d7cf8dc06a9043808e20de953132ab62c925c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394094889078904/20250117_213226.jpg?ex=682e8c7f&is=682d3aff&hm=722042d74b3d3eb724205c61dea7f1919ca8773059033517d5f8886091aa31a0&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394095203778580/20250117_090202.jpg?ex=682e8c7f&is=682d3aff&hm=3f4792e931acb8ce237c8f0e35317325a70ab52826ef53cd999f44daaf55e9e8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394095858094110/20250117_084119.jpg?ex=682e8c7f&is=682d3aff&hm=ec1d88d44f62e14ae535e25b9d47b6b91b9bfcd7b36ad71fa000d036bf568cda&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394096315011294/20250117_082731.jpg?ex=682e8c7f&is=682d3aff&hm=abb7935a7ac84b30942e9e73998ecf34a3c5c2eb5a7f09d30dc7a208b2a00e9f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394096793423942/20250116_223852.jpg?ex=682e8c7f&is=682d3aff&hm=4a9670961dd5a523db91adbb71e60501f82e70014290e1fd63e93e76b69f3511&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394097468702831/20250115_191349.jpg?ex=682e8c7f&is=682d3aff&hm=361ff89cec229f599ec0d3be8d21f6c00e25eea404453bf525050651d0cbad0f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394097866899580/20250115_074634.jpg?ex=682e8c7f&is=682d3aff&hm=d0487b325638f40cea7e818589a51f24e98d276e27ef691bea51b9e21f2da666&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394098236133486/-z3vkhn.jpg?ex=682e8c80&is=682d3b00&hm=95ed30d31bcaceb1eecb718538216c27e0a380662e7d1997857ff1a9a686131b&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394098236133486/-z3vkhn.jpg?ex=682e8c80&is=682d3b00&hm=95ed30d31bcaceb1eecb718538216c27e0a380662e7d1997857ff1a9a686131b&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394150555750512/20250202_114723.jpg?ex=682e8c8c&is=682d3b0c&hm=a4be9987f1602b95d4f2676b54c481cdaaa3031d0b2a6665a2502873079ae573&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374394324422496399/GffjWQKWcAAcOOr.jpg?ex=682e8cb5&is=682d3b35&hm=c97dd8748f904e62ded94ecf0b06e5bfdaf1700135e7eec5f5339ebd86ebd5d6&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374395369353642056/YOU_FAT_STINKING_AND_YOU_UGLY.mp4?ex=682e8daf&is=682d3c2f&hm=c4aa044c5ee779e2b987f0c048dad17908d50e457a52d5f3dc056f833b2d6ec3&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374396588163596298/image0.gif?ex=682e8ed1&is=682d3d51&hm=d844396752dcf4528979b98ed53e784d5e882c3544db52a73d801d526451d2b5&`,
        `https://d.vxtwitter.com/killer7yaoi/status/1920810354893799784?t=-pSplyYZ-SnyNwXGyVn5hQ&s=19`,
        `https://d.vxtwitter.com/musicstruggles1/status/1920399426742370583?t=w6-paKSDXPfxdbOl6gHguA&s=19`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400046749188259/Screenshot_20250519_001418_Instagram.jpg?ex=682e920a&is=682d408a&hm=13dff20a5eb58d60f963802fe5a6983b8515fb2cfa7a79fbe343253ec4af4d37&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400370851319868/e9869232bc24a53712c1e6ad9785543c.jpg?ex=682e9257&is=682d40d7&hm=2a11c4fb81c71bd46bab5760d27cba5e51a0c58700f1f7e501961b52870b476c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400414450974891/Horse.gif?ex=682e9261&is=682d40e1&hm=f5bb2a78603db2817ceb2e5c6024f7f843920179f0c41a4f5af7207e6d36d41c&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400454192267356/IMG_3485.png?ex=682e926b&is=682d40eb&hm=8333a8a5f0f87baf76ce147b8c866cf0a3abc96ce36226a17764f567d49845cf&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400476799303862/ikys.gif?ex=682e9270&is=682d40f0&hm=e8d6c01316f0ca64c2a01e977a2eb803c9988a1b4f2f2a5ade8b6cad02a42d33&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400552246448189/carti.jpg?ex=682e9282&is=682d4102&hm=8c9cb467e4d59a57784298128ef57c6e6b08a733db8db3abdd021e9a595b2ca8&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400586409181224/Tsuntime_-_1879128354651349392.gif?ex=682e928a&is=682d410a&hm=a6c2870d5b9987b9cb0a7a593c6c7f538dacf241dee30a31dfbf6a280d405360&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400824670687273/20250512_143052.jpg?ex=682e92c3&is=682d4143&hm=b147b73a88f02d25edd37481c40488443e198794f2c4380a7d0b635092cc13c7&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400824914214922/20250512_141026.jpg?ex=682e92c3&is=682d4143&hm=a52134aa5179e4ae8947568683244678a2a26a285afac251801c161ec287d6f3&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400825337577492/20250512_115652.jpg?ex=682e92c3&is=682d4143&hm=ddbf20c73d412d5e4d5fffc7be9c954b22877682b24c3bcecd9e9c03aaccfa26&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400825673384067/20250511_215134.jpg?ex=682e92c3&is=682d4143&hm=fa29632ad9e8e5ffee2bf2dab7d37752868a3ba044afb469b1d72da4700156cc&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400826025443488/20250510_210951.jpg?ex=682e92c4&is=682d4144&hm=e648825702a9083efd21cb6ece65f3279987d78616e66351ad8e0923fd3aa51a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400826369638460/20250510_210159.jpg?ex=682e92c4&is=682d4144&hm=8c883cb0de22c3b1dfd6446f0cbd46ef1ef882f6c29e1d5eac2f5f3bae2cb22f&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400826625228800/20250510_130338.jpg?ex=682e92c4&is=682d4144&hm=df840a4220bc65fcde59f56dd41187d51e58abdc43faede689daa1fb785bbc98&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400826872696942/20250510_133615.jpg?ex=682e92c4&is=682d4144&hm=c3cc6baa71bf1fac63b7748d982fad35bf4442649af8cf0d12024da5f03ef828&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400827124486184/20250510_131823.jpg?ex=682e92c4&is=682d4144&hm=57627be74065af556c2521cefb875bdf48defbb245a26083eb2af483081c43f4&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374400827392790528/20250509_205658.jpg?ex=682e92c4&is=682d4144&hm=5dbd64607613b109b8a396bcaf9678d2e2fea9ce51b6a282a6761d6c3483ed9a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374401465438961795/9c6vzc.png?ex=682e935c&is=682d41dc&hm=cb27248dbaa54ad34c13298d4f0d25ccc241be79b0a39efa91962e84a6b7d473&`,
        `https://cdn.discordapp.com/attachments/797500224997818400/1292746123299262566/eyes.gif?ex=682ece25&is=682d7ca5&hm=9ab2b546f5bafe6eeb4ecb79b62d666f11ea3284bf8d19a9584d1e9e4365340b&`,
        `https://tenor.com/view/ichiban-ichiban-kasuga-yakuza-kiryu-kazuma-yakuza-like-a-dragon-gif-10459780016552321868`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374403293295673524/20250422_135006.jpg?ex=682e9510&is=682d4390&hm=ab00160d4c06597fbc7a078a0c060a91ac766624cd972425663e101593452df5&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407020446486618/20250516_173827.jpg?ex=682e9888&is=682d4708&hm=2a9d63dc78c38495d58e3efa73032ccad7ea57be1aaf69d7aad7f92a71f429ee&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407020731695143/20250513_115201.jpg?ex=682e9888&is=682d4708&hm=4e6bfb8eada78014f2df514b19b088cfb51625c4e7638b2bb63cb5dc36530ad5&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407021029359666/20250508_143840.jpg?ex=682e9889&is=682d4709&hm=bac9d8bce24966e4620aa2d0ca050c67e9bb8c8682471e0c4a0f4f954dbb9f5b&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407021331484682/20250507_133948.jpg?ex=682e9889&is=682d4709&hm=a49dbb616c28e86c05322de5e100d148c2fec3d6a91ff2ebd215b415291dd633&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407021771620464/20250507_055325.jpg?ex=682e9889&is=682d4709&hm=65e7f2b7f6098fb70115795cd147112efe2c041ea161bc8fb8d5bdb290447642&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407022061031434/20250505_160138.jpg?ex=682e9889&is=682d4709&hm=cfacb2944f9e1d60a5ebeef8435ec7ddee4fa23cbe308fc14839294dc04be582&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407022375862293/20250506_144129.jpg?ex=682e9889&is=682d4709&hm=cfbe8d5fa8133b7a248db3f521a409145f89e7b066a7d71a75239d08e354be35&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407022673530980/20250501_210431.jpg?ex=682e9889&is=682d4709&hm=ac30f665aa468220948cbf023419555729d6825f056dda06d1cf2c29bb5c2fd2&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407023021789194/20250501_222331.jpg?ex=682e9889&is=682d4709&hm=c82301722fb43cadccfa13d95327ab5ee63e6d5301aad5e3d0d0398bf0083d19&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374407023268987084/20250420_173856.jpg?ex=682e9889&is=682d4709&hm=fc9963b1e373308843a2473a659a5b7b339abe10b8570f8e1f3e5cae86dac7aa&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374409553491267694/GrWw5ctbAAEuoLu.jpg?ex=682e9ae4&is=682d4964&hm=34235d7b7593f63ac808556bbd1c4e1de4f94d6956b31de7eafe6b0645d8f48e&`,
        `https://tenor.com/view/backshots-fentanyl-bug2sick-who-want-backshots-who-need-backshots-gif-16093671879736272076`,
        `https://d.vxtwitter.com/nullpoints/status/1924672033671282819`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374429056916918372/Gq8XHnTWkAEr_zw.jpg?ex=682ead0e&is=682d5b8e&hm=f4393ebb9f9f360a713a9fc50d9eb1119c0b4375f58d29ad5a3d0112aef7837f&`,
        `https://tenor.com/view/undertale-papyrus-goku-prowler-meme-uncanny-raised-eyebrows-gif-17919567901574007542`,
        `https://tenor.com/view/lock-on-jarvis-hey-jarvis-iron-man-iron-man-jarvis-gif-3386808663963567031`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374590668831457280/Gray5O0WgAAqzzt.jpg?ex=682e9ad2&is=682d4952&hm=227fb27221a785cfa6e6368a44d41a0a6a6a6e542d2cbb684bdb4a689b46fd32&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374592158631198781/IMG_20250226_120438.jpg?ex=682e9c35&is=682d4ab5&hm=f6f688cba8123a40331bf5402dc9aa10eab327214d33c56bb19a102c9f503f5b&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374592158874599455/IMG_20250217_150550.jpg?ex=682e9c35&is=682d4ab5&hm=d110adfc8e68406c102e17288ca1e03fdc14178eee28916ad6e742b2623c2072&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374592185416286310/IMG_20250113_143318.jpg?ex=682e9c3b&is=682d4abb&hm=b4b41afd551b9ae994184c8bc01caf90de612086c90868f35e6bb2cc02123b68&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374621671557693441/cachedImage.png?ex=682eb7b1&is=682d6631&hm=8da3f6c1e1b1187533b82a2771640a35deaec79b471f266680f4529fc9ac1359&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374621701496766535/gaben.mov?ex=682eb7b8&is=682d6638&hm=06769da9ea2f85fab3fda7d63eb2250e23bb25953a62ffc98eb0aa8f40416556&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374621742454149213/PLbDuaVW4cwWa5yz.mov?ex=682eb7c2&is=682d6642&hm=3cc59109bcb323e85d5b5375b48bf3baf4097123d5de5fc01d601733b11c5cfb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374621803720216616/Funny.mov?ex=682eb7d1&is=682d6651&hm=06930da02f151a7937a25ac81a8cb25295fa91fc087538ff393b7312099234fb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374655280327036999/20250521_094859.jpg?ex=682ed6fe&is=682d857e&hm=d0d6da39d1c1536c4278a94cd000e1249756e845c8a38cd783eed5c21271a51d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656352613568573/20250517_121536.jpg?ex=682ed7fe&is=682d867e&hm=5c3737c754f4bb6f5687390802f0a24f5dc90b7f8910327e30f9957b45985c92&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656352999178270/20250514_224218.jpg?ex=682ed7fe&is=682d867e&hm=71ad9b06ba6e4d07a71cc7b5a718dee7eaaee7d637f18bc20be2422e1627926d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656353385316362/20250514_192655.jpg?ex=682ed7fe&is=682d867e&hm=af89298e9df3f4bf921e1e1b331f348d67df32e6a6066bea6e7f1e03fb921f30&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656353846562867/20250512_214413.jpg?ex=682ed7fe&is=682d867e&hm=7bda56df3918290b85e699177d9d1c3e08f6ed5b0403a7731f8f1356c200f310&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656354081312798/20250512_144958.jpg?ex=682ed7fe&is=682d867e&hm=8eb08282bb1c60484268910ab766b9a13f6285d41fd76c6bc88370c3f299b7bb&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656354291286016/20250512_142221.jpg?ex=682ed7fe&is=682d867e&hm=3f13b01ea6b86b1ace78a603baad82f058f9965cd9c72c176784342a822e2158&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656354551205919/20250511_124626.jpg?ex=682ed7fe&is=682d867e&hm=e904c10ec4bdae7042b90ce208c1862925b34537dcb6a2e42069ab22edd2e63a&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656354848866396/20250511_122808.jpg?ex=682ed7fe&is=682d867e&hm=d9b999e1395bca0d8325ad503ded7a055437575c583a2c065b4f8236f8441f82&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656355142598696/20250510_225133.jpg?ex=682ed7fe&is=682d867e&hm=5cac90459efdce0a8cf538374c17fe189ee8ccf1f4541a49c6331e512a40033d&`,
        `https://cdn.discordapp.com/attachments/1374052923956269136/1374656355478278204/14fcc1519f18bc42d426bcedfe1aa219.jpg?ex=682ed7ff&is=682d867f&hm=26c3d144401438f1797998b35f172cc0b34009c5c63b1b7acccea33f8e583527&`,
    ];
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    message.channel.send(roast);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});