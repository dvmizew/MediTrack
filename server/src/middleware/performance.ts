import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

interface PerformanceMetrics {
	endpoint: string;
	method: string;
	duration: number;
	statusCode: number;
	timestamp: Date;
}

const metricsStore: PerformanceMetrics[] = [];
const MAX_METRICS = 1000; // Keep last 1000 requests

export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
	const startTime = Date.now();

	// Capture original end method
	const originalEnd = res.end;

	// Override end method to capture metrics
	res.end = function(chunk?: any, encoding?: any, callback?: any): any {
		const duration = Date.now() - startTime;
		
		const metric: PerformanceMetrics = {
			endpoint: req.path,
			method: req.method,
			duration,
			statusCode: res.statusCode,
			timestamp: new Date()
		};

		// Store metric
		metricsStore.push(metric);
		if (metricsStore.length > MAX_METRICS) {
			metricsStore.shift();
		}

		// Log slow requests (> 1000ms)
		if (duration > 1000) {
			logger.warn('Slow request detected', {
				method: req.method,
				endpoint: req.path,
				duration: `${duration}ms`,
				statusCode: res.statusCode,
				userId: (req as any).user?.userId
			});
		}

		// Log admin reports specifically
		if (req.path.startsWith('/admin/reports')) {
			logger.info('Admin report request', {
				method: req.method,
				endpoint: req.path,
				duration: `${duration}ms`,
				statusCode: res.statusCode,
				userId: (req as any).user?.userId
			});
		}

		// Call original end
		return originalEnd.call(this, chunk, encoding, callback);
	};

	next();
}

export function getMetrics() {
	return {
		total: metricsStore.length,
		metrics: metricsStore,
		summary: calculateSummary()
	};
}

function calculateSummary() {
	if (metricsStore.length === 0) {
		return {
			avgDuration: 0,
			maxDuration: 0,
			minDuration: 0,
			slowRequests: 0,
			byEndpoint: {}
		};
	}

	const durations = metricsStore.map(m => m.duration);
	const byEndpoint: Record<string, { count: number; avgDuration: number; maxDuration: number }> = {};

	metricsStore.forEach(metric => {
		if (!byEndpoint[metric.endpoint]) {
			byEndpoint[metric.endpoint] = {
				count: 0,
				avgDuration: 0,
				maxDuration: 0
			};
		}
		const ep = byEndpoint[metric.endpoint];
		ep.count++;
		ep.maxDuration = Math.max(ep.maxDuration, metric.duration);
	});

	// Calculate averages
	Object.keys(byEndpoint).forEach(endpoint => {
		const endpointMetrics = metricsStore.filter(m => m.endpoint === endpoint);
		const totalDuration = endpointMetrics.reduce((sum, m) => sum + m.duration, 0);
		byEndpoint[endpoint].avgDuration = Math.round(totalDuration / endpointMetrics.length);
	});

	return {
		avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
		maxDuration: Math.max(...durations),
		minDuration: Math.min(...durations),
		slowRequests: metricsStore.filter(m => m.duration > 1000).length,
		byEndpoint
	};
}
