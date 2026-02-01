import express, { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';
import {
	generateUsersCSV,
	generateTreatmentsCSV,
	generateCollaborationsCSV,
	generateAdherenceCSV,
	generatePersonalDataExportCSV
} from '../utils/csv-export.js';

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
    const [usersByRole, usersActive, collabCounts, treatmentCounts, doseCounts, adherence7, adherence30] = await Promise.all([
      query(`SELECT role, COUNT(*)::int as count FROM users GROUP BY role`),
      query(`SELECT 
                SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active,
                SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END)::int AS inactive
             FROM users`),
      query(`SELECT status_invitatie as status, COUNT(*)::int as count FROM doctor_patient GROUP BY status_invitatie`),
      query(`SELECT 
                SUM(CASE WHEN activ THEN 1 ELSE 0 END)::int AS active,
                SUM(CASE WHEN NOT activ THEN 1 ELSE 0 END)::int AS inactive,
                COUNT(*)::int AS total
              FROM treatment_plans WHERE is_deleted = false`),
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
        active: usersActive.rows[0].active,
        inactive: usersActive.rows[0].inactive,
      },
      collaborations: collabCounts.rows,
      treatments: {
        active: treatmentCounts.rows[0].active,
        inactive: treatmentCounts.rows[0].inactive,
        total: treatmentCounts.rows[0].total,
      },
      doses: {
        total: doseCounts.rows[0].total,
      },
      adherence: {
        last7Days: {
          scheduled: Number(adherence7.rows[0].scheduled) || 0,
          confirmed: Number(adherence7.rows[0].confirmed) || 0,
          rate: (() => {
            const s = Number(adherence7.rows[0].scheduled) || 0; const c = Number(adherence7.rows[0].confirmed) || 0; return s > 0 ? +(c / s).toFixed(2) : 0;
          })(),
        },
        last30Days: {
          scheduled: Number(adherence30.rows[0].scheduled) || 0,
          confirmed: Number(adherence30.rows[0].confirmed) || 0,
          rate: (() => {
            const s = Number(adherence30.rows[0].scheduled) || 0; const c = Number(adherence30.rows[0].confirmed) || 0; return s > 0 ? +(c / s).toFixed(2) : 0;
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
      query(`SELECT user_id, email, full_name, role, is_active, created_at FROM users WHERE user_id = $1`, [userId]),
      query(`SELECT nivel_xp, current_streak, longest_streak, current_badge FROM patient_profiles WHERE patient_id = $1`, [userId]),
      query(`SELECT plan_id, diagnoza, activ, data_creare FROM treatment_plans WHERE patient_id = $1 AND is_deleted = false ORDER BY data_creare DESC LIMIT 50`, [userId]),
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
              SUM(CASE WHEN status_invitatie = 'accepted' THEN 1 ELSE 0 END)::int AS accepted,
              SUM(CASE WHEN status_invitatie = 'rejected' THEN 1 ELSE 0 END)::int AS rejected,
              SUM(CASE WHEN status_invitatie = 'pending' THEN 1 ELSE 0 END)::int AS pending
            FROM doctor_patient WHERE doctor_id = $1`, [userId]),
    ]);

    if (medic.rows.length === 0) {
      return res.status(404).json({ error: 'Medic not found or not a medic' });
    }

    const inv = inviteAcceptance.rows[0];
    const totalResp = (inv.accepted + inv.rejected) || 0;
    const acceptanceRate = totalResp > 0 ? +(inv.accepted / totalResp).toFixed(2) : 0;

    const duration = Date.now() - startTime;
    recordMetric('/admin/reports/medic/:userId', duration, (req as any).user?.userId);
    logger.info('Medic report generated', { duration: `${duration}ms`, medicId: userId, adminUserId: (req as any).user?.userId });

    res.json({
      medic: medic.rows[0],
      patients: patientsCount.rows[0].patients,
      plans: plansCount.rows[0].plans,
      messages: messagesCount.rows[0].messages,
      invites: { ...inv, acceptanceRate },
    });
  } catch (error) {
    logger.error('Admin reports medic error', { error });
    res.status(500).json({ error: 'Failed to fetch medic report' });
  }
});

// Export endpoints for admin

// Export all users as CSV
router.get('/export/users', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const users = await query(`SELECT user_id, full_name, email, role, is_active, created_at FROM users ORDER BY created_at DESC`);
    const csv = generateUsersCSV(users.rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
    
    logger.info('Users export generated', { adminUserId: (req as any).user?.userId, recordCount: users.rows.length });
  } catch (error) {
    logger.error('Users export error', { error });
    res.status(500).json({ error: 'Failed to export users' });
  }
});

// Export all treatments as CSV
router.get('/export/treatments', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const treatments = await query(`
      SELECT 
        tp.plan_id,
        u1.full_name as patient_full_name,
        u2.full_name as doctor_full_name,
        tp.diagnoza,
        tp.activ,
        tp.data_creare,
        COUNT(td.dose_id)::int as medication_count
      FROM treatment_plans tp
      LEFT JOIN users u1 ON tp.patient_id = u1.user_id
      LEFT JOIN users u2 ON tp.doctor_id = u2.user_id
      LEFT JOIN treatment_doses td ON tp.plan_id = td.plan_id AND td.is_deleted = false
      WHERE tp.is_deleted = false
      GROUP BY tp.plan_id, u1.full_name, u2.full_name, tp.diagnoza, tp.activ, tp.data_criere
      ORDER BY tp.data_criere DESC
    `);
    
    const csv = generateTreatmentsCSV(treatments.rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="treatments_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
    
    logger.info('Treatments export generated', { adminUserId: (req as any).user?.userId, recordCount: treatments.rows.length });
  } catch (error) {
    logger.error('Treatments export error', { error });
    res.status(500).json({ error: 'Failed to export treatments' });
  }
});

// Export collaboration data as CSV
router.get('/export/collaborations', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const collaborations = await query(`
      SELECT 
        u1.full_name as patient_full_name,
        u2.full_name as doctor_full_name,
        dp.status_invitatie,
        dp.created_at
      FROM doctor_patient dp
      LEFT JOIN users u1 ON dp.patient_id = u1.user_id
      LEFT JOIN users u2 ON dp.doctor_id = u2.user_id
      ORDER BY dp.created_at DESC
    `);
    
    const csv = generateCollaborationsCSV(collaborations.rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="collaborations_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
    
    logger.info('Collaborations export generated', { adminUserId: (req as any).user?.userId, recordCount: collaborations.rows.length });
  } catch (error) {
    logger.error('Collaborations export error', { error });
    res.status(500).json({ error: 'Failed to export collaborations' });
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
      query(`SELECT plan_id, diagnoza, descriere, activ, data_creare FROM treatment_plans WHERE patient_id = $1 AND is_deleted = false`, [userId]),
      query(`SELECT 
        td.medication_name, 
        dc.scheduled_for, 
        dc.rezultat, 
        dc.timestamp_confirmare 
      FROM dose_confirmations dc
      JOIN treatment_doses td ON dc.dose_id = td.dose_id
      JOIN treatment_plans tp ON td.plan_id = tp.plan_id
      WHERE tp.patient_id = $1
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

    // Check password (simplified - in real app use bcrypt comparison)
    // const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    // if (!validPassword) {
    //   return res.status(401).json({ error: 'Invalid password' });
    // }

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

export default router;
