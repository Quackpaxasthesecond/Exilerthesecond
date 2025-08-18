module.exports = {
  name: 'inventory',
  description: 'Show your shop inventory',
  slash: true,
  options: [],
  execute: async (message, args, context) => {
    const { db } = context;
    const isInteraction = typeof message?.isChatInputCommand === 'function' && message.isChatInputCommand();
    const userId = message.author?.id || message.user?.id;
    try {
      const res = await db.query('SELECT item, metadata, expires, created_at FROM hi_shop_inventory WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      if (res.rows.length === 0) {
        const text = 'Your inventory is empty.';
        if (isInteraction) return message.reply({ content: text, ephemeral: true });
        return message.reply(text);
      }

      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      // Build simplified items array
      const items = res.rows.map(r => {
        const item = r.item;
        let value = '';
        if (r.expires) {
          const ts = Math.floor(Number(r.expires) / 1000);
          const abs = new Date(Number(r.expires)).toLocaleString();
          value = `Expires: <t:${ts}:R> (${abs})`;
        } else {
          value = 'Expires: never';
        }
        try {
          const md = r.metadata && typeof r.metadata === 'object' ? r.metadata : JSON.parse(r.metadata || '{}');
          if (md && Object.keys(md).length > 0) {
            const mdParts = [];
            if (md.luck !== undefined) mdParts.push(`luck: ${md.luck}%`);
            if (md.multiplier !== undefined) mdParts.push(`mult: x${md.multiplier}`);
            if (md.target) mdParts.push(`target: ${md.target}`);
            if (mdParts.length) value += `\n${mdParts.join(' • ')}`;
          }
        } catch (e) {}
        return { name: item, value };
      });

      const itemsPerPage = 6;
      const pages = [];
      for (let i = 0; i < items.length; i += itemsPerPage) {
        const chunk = items.slice(i, i + itemsPerPage);
        const embed = new EmbedBuilder()
          .setTitle('Your Inventory')
          .setDescription('Active shop items and expirations')
          .setColor(0x00b894);
        for (const it of chunk) embed.addFields({ name: it.name, value: it.value, inline: false });
        const pageNum = Math.floor(i / itemsPerPage) + 1;
        embed.setFooter({ text: `Page ${pageNum} of ${Math.ceil(items.length / itemsPerPage)}` });
        pages.push(embed);
      }

      const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      let components = [];
      if (pages.length > 1) {
        const prev = new ButtonBuilder().setCustomId(`inv_prev_${userId}_${nonce}`).setLabel('◀️ Prev').setStyle(ButtonStyle.Primary);
        const next = new ButtonBuilder().setCustomId(`inv_next_${userId}_${nonce}`).setLabel('Next ▶️').setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(prev, next);
        components = [row];
      }

      const sent = await message.reply({ embeds: [pages[0]], components, ephemeral: isInteraction });
      const sentMsg = sent && sent.id ? sent : null;
      if (!components.length || !sentMsg || typeof sentMsg.createMessageComponentCollector !== 'function') return sent;

      try {
        const collector = sentMsg.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 120000 });
        let current = 0;
        collector.on('collect', async inter => {
          if (!inter.isButton()) return;
          if (inter.customId.startsWith('inv_next_')) {
            current = Math.min(pages.length - 1, current + 1);
          } else if (inter.customId.startsWith('inv_prev_')) {
            current = Math.max(0, current - 1);
          }
          const row = components[0];
          try { await inter.update({ embeds: [pages[current]], components: row ? [row] : [] }); } catch (e) { /* ignore */ }
        });
        collector.on('end', async () => {
          try {
            const disabledRow = components[0];
            if (disabledRow) {
              for (const comp of disabledRow.components) comp.setDisabled(true);
              await sentMsg.edit({ components: [disabledRow] }).catch(() => {});
            }
          } catch (e) {}
        });
      } catch (e) {}
      return sent;
    } catch (err) {
      console.error(err);
      const text = 'Could not fetch your inventory.';
      if (isInteraction) return message.reply({ content: text, ephemeral: true });
      return message.reply(text);
    }
  }
};
