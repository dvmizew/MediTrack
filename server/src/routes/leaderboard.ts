import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { redis } from '../config/redis.js';

const router: Router = express.Router();
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes

router.get('/', authenticate, async (req: Request, res: Response) => {
	try {
		const { filter = 'all' } = req.query;
		const userId = (req as AuthRequest).user!.userId;
		const cacheKey = `leaderboard:${filter}`;

		// Try to get from cache
		let leaderboard = null;
		try {
			const cached = await redis.get(cacheKey);
			if (cached) {
				leaderboard = JSON.parse(cached);
				logger.debug('Leaderboard served from cache', { filter });
			}
		} catch (cacheErr) {
			logger.warn('Cache read error, proceeding without cache', { error: cacheErr });
		}

		// If not in cache, fetch from DB
		if (!leaderboard) {
			const result = await query(
				`
				SELECT 
					u.user_id,
					u.full_name,
					u.avatar_url,
					COALESCE(pp.nivel_xp, 0) as xp,
					COALESCE(pp.current_streak, 0) as streak,
					COALESCE(pp.longest_streak, 0) as longest_streak,
					COALESCE(pp.current_badge, 'bronze') as badge,
					COALESCE(pp.progres_total, 0) as total_doses
				FROM users u
				LEFT JOIN patient_profiles pp ON u.user_id = pp.patient_id
				WHERE u.role = 'pacient'
				ORDER BY COALESCE(pp.nivel_xp, 0) DESC
				LIMIT 100
				`,
				[]
			);

			leaderboard = result.rows.map((row: any, index: number) => ({
				rank: index + 1,
				userId: row.user_id,
				name: row.full_name,
				avatar: row.avatar_url,
				xp: parseInt(row.xp),
				streak: parseInt(row.streak),
				longestStreak: parseInt(row.longest_streak),
				badge: row.badge,
				totalDoses: parseInt(row.total_doses),
				isCurrentUser: row.user_id === userId
			}));

			// Cache for 5 minutes
			try {
				await redis.setex(cacheKey, LEADERBOARD_CACHE_TTL, JSON.stringify(leaderboard));
			} catch (cacheErr) {
				logger.warn('Cache write error', { error: cacheErr });
			}
		}

		// Mark current user in response
		leaderboard = leaderboard.map((entry: any) => ({
			...entry,
			isCurrentUser: entry.userId === userId
		}));

		logger.info(`Leaderboard fetched with filter: ${filter}, count: ${leaderboard.length}`);
		res.json(leaderboard);
	} catch (error) {
		logger.error('Error fetching leaderboard:', error);
		res.status(500).json({ error: 'Failed to fetch leaderboard' });
	}
});

router.get('/rank/current', authenticate, async (req: Request, res: Response) => {
	try {
		const userId = (req as AuthRequest).user!.userId;

		const result = await query(
			`
			SELECT 
				COALESCE(pp.nivel_xp, 0) as xp,
				COALESCE(pp.current_streak, 0) as streak,
				COALESCE(pp.current_badge, 'bronze') as badge
			FROM users u
			LEFT JOIN patient_profiles pp ON u.user_id = pp.patient_id
			WHERE u.user_id = $1
			`,
			[userId]
		);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'User not found' });
		}

		const userProfile = result.rows[0];
		
		// Calculate rank from leaderboard
		const rankResult = await query(
			`
			SELECT COUNT(*) as rank_count
			FROM patient_profiles
			WHERE nivel_xp > (SELECT COALESCE(nivel_xp, 0) FROM patient_profiles WHERE patient_id = $1)
			`,
			[userId]
		);

		const rank = parseInt(rankResult.rows[0]?.rank_count || 0) + 1;

		res.json({
			rank,
			xp: parseInt(userProfile.xp),
			streak: parseInt(userProfile.streak),
			badge: userProfile.badge
		});
	} catch (error) {
		logger.error('Error fetching user rank:', error);
		res.status(500).json({ error: 'Failed to fetch user rank' });
	}
});

export default router;
