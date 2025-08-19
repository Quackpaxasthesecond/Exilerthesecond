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
  // hi_mult: multiplier value (default 1)
  // extra_luck: percentage points (default 0)
  const effects = { hi_mult: 1, extra_luck: 0, raw: [] };
      for (const row of res.rows) {
        effects.raw.push(row);
        if (row.item === 'hi_mult' || row.item === 'xp_multiplier') {
          // assume multiplier stored as metadata.multiplier or default x2
          let m = 2;
          try { const md = row.metadata && typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'); if (md && md.multiplier) m = Number(md.multiplier) || m; } catch {}
          // stack multipliers multiplicatively (e.g., two x2 purchases -> x4)
          effects.hi_mult = effects.hi_mult * m;
        }
        if (row.item === 'extra_luck') {
          // metadata.luck is interpreted as percentage points (default 10 meaning 10%)
          let luck = 10;
          try { const md = row.metadata && typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'); if (md && md.luck) luck = Number(md.luck) || luck; } catch {}
          effects.extra_luck += luck;
        }
      }
  // caps to prevent runaway effects
  const MAX_HI_MULT = 16; // maximum allowed multiplier (e.g. x16)
  const MAX_EXTRA_LUCK = 80; // maximum extra_luck percentage points
  if (effects.hi_mult > MAX_HI_MULT) effects.hi_mult = MAX_HI_MULT;
  if (effects.extra_luck > MAX_EXTRA_LUCK) effects.extra_luck = MAX_EXTRA_LUCK;
  effects._caps = { MAX_HI_MULT, MAX_EXTRA_LUCK };
  return effects;
    } catch (e) {
      return {};
    }
  }
};
