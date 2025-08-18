(async () => {
  // Simple simulation harness for hi-related commands
  const path = require('path');
  const commandsDir = path.join(__dirname, '..', 'commands');
  const cmdNames = ['hi','hiduel','acceptduel','hidonate','hileaderboard','checkhistreaks','streakleader'];

  // Load commands
  const cmds = {};
  for (const name of cmdNames) {
    try {
      cmds[name] = require(path.join(commandsDir, name + '.js'));
    } catch (e) {
      console.error('Failed to require', name, e);
    }
  }

  // Shared stubs/context
  const ROLE_IDS = {
    exiled: '1208808796890337350',
    swaggers: '1202948499193335828',
    uncle: '1351986650754056354',
    mod: '1353414310499455027',
    admin: '1351985637602885734',
    hi_crown: '1379180965481676830'
  };
  const SPECIAL_MEMBERS = [];
  const SWAGGER_MEMBERS = [];
  const db = {
    query: async (q, vals) => ({ rows: [] })
  };
  const timers = new Map();
  const hiStreaks = {};
  const hiDuels = {};
  const checkCooldown = () => false;

  function makeSpyChannel() {
    const sends = [];
    return {
      sends,
      id: 'chan1',
      send: async (payload) => {
        sends.push(payload);
        // return a minimal sent message object with id
        return { id: 'sent_' + sends.length, content: (typeof payload === 'string' ? payload : (payload?.content || '')), embeds: payload?.embeds || [] };
      },
      awaitMessages: async () => ({ first: () => null })
    };
  }

  function makeGuild() {
    return {
      id: 'guild1',
      members: {
        fetch: async () => {
          // return a map-like with filter() and random()
          const fake = new Map();
          const sample = { id: 'u_target', user: { username: 'target' }, roles: { cache: new Map() } };
          fake.set(sample.id, sample);
          fake.filter = function (fn) {
            const filtered = new Map();
            for (const [k,v] of this.entries()) if (fn(v)) filtered.set(k,v);
            filtered.size = filtered.size || filtered.size !== undefined ? filtered.size : filtered.size;
            filtered.random = () => sample;
            return filtered;
          };
          fake.random = () => sample;
          return fake;
        }
      }
    };
  }

  function makeMessageLike() {
    const channel = makeSpyChannel();
    const guild = makeGuild();
    const author = { id: 'user1', username: 'user1' };
    const member = { id: 'user1', roles: { cache: new Map() }, guild };
    return {
      author,
      member,
      guild,
      channel,
      mentions: { members: { first: () => null }, users: { first: () => null } },
      content: '',
      reply: async (p) => { channel.sends.push(p); return { id: 'reply' }; }
    };
  }

  // Simulate a single invocation via message-like adapter and ensure only expected sends
  for (const [key, cmd] of Object.entries(cmds)) {
    if (!cmd) continue;
    console.log('\n=== Testing', key, '===');
    const msg = makeMessageLike();
    const context = { db, timers, ROLE_IDS, SPECIAL_MEMBERS, SWAGGER_MEMBERS, checkCooldown, hiStreaks, hiDuels };

    try {
      // Provide args: for slash-compatible commands the second param may be an object
      const argsArr = ['-'+key];
      // Call message-style
      await cmd.execute(msg, argsArr, context);
      console.log('channel.sends after message-style call:', msg.channel.sends.length);
    } catch (e) {
      console.error('message-style call error for', key, e);
    }

    // Reset channel
    msg.channel.sends.length = 0;

    // Simulate interaction-style if command supports slash
    if (cmd.slash) {
      const spyChannel = makeSpyChannel();
      const guild = makeGuild();
      const interaction = {
        isChatInputCommand: () => true,
        commandName: cmd.name,
        user: { id: 'user1', username: 'user1' },
        member: { roles: { cache: new Map() } },
        guild,
        channel: spyChannel,
        options: {
          data: [],
          getUser: (name) => null,
          getInteger: (name) => null
        },
        deferred: false,
        replied: false,
        deferReply: async (opts) => { interaction.deferred = true; return; },
        editReply: async (payload) => { interaction.edited = payload; return; },
        reply: async (payload) => { interaction.replied = true; return; },
        followUp: async (payload) => { interaction.followed = true; return; }
      };
      try {
        await cmd.execute(interaction, interaction.options, context);
        console.log('interaction channel.sends after interaction-style call:', spyChannel.sends.length, 'editedReply:', !!interaction.edited, 'replied:', !!interaction.replied, 'followed:', !!interaction.followed);
      } catch (e) {
        console.error('interaction-style call error for', key, e);
      }
    }
  }

  console.log('\nSimulation complete');
})();
