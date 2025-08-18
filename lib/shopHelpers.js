// Helper utilities for shop inventory and active effects
module.exports = {
  // Returns active effects for a user and removes expired records.
  // expected db has .query(sql, params)
  getActiveEffects: async (db, userId) => {
    try {
      // remove expired entries first
      await db.query('DELETE FROM hi_shop_inventory WHERE expires IS NOT NULL AND expires < $1', [Date.now()]);
    } catch (e) {
      // if table doesn't exist, return empty
      return {};
    }
    try {
      const res = await db.query('SELECT item, metadata, expires FROM hi_shop_inventory WHERE user_id = $1', [userId]);
      // xp_multiplier: multiplier value (default 1)
      // extra_luck: percentage points (e.g. 10 means +10% win chance)
      const effects = { xp_multiplier: 1, extra_luck: 0, raw: [] };
      for (const row of res.rows) {
        effects.raw.push(row);
        if (row.item === 'xp_multiplier') {
          // assume multiplier stored as metadata.multiplier or default x2
          let m = 2;
          try { const md = row.metadata && typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'); if (md && md.multiplier) m = Number(md.multiplier) || m; } catch {}
          effects.xp_multiplier = Math.max(effects.xp_multiplier, m);
        }
        if (row.item === 'extra_luck') {
          // metadata.luck is interpreted as percentage points (default 10 meaning 10%)
          let luck = 10;
          try { const md = row.metadata && typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'); if (md && md.luck) luck = Number(md.luck) || luck; } catch {}
          effects.extra_luck += luck;
        }
      }
      return effects;
    } catch (e) {
      return {};
    }
  }
};
