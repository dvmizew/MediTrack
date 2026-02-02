import { query } from '../config/database.js';
import { logger } from '../config/logger.js';
import { generateCSV } from '../utils/csv.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	generateUsersCSV,
	generateUsersCSVAnonymous,
	generateTreatmentsCSV,
	generateTreatmentsCSVAnonymous,
	generateAdherenceCSV,
	generateAdherenceCSVAnonymous
} from '../utils/csv-export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for storing generated reports
const REPORTS_DIR = path.join(__dirname, '../../reports');

// Ensure reports directory exists
async function ensureReportsDir() {
	try {
		await fs.mkdir(REPORTS_DIR, { recursive: true });
	} catch (error) {
		logger.error('Failed to create reports directory', { error });
	}
}

// Process users export
async function processUsersReport(jobId: number, isAnonymous: boolean = false): Promise<{ filePath: string; fileSize: number }> {
	const result = await query(`
		SELECT 
			u.user_id,
			u.email,
			u.full_name,
			u.role,
			u.is_active,
			u.created_at,
			COALESCE(pp.nivel_xp, 0) as xp,
			COALESCE(pp.current_streak, 0) as streak,
			COALESCE(pp.current_badge, 'bronze') as badge
		FROM users u
		LEFT JOIN patient_profiles pp ON u.user_id = pp.patient_id
		ORDER BY u.created_at DESC
	`);

	let csv: string;
	if (isAnonymous) {
		csv = generateUsersCSVAnonymous(result.rows);
	} else {
		csv = generateUsersCSV(result.rows);
	}

	const fileName = `users_export_${jobId}_${Date.now()}${isAnonymous ? '_anon' : ''}.csv`;
	const filePath = path.join(REPORTS_DIR, fileName);
	await fs.writeFile(filePath, csv, 'utf-8');
	
	const stats = await fs.stat(filePath);
	return { filePath: fileName, fileSize: stats.size };
}

// Process treatments export
async function processTreatmentsReport(jobId: number, isAnonymous: boolean = false): Promise<{ filePath: string; fileSize: number }> {
	const result = await query(`
		SELECT 
			tp.plan_id,
			tp.patient_id,
			tp.doctor_id,
			tp.diagnoza as diagnosis,
			tp.activ as is_active,
			tp.data_creare as created_at,
			u_patient.full_name as patient_name,
			u_patient.email as patient_email,
			u_doctor.full_name as doctor_name,
			u_doctor.email as doctor_email,
			COUNT(td.dose_id) as total_doses
		FROM treatment_plans tp
		JOIN users u_patient ON tp.patient_id = u_patient.user_id
		JOIN users u_doctor ON tp.doctor_id = u_doctor.user_id
		LEFT JOIN treatment_doses td ON tp.plan_id = td.plan_id
		WHERE tp.is_deleted = false
		GROUP BY tp.plan_id, u_patient.user_id, u_doctor.user_id
		ORDER BY tp.data_creare DESC
	`);

	let csv: string;
	if (isAnonymous) {
		csv = generateTreatmentsCSVAnonymous(result.rows);
	} else {
		csv = generateTreatmentsCSV(result.rows);
	}

	const fileName = `treatments_export_${jobId}_${Date.now()}${isAnonymous ? '_anon' : ''}.csv`;
	const filePath = path.join(REPORTS_DIR, fileName);
	await fs.writeFile(filePath, csv, 'utf-8');
	
	const stats = await fs.stat(filePath);
	return { filePath: fileName, fileSize: stats.size };
}

// Process doses export
async function processDosesReport(jobId: number, isAnonymous: boolean = false): Promise<{ filePath: string; fileSize: number }> {
	const result = await query(`
		SELECT 
			td.dose_id,
			tp.patient_id,
			td.medication_name,
			td.cantitate as dosage,
			td.ora as scheduled_time,
			tp.diagnoza as treatment_diagnosis,
			u.full_name as patient_name,
			u.email as patient_email,
			td.status,
			td.created_at as confirmed_at
		FROM treatment_doses td
		JOIN treatment_plans tp ON td.plan_id = tp.plan_id
		JOIN users u ON tp.patient_id = u.user_id
		WHERE tp.is_deleted = false
		ORDER BY td.ora DESC
		LIMIT 10000
	`);

	let csv: string;
	if (isAnonymous) {
		csv = generateAdherenceCSVAnonymous(result.rows);
	} else {
		csv = generateAdherenceCSV(result.rows);
	}

	const fileName = `doses_export_${jobId}_${Date.now()}${isAnonymous ? '_anon' : ''}.csv`;
	const filePath = path.join(REPORTS_DIR, fileName);
	await fs.writeFile(filePath, csv, 'utf-8');
	
	const stats = await fs.stat(filePath);
	return { filePath: fileName, fileSize: stats.size };
}

