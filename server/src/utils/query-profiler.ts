import { Query } from 'pg';
import { logger } from '../config/logger.js';

interface SlowQuery {
	query: string;
	duration: number;
	timestamp: Date;
	error?: string;
}

export class QueryProfiler {
	private slowQueries: SlowQuery[] = [];
	private readonly SLOW_QUERY_THRESHOLD = 100; // 100ms
	private readonly MAX_STORED_QUERIES = 500;

	/**
	 * Wraps a database query to capture execution time
	 */
	profileQuery(query: string, duration: number, error?: Error | null) {
		if (duration > this.SLOW_QUERY_THRESHOLD) {
			const slowQuery: SlowQuery = {
				query,
				duration,
				timestamp: new Date(),
				error: error?.message
			};

			this.slowQueries.push(slowQuery);
			if (this.slowQueries.length > this.MAX_STORED_QUERIES) {
				this.slowQueries.shift();
			}

			// Log to file
			const level = duration > 500 ? 'error' : 'warn';
			logger[level]('Slow query detected', {
				query: query.substring(0, 100),
				duration: `${duration.toFixed(2)}ms`,
				threshold: `${this.SLOW_QUERY_THRESHOLD}ms`,
				queryLength: query.length
			});
		}
	}

	/**
	 * Get statistics for all captured slow queries
	 */
	getStats() {
		if (this.slowQueries.length === 0) {
			return {
				totalQueries: 0,
				averageDuration: 0,
				slowestQuery: null
			};
		}

		const totalDuration = this.slowQueries.reduce((sum, q) => sum + q.duration, 0);
		const slowest = this.slowQueries.reduce((prev, current) =>
			prev.duration > current.duration ? prev : current
		);

		return {
			totalQueries: this.slowQueries.length,
			averageDuration: (totalDuration / this.slowQueries.length).toFixed(2),
			slowestQuery: {
				query: slowest.query.substring(0, 150),
				duration: `${slowest.duration.toFixed(2)}ms`
			}
		};
	}

	/**
	 * Get recent slow queries
	 */
	getRecentQueries(limit = 20) {
		return this.slowQueries
			.slice(-limit)
			.reverse()
			.map(q => ({
				query: q.query.substring(0, 150),
				duration: `${q.duration.toFixed(2)}ms`,
				timestamp: q.timestamp,
				error: q.error
			}));
	}

	/**
	 * Clear stored slow queries
	 */
	clear() {
		this.slowQueries = [];
	}
}

export const queryProfiler = new QueryProfiler();
