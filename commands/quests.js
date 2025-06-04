// Daily quest system for hi bot
// Tracks and reports daily quest progress for each user
const QUESTS = [
	{
		id: 'streak25',
		desc: 'Obtain a hi streak of 25',
		check: async (db, userId) => {
			const res = await db.query('SELECT streak FROM hi_streaks WHERE user_id = $1', [userId]);
			return (res.rows[0]?.streak || 0) >= 25;
		}
	},
	{
		id: 'streak50',
		desc: 'Obtain a hi streak of 50',
		check: async (db, userId) => {
			const res = await db.query('SELECT streak FROM hi_streaks WHERE user_id = $1', [userId]);
			return (res.rows[0]?.streak || 0) >= 50;
		}
	},
	{
		id: 'streak100',
		desc: 'Obtain a hi streak of 100',
		check: async (db, userId) => {
			const res = await db.query('SELECT streak FROM hi_streaks WHERE user_id = $1', [userId]);
			return (res.rows[0]?.streak || 0) >= 100;
		}
	},
	{
		id: 'duel2',
		desc: 'Duel someone 2 times',
		check: async (db, userId) => {
			// Count duels initiated or accepted
			const res = await db.query('SELECT COUNT(*) FROM hi_givers WHERE giver = $1', [userId]);
			return (res.rows[0]?.count || 0) >= 2;
		}
	},
	{
		id: 'gamble3win',
		desc: 'Gamble and win 3 times in a row',
		check: async (db, userId) => {
			// Track win streaks in a new table
			const res = await db.query('SELECT win_streak FROM hi_gamble_streaks WHERE user_id = $1', [userId]);
			return (res.rows[0]?.win_streak || 0) >= 3;
		}
	},
	{
		id: 'beatDuel',
		desc: 'Beat someone in a duel',
		check: async (db, userId) => {
			// Track duel wins in a new table
			const res = await db.query('SELECT duel_wins FROM hi_duel_wins WHERE user_id = $1', [userId]);
			return (res.rows[0]?.duel_wins || 0) >= 1;
		}
	},
	{
		id: 'hi100NoExile',
		desc: 'Do -hi 100 times without getting exiled',
		check: async (db, userId) => {
			// Track hi count since last exile
			const res = await db.query('SELECT hi_since_exile FROM hi_usages WHERE user_id = $1', [userId]);
			return (res.rows[0]?.hi_since_exile || 0) >= 100;
		}
	},
	{
		id: 'gamble100hi',
		desc: 'Gamble more than 100 hi and win',
		check: async (db, userId) => {
			// Track biggest gamble win
			const res = await db.query('SELECT max_gamble_win FROM hi_gamble_stats WHERE user_id = $1', [userId]);
			return (res.rows[0]?.max_gamble_win || 0) >= 100;
		}
	},
	{
		id: 'hi100',
		desc: 'Perform 100 hi commands',
		check: async (db, userId) => {
			const res = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [userId]);
			return (res.rows[0]?.count || 0) >= 100;
		}
	},
	{
		id: 'hi1000',
		desc: 'Perform 1000 hi commands',
		check: async (db, userId) => {
			const res = await db.query('SELECT count FROM hi_usages WHERE user_id = $1', [userId]);
			return (res.rows[0]?.count || 0) >= 1000;
		}
	},
	{
		id: 'donate25',
		desc: 'Donate 25 hi to someone',
		check: async (db, userId) => {
			const res = await db.query('SELECT SUM(count) as total FROM hi_givers WHERE giver = $1', [userId]);
			return (res.rows[0]?.total || 0) >= 25;
		}
	},
	{
		id: 'donate50',
		desc: 'Donate 50 hi to someone',
		check: async (db, userId) => {
			const res = await db.query('SELECT SUM(count) as total FROM hi_givers WHERE giver = $1', [userId]);
			return (res.rows[0]?.total || 0) >= 50;
		}
	}
];

// Only export QUESTS and getQuestProgress from this file
module.exports = {
	QUESTS,
	async getQuestProgress(db, userId) {
		const progress = [];
		for (const quest of QUESTS) {
			const done = await quest.check(db, userId);
			progress.push({ id: quest.id, desc: quest.desc, done });
		}
		return progress;
	}
};
