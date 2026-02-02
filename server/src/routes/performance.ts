import { Router } from 'express';
import { queryProfiler } from '../utils/query-profiler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Get query performance stats
router.get('/performance/queries', authenticate, authorize('admin'), (req, res) => {
	try {
		const stats = queryProfiler.getStats();
		res.json({
			success: true,
			data: {
				...stats,
				recentQueries: queryProfiler.getRecentQueries(10),
				timestamp: new Date()
			}
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			error: 'Failed to fetch query performance stats'
		});
	}
});

// Clear query metrics
router.post('/performance/queries/clear', authenticate, authorize('admin'), (req, res) => {
	try {
		queryProfiler.clear();
		res.json({
			success: true,
			message: 'Query metrics cleared'
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			error: 'Failed to clear query metrics'
		});
	}
});

export default router;
