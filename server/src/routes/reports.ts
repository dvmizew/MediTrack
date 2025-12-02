import express, { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';

const router: Router = express.Router();

// Overview metrics for admin dashboard
router.get('/overview', authenticate, authorize('admin'), async (req: Request, res: Response) => {
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
             FROM treatment_plans`),
      query(`SELECT COUNT(*)::int AS total FROM treatment_doses`),
      // adherence last 7 days
      query(`WITH scheduled AS (
                SELECT COUNT(*) AS cnt
                FROM treatment_doses td
                JOIN treatment_plans tp ON td.plan_id = tp.plan_id
                WHERE td.is_active = true AND tp.activ = true
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
                WHERE td.is_active = true AND tp.activ = true
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
  } catch (error) {
    logger.error('Admin reports overview error', { error });
    res.status(500).json({ error: 'Failed to fetch overview reports' });
  }
});

// Per-user adherence and activity
router.get('/user/:userId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const [user, stats, treatments, confirmations] = await Promise.all([
      query(`SELECT user_id, email, full_name, role, is_active, created_at FROM users WHERE user_id = $1`, [userId]),
      query(`SELECT nivel_xp, current_streak, longest_streak, current_badge FROM patient_profiles WHERE patient_id = $1`, [userId]),
      query(`SELECT plan_id, diagnoza, activ, data_creare FROM treatment_plans WHERE patient_id = $1 ORDER BY data_creare DESC LIMIT 50`, [userId]),
      query(`SELECT rezultat, scheduled_for, timestamp_confirmare FROM dose_confirmations dc
             JOIN treatment_doses td ON dc.dose_id = td.dose_id
             JOIN treatment_plans tp ON td.plan_id = tp.plan_id
             WHERE tp.patient_id = $1
             ORDER BY scheduled_for DESC LIMIT 100`, [userId]),
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

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
  try {
    const { userId } = req.params;
    const [medic, patientsCount, plansCount, messagesCount, inviteAcceptance] = await Promise.all([
      query(`SELECT user_id, email, full_name, role FROM users WHERE user_id = $1 AND role = 'medic'`, [userId]),
      query(`SELECT COUNT(*)::int AS patients FROM doctor_patient WHERE doctor_id = $1 AND status_invitatie = 'accepted'`, [userId]),
      query(`SELECT COUNT(*)::int AS plans FROM treatment_plans WHERE doctor_id = $1`, [userId]),
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

export default router;
