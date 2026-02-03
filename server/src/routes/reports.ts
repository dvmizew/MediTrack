import express, { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import {
	generatePersonalDataExportCSV
} from '../utils/csv-export.js';
import {
	getUserInfo,
	getUserByRole,
	getUserTreatments,
	getDoctorTreatmentCount,
	getUsersByRole,
	getUserPasswordHash,
	getUserStatusCounts,
	getTreatmentStatusCounts
} from '../utils/queryBuilders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router: Router = express.Router();

// Store performance metrics
const performanceMetrics: Array<{
  endpoint: string;
  duration: number;
  timestamp: Date;
  userId?: number;
}> = [];

function recordMetric(endpoint: string, duration: number, userId?: number) {
  performanceMetrics.push({
    endpoint,
    duration,
    timestamp: new Date(),
    userId
  });
  
  // Keep only last 1000 metrics
  if (performanceMetrics.length > 1000) {
    performanceMetrics.shift();
  }
}

// Metrics endpoint for monitoring
router.get('/metrics', authenticate, authorize('admin'), (req: Request, res: Response) => {
  const summary = performanceMetrics.reduce((acc, metric) => {
    if (!acc[metric.endpoint]) {
      acc[metric.endpoint] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: Infinity
      };
    }
    
    const stats = acc[metric.endpoint];
    stats.count++;
    stats.totalDuration += metric.duration;
    stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
    stats.minDuration = Math.min(stats.minDuration, metric.duration);
    
    return acc;
  }, {} as Record<string, any>);
  
  // Calculate averages
  Object.keys(summary).forEach(endpoint => {
    const stats = summary[endpoint];
    stats.avgDuration = Math.round(stats.totalDuration / stats.count);
    stats.minDuration = stats.minDuration === Infinity ? 0 : stats.minDuration;
  });
  
  res.json({
    totalRequests: performanceMetrics.length,
    summary,
    recentRequests: performanceMetrics.slice(-50).reverse()
  });
});

// Overview metrics for admin dashboard
router.get('/overview', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const [usersByRoleResult, usersActiveResult, collabCounts, treatmentCountsResult, doseCounts, adherence7, adherence30] = await Promise.all([
      Promise.resolve({ rows: await getUsersByRole() }),
      Promise.resolve({ rows: [await getUserStatusCounts()] }),
      query(`SELECT status_invitatie as status, COUNT(*)::int as count FROM doctor_patient GROUP BY status_invitatie`),
      Promise.resolve({ rows: [await getTreatmentStatusCounts()] }),
      query(`SELECT COUNT(*)::int AS total FROM treatment_doses WHERE is_deleted = false`),
      // adherence last 7 days
      query(`WITH scheduled AS (
                SELECT COUNT(*) AS cnt
                FROM treatment_doses td
                JOIN treatment_plans tp ON td.plan_id = tp.plan_id
                WHERE td.is_active = true AND td.is_deleted = false AND tp.is_deleted = false AND tp.activ = true
                  AND CURRENT_DATE - INTERVAL '7 days' BETWEEN td.start_date AND COALESCE(td.end_date, CURRENT_DATE)
             ), confirmed AS (
                SELECT COUNT(*) AS cnt FROM dose_confirmations WHERE rezultat = 'pozitiv' AND scheduled_for >= NOW() - INTERVAL '7 days'
             )
             SELECT (SELECT cnt FROM scheduled) AS scheduled, (SELECT cnt FROM confirmed) AS confirmed`),
      // adherence last 30 days
      query(`WITH scheduled AS (
                SELECT COUNT(*) AS cnt
                FROM treatment_doses td
                JOIN treatment_plans tp ON td.plan_id = tp.plan_id
                WHERE td.is_active = true AND td.is_deleted = false AND tp.is_deleted = false AND tp.activ = true
                  AND CURRENT_DATE - INTERVAL '30 days' BETWEEN td.start_date AND COALESCE(td.end_date, CURRENT_DATE)
             ), confirmed AS (
                SELECT COUNT(*) AS cnt FROM dose_confirmations WHERE rezultat = 'pozitiv' AND scheduled_for >= NOW() - INTERVAL '30 days'
             )
             SELECT (SELECT cnt FROM scheduled) AS scheduled, (SELECT cnt FROM confirmed) AS confirmed`),
    ]);

    res.json({
      users: {
        byRole: usersByRole.rows,
        active: usersActive.rows[0]?.active ?? 0,
        inactive: usersActive.rows[0]?.inactive ?? 0,
      },
      collaborations: collabCounts.rows,
      treatments: {
        active: treatmentCountsResult.rows[0]?.active ?? 0,
        inactive: treatmentCountsResult.rows[0]?.inactive ?? 0,
        total: treatmentCountsResult.rows[0]?.total ?? 0,
      },
      doses: {
        total: doseCounts.rows[0]?.total ?? 0,
      },
      adherence: {
        last7Days: {
          scheduled: Number(adherence7.rows[0]?.scheduled) || 0,
          confirmed: Number(adherence7.rows[0]?.confirmed) || 0,
          rate: (() => {
            const s = Number(adherence7.rows[0]?.scheduled) || 0; const c = Number(adherence7.rows[0]?.confirmed) || 0; return s > 0 ? +(c / s).toFixed(2) : 0;
          })(),
        },
        last30Days: {
          scheduled: Number(adherence30.rows[0]?.scheduled) || 0,
          confirmed: Number(adherence30.rows[0]?.confirmed) || 0,
          rate: (() => {
            const s = Number(adherence30.rows[0]?.scheduled) || 0; const c = Number(adherence30.rows[0]?.confirmed) || 0; return s > 0 ? +(c / s).toFixed(2) : 0;
          })(),
        },
      },
    });
    
    const duration = Date.now() - startTime;
    recordMetric('/admin/reports/overview', duration, (req as any).user?.userId);
    logger.info('Admin overview report generated', { duration: `${duration}ms`, userId: (req as any).user?.userId });
  } catch (error) {
    logger.error('Admin reports overview error', { error });
    res.status(500).json({ error: 'Failed to fetch overview reports' });
  }
});