// Process full system report
async function processFullSystemReport(jobId: number, isAnonymous: boolean = false): Promise<{ filePath: string; fileSize: number }> {
	// Generate comprehensive system report with multiple sheets (CSV files)
	const [users, treatments, doses] = await Promise.all([
		processUsersReport(jobId, isAnonymous),
		processTreatmentsReport(jobId, isAnonymous),
		processDosesReport(jobId, isAnonymous)
	]);

	// Create a summary file that references all exports
	const anonLabel = isAnonymous ? ' (Anonimizat)' : '';
	const summary = `MediTrack System Report${anonLabel} - Generated: ${new Date().toISOString()}

Exported Files:
- Users: ${users.filePath} (${(users.fileSize / 1024).toFixed(2)} KB)
- Treatments: ${treatments.filePath} (${(treatments.fileSize / 1024).toFixed(2)} KB)
- Doses: ${doses.filePath} (${(doses.fileSize / 1024).toFixed(2)} KB)

Total Size: ${((users.fileSize + treatments.fileSize + doses.fileSize) / 1024).toFixed(2)} KB
`;

	const fileName = `full_system_report_${jobId}_${Date.now()}${isAnonymous ? '_anon' : ''}.txt`;
	const filePath = path.join(REPORTS_DIR, fileName);
	await fs.writeFile(filePath, summary, 'utf-8');
	
	const stats = await fs.stat(filePath);
	return { filePath: fileName, fileSize: stats.size };
}

// Process a single report job
async function processReportJob(jobId: number, reportType: string, isAnonymous: boolean = false): Promise<void> {
	try {
		logger.info('Processing report job', { jobId, reportType, isAnonymous });

		// Update status to processing
		await query(
			`UPDATE report_jobs SET status = 'processing', started_at = NOW() WHERE job_id = $1`,
			[jobId]
		);

		// Generate report based on type
		let result: { filePath: string; fileSize: number };
		
		switch (reportType) {
			case 'users':
				result = await processUsersReport(jobId, isAnonymous);
				break;
			case 'treatments':
				result = await processTreatmentsReport(jobId, isAnonymous);
				break;
			case 'doses':
				result = await processDosesReport(jobId, isAnonymous);
				break;
			case 'full_system':
				result = await processFullSystemReport(jobId, isAnonymous);
				break;
			default:
				throw new Error(`Unknown report type: ${reportType}`);
		}

		// Update job as completed
		await query(
			`UPDATE report_jobs 
			 SET status = 'completed', 
			     file_path = $1, 
			     file_size = $2, 
			     completed_at = NOW() 
			 WHERE job_id = $3`,
			[result.filePath, result.fileSize, jobId]
		);

		// Get user who requested report
		const jobResult = await query(
			`SELECT requested_by FROM report_jobs WHERE job_id = $1`,
			[jobId]
		);
		const userId = jobResult.rows[0]?.requested_by;

		// Send notification to user
		if (userId) {
			const anonLabel = isAnonymous ? ' (anonimizat)' : '';
			await query(
				`INSERT INTO notifications (user_id, tip, title, message, status_notif) 
				 VALUES ($1, 'alert', $2, $3, 'sent')`,
				[
					userId,
					'Raport Gata',
					`Raportul ${reportType}${anonLabel} a fost generat cu succes și este disponibil pentru download.`
				]
			);
		}

		logger.info('Report job completed successfully', { 
			jobId, 
			reportType,
			isAnonymous,
			filePath: result.filePath,
			fileSize: result.fileSize 
		});

	} catch (error: any) {
		logger.error('Report job failed', { jobId, reportType, isAnonymous, error: error.message });

		// Update job as failed
		await query(
			`UPDATE report_jobs 
			 SET status = 'failed', 
			     error_message = $1, 
			     completed_at = NOW() 
			 WHERE job_id = $2`,
			[error.message, jobId]
		);

		// Notify user of failure
		const jobResult = await query(
			`SELECT requested_by FROM report_jobs WHERE job_id = $1`,
			[jobId]
		);
		const userId = jobResult.rows[0]?.requested_by;

		if (userId) {
			await query(
				`INSERT INTO notifications (user_id, tip, title, message, status_notif) 
				 VALUES ($1, 'alert', $2, $3, 'sent')`,
				[
					userId,
					'Raport Eșuat',
					`Generarea raportului ${reportType} a eșuat: ${error.message}`
				]
			);
		}
	}
}

// Worker loop - polls for pending jobs
export async function startReportWorker() {
	await ensureReportsDir();
	
	logger.info('Report worker started');

	// Poll every 5 seconds for new jobs
	setInterval(async () => {
		try {
			// Get pending jobs
			const result = await query(
				`SELECT job_id, report_type, is_anonymous 
				 FROM report_jobs 
				 WHERE status = 'pending' 
				 ORDER BY created_at ASC 
				 LIMIT 1`
			);

			if (result.rows.length > 0) {
				const job = result.rows[0];
				await processReportJob(job.job_id, job.report_type, job.is_anonymous || false);
			}
		} catch (error) {
			logger.error('Report worker error', { error });
		}
	}, 5000);

	// Cleanup expired reports every hour
	setInterval(async () => {
		try {
			const expiredJobs = await query(
				`SELECT job_id, file_path 
				 FROM report_jobs 
				 WHERE expires_at < NOW() AND status = 'completed'`
			);

			for (const job of expiredJobs.rows) {
				if (job.file_path) {
					const fullPath = path.join(REPORTS_DIR, job.file_path);
					try {
						await fs.unlink(fullPath);
						logger.info('Deleted expired report file', { filePath: job.file_path });
					} catch (error) {
						logger.error('Failed to delete expired report file', { filePath: job.file_path, error });
					}
				}

				await query(`DELETE FROM report_jobs WHERE job_id = $1`, [job.job_id]);
			}

			if (expiredJobs.rows.length > 0) {
				logger.info('Cleaned up expired reports', { count: expiredJobs.rows.length });
			}
		} catch (error) {
			logger.error('Report cleanup error', { error });
		}
	}, 3600000); // Every hour
}
