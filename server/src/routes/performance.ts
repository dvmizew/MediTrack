import { Router } from 'express';
import { queryProfiler } from '../utils/query-profiler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { pool } from '../config/database.js';
import os from 'os';

const router = Router();

// Get system health stats
router.get('/system-health', authenticate, authorize('admin'), async (req, res) => {
	try {
		const cpus = os.cpus();
		const loadAvg = os.loadavg();
		const totalMem = os.totalmem();
		const freeMem = os.freemem();

		res.json({
			system: {
				cpu: {
					cores: cpus.length,
					model: cpus[0].model,
					loadAvg: loadAvg
				},
				memory: {
					total: totalMem,
					free: freeMem,
					used: totalMem - freeMem,
					percentage: Math.round(((totalMem - freeMem) / totalMem) * 100)
				},
				uptime: os.uptime(),
				platform: os.platform(),
				release: os.release()
			},
			db: {
				totalCount: pool.totalCount,
				idleCount: pool.idleCount,
				waitingCount: pool.waitingCount
			},
			process: {
				uptime: process.uptime(),
				memoryUsage: process.memoryUsage()
			},
			timestamp: new Date()
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			error: 'Failed to fetch system health stats'
		});
	}
});

// Get query performance stats
router.get('/performance/queries', authenticate, authorize('admin'), (req, res) => {
	try {
		const stats = queryProfiler.getStats();
		res.json({
			...stats,
			recentQueries: queryProfiler.getRecentQueries(10),
			timestamp: new Date()
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