// Per-user adherence and activity
router.get('/user/:userId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { userId } = req.params;
    const [user, stats, treatments, confirmations] = await Promise.all([
      Promise.resolve({ rows: [await getUserInfo(userId, true)] }),
      query(`SELECT nivel_xp, current_streak, longest_streak, current_badge FROM patient_profiles WHERE patient_id = $1`, [userId]),
      Promise.resolve({ rows: await getUserTreatments(userId, 50) }),
      query(`SELECT rezultat, scheduled_for, timestamp_confirmare FROM dose_confirmations dc
             JOIN treatment_doses td ON dc.dose_id = td.dose_id
             JOIN treatment_plans tp ON td.plan_id = tp.plan_id
             WHERE tp.patient_id = $1
             ORDER BY scheduled_for DESC LIMIT 100`, [userId]),
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const duration = Date.now() - startTime;
    recordMetric('/admin/reports/user/:userId', duration, (req as any).user?.userId);
    logger.info('User report generated', { duration: `${duration}ms`, targetUserId: userId, adminUserId: (req as any).user?.userId });

    res.json({
      user: user.rows[0],
      stats: stats.rows[0] || null,
      treatments: treatments.rows,
      confirmations: confirmations.rows,
    });
  } catch (error) {
    logger.error('Admin reports user error', { error });
    res.status(500).json({ error: 'Failed to fetch user report' });
  }
});

// Per-medic workload
router.get('/medic/:userId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { userId } = req.params;
    const [medic, patientsCount, plansCount, messagesCount, inviteAcceptance] = await Promise.all([
      query(`SELECT user_id, email, full_name, role FROM users WHERE user_id = $1 AND role = 'medic'`, [userId]),
      query(`SELECT COUNT(*)::int AS patients FROM doctor_patient WHERE doctor_id = $1 AND status_invitatie = 'accepted'`, [userId]),
      query(`SELECT COUNT(*)::int AS plans FROM treatment_plans WHERE doctor_id = $1 AND is_deleted = false`, [userId]),
      query(`SELECT COUNT(*)::int AS messages FROM messages WHERE sender_id = $1`, [userId]),
      query(`SELECT 
              COALESCE(SUM(CASE WHEN status_invitatie = 'accepted' THEN 1 ELSE 0 END), 0)::int AS accepted,
              COALESCE(SUM(CASE WHEN status_invitatie = 'rejected' THEN 1 ELSE 0 END), 0)::int AS rejected,
              COALESCE(SUM(CASE WHEN status_invitatie = 'pending' THEN 1 ELSE 0 END), 0)::int AS pending
            FROM doctor_patient WHERE doctor_id = $1`, [userId]),
    ]);

    if (medic.rows.length === 0) {
      return res.status(404).json({ error: 'Medic not found or not a medic' });
    }

    const inv = inviteAcceptance.rows[0] || { accepted: 0, rejected: 0, pending: 0 };
    const totalResp = (inv.accepted + inv.rejected) || 0;
    const acceptanceRate = totalResp > 0 ? +(inv.accepted / totalResp).toFixed(2) : 0;

    const duration = Date.now() - startTime;
    recordMetric('/admin/reports/medic/:userId', duration, (req as any).user?.userId);
    logger.info('Medic report generated', { duration: `${duration}ms`, medicId: userId, adminUserId: (req as any).user?.userId });

    res.json({
      medic: medic.rows[0],
      patients: patientsCount.rows[0]?.patients ?? 0,
      plans: plansCount.rows[0]?.plans ?? 0,
      messages: messagesCount.rows[0]?.messages ?? 0,
      invites: { ...inv, acceptanceRate },
    });
  } catch (error) {
    logger.error('Admin reports medic error', { error });
    res.status(500).json({ error: 'Failed to fetch medic report' });
  }
});

