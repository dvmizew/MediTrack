/**
 * Database query builders for common report queries
 * Reduces duplication and improves maintainability
 */

import { query as executeQuery } from '../config/database.js';

/**
 * Get user info with basic fields
 */
export async function getUserInfo(userId: number | string, includeRole: boolean = false) {
	const roleField = includeRole ? ', role' : '';
	const result = await executeQuery(
		`SELECT user_id, email, full_name${roleField}, created_at FROM users WHERE user_id = $1`,
		[userId]
	);
	return result.rows[0] || null;
}

/**
 * Get user info with role filter
 */
export async function getUserByRole(userId: number | string, role: string) {
	const result = await executeQuery(
		`SELECT user_id, email, full_name, role FROM users WHERE user_id = $1 AND role = $2`,
		[userId, role]
	);
	return result.rows[0] || null;
}

/**
 * Get user's treatment plans
 */
export async function getUserTreatments(userId: number | string, limit: number = 50) {
	const result = await executeQuery(
		`SELECT plan_id, diagnoza, descriere, activ, data_creare FROM treatment_plans 
		 WHERE patient_id = $1 AND is_deleted = false 
		 ORDER BY data_criere DESC 
		 LIMIT $2`,
		[userId, limit]
	);
	return result.rows;
}

/**
 * Get treatment plan count for doctor
 */
export async function getDoctorTreatmentCount(doctorId: number | string) {
	const result = await executeQuery(
		`SELECT COUNT(*)::int AS plans FROM treatment_plans WHERE doctor_id = $1 AND is_deleted = false`,
		[doctorId]
	);
	return result.rows[0]?.plans || 0;
}

/**
 * Get user role breakdown
 */
export async function getUsersByRole() {
	const result = await executeQuery(
		`SELECT role, COUNT(*)::int as count FROM users GROUP BY role`
	);
	return result.rows;
}

/**
 * Get password hash for user (for auth operations)
 */
export async function getUserPasswordHash(userId: number | string) {
	const result = await executeQuery(
		`SELECT password_hash FROM users WHERE user_id = $1`,
		[userId]
	);
	return result.rows[0]?.password_hash || null;
}

/**
 * Get user active/inactive counts
 */
export async function getUserStatusCounts() {
	const result = await executeQuery(`
		SELECT 
			COALESCE(SUM(CASE WHEN is_active THEN 1 ELSE 0 END), 0)::int AS active,
			COALESCE(SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END), 0)::int AS inactive
		FROM users
	`);
	return result.rows[0] || { active: 0, inactive: 0 };
}

/**
 * Get treatment plan status counts
 */
export async function getTreatmentStatusCounts() {
	const result = await executeQuery(`
		SELECT 
			COALESCE(SUM(CASE WHEN activ THEN 1 ELSE 0 END), 0)::int AS active,
			COALESCE(SUM(CASE WHEN NOT activ THEN 1 ELSE 0 END), 0)::int AS inactive,
			COUNT(*)::int AS total
		FROM treatment_plans 
		WHERE is_deleted = false
	`);
	return result.rows[0] || { active: 0, inactive: 0, total: 0 };
}