// GDPR: Export user's personal data
router.get('/export/personal-data', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user, treatments, confirmations] = await Promise.all([
      query(`SELECT user_id, full_name, email, role, created_at FROM users WHERE user_id = $1`, [userId]),
      query(`SELECT plan_id, diagnoza, descriere, activ, data_creare FROM treatment_plans 
             WHERE (patient_id = $1 OR doctor_id = $1) AND is_deleted = false`, [userId]),
      query(`SELECT 
        td.medication_name, 
        dc.scheduled_for, 
        dc.rezultat, 
        dc.timestamp_confirmare 
      FROM dose_confirmations dc
      JOIN treatment_doses td ON dc.dose_id = td.dose_id
      JOIN treatment_plans tp ON td.plan_id = tp.plan_id
      WHERE (tp.patient_id = $1 OR tp.doctor_id = $1)
      ORDER BY dc.scheduled_for DESC LIMIT 1000`, [userId])
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const csv = generatePersonalDataExportCSV(user.rows[0], treatments.rows, confirmations.rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="personal_data_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
    
    logger.info('Personal data export generated', { userId });
  } catch (error) {
    logger.error('Personal data export error', { error });
    res.status(500).json({ error: 'Failed to export personal data' });
  }
});

// GDPR: Delete user account (soft delete with full data removal option)
router.post('/delete-account', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify password
    const userResult = await query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Parolă incorectă' });
    }

    // Soft delete: mark as deleted and anonymize sensitive data
    await query(`
      UPDATE users 
      SET 
        is_active = false,
        full_name = 'Utilizator Șters',
        email = concat('deleted_', user_id, '@deleted.local'),
        updated_at = NOW()
      WHERE user_id = $1
    `, [userId]);

    // Optional: Delete associated data
    await query(`
      DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1
    `, [userId]);

    logger.info('Account deletion request processed', { userId });
    res.json({ 
      message: 'Your account has been scheduled for deletion. You will be logged out.',
      deleteScheduled: true 
    });
  } catch (error) {
    logger.error('Account deletion error', { error });
    res.status(500).json({ error: 'Failed to process account deletion' });
  }
});

// ==================== ASYNC REPORT JOBS ====================

// Create new async report job
router.post('/jobs/create', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { reportType, isAnonymous = false } = req.body;
    const userId = (req as any).user?.userId;

    if (!['users', 'treatments', 'doses', 'full_system'].includes(reportType)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const result = await query(
      `INSERT INTO report_jobs (report_type, requested_by, status, is_anonymous) 
       VALUES ($1, $2, 'pending', $3) 
       RETURNING job_id, report_type, status, is_anonymous, created_at`,
      [reportType, userId, isAnonymous]
    );

    logger.info('Async report job created', { jobId: result.rows[0].job_id, reportType, isAnonymous, userId });
    
    res.json({
      message: 'Report generation started',
      job: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to create report job', { error });
    res.status(500).json({ error: 'Failed to create report job' });
  }
});

// Get status of a report job
router.get('/jobs/:jobId/status', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT job_id, report_type, status, file_path, file_size, error_message, 
              created_at, started_at, completed_at, expires_at
       FROM report_jobs 
       WHERE job_id = $1 AND requested_by = $2`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report job not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get job status', { error });
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// List all report jobs for current admin
router.get('/jobs/list', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { status, limit = 20 } = req.query;

    let queryText = `
      SELECT job_id, report_type, status, file_size, error_message,
             created_at, completed_at, expires_at
      FROM report_jobs 
      WHERE requested_by = $1
    `;
    const params: any[] = [userId];

    if (status) {
      queryText += ` AND status = $2`;
      params.push(status);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const result = await query(queryText, params);

    res.json({ jobs: result.rows });
  } catch (error) {
    logger.error('Failed to list jobs', { error });
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Download completed report
router.get('/jobs/:jobId/download', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT file_path, report_type, status 
       FROM report_jobs 
       WHERE job_id = $1 AND requested_by = $2`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report job not found' });
    }

    const job = result.rows[0];

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Report is not ready yet' });
    }

    if (!job.file_path) {
      return res.status(404).json({ error: 'Report file not found' });
    }

    const filePath = path.join(__dirname, '../../reports', job.file_path);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Report file no longer exists' });
    }

    // Determine content type
    const ext = path.extname(job.file_path);
    const contentType = ext === '.csv' ? 'text/csv' : 'text/plain';

    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.setHeader('Content-Disposition', `attachment; filename="${job.report_type}_report_${jobId}${ext}"`);
    
    const fileContent = await fs.readFile(filePath, 'utf-8');
    res.send(fileContent);

    logger.info('Report downloaded', { jobId, userId, filePath: job.file_path });
  } catch (error) {
    logger.error('Failed to download report', { error });
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// Delete a report job and its file
router.delete('/jobs/:jobId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT file_path FROM report_jobs WHERE job_id = $1 AND requested_by = $2`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report job not found' });
    }

    const job = result.rows[0];

    // Delete file if exists
    if (job.file_path) {
      const filePath = path.join(__dirname, '../../reports', job.file_path);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to delete report file', { filePath, error });
      }
    }

    // Delete job record
    await query(`DELETE FROM report_jobs WHERE job_id = $1`, [jobId]);

    logger.info('Report job deleted', { jobId, userId });
    res.json({ message: 'Report job deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete report job', { error });
    res.status(500).json({ error: 'Failed to delete report job' });
  }
});

export default router;
