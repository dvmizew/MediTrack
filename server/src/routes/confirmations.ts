import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

const XP_PER_DOSE = 10;
const BADGE_THRESHOLDS = {
  bronze: 100,
  silver: 500,
  gold: 1000,
  platinum: 2500,
  diamond: 5000,
};

// Helper function to get Romanian badge names
function getBadgeNameRo(badge: string): string {
  const names: Record<string, string> = {
    bronze: 'BRONZ',
    silver: 'ARGINT',
    gold: 'AUR',
    platinum: 'PLATINĂ',
    diamond: 'DIAMANT'
  };
  return names[badge] || badge.toUpperCase();
}

// Get today's doses for patient
router.get('/today', authenticate, async (req: Request, res: Response) => {
  try {
    const patientId = (req as AuthRequest).user!.userId;
    
    const result = await query(
      `SELECT td.*, dc.confirm_id, dc.timestamp_confirmare, dc.rezultat, dc.snoozed_until
       FROM treatment_doses td
       JOIN treatment_plans tp ON td.plan_id = tp.plan_id
       LEFT JOIN dose_confirmations dc ON td.dose_id = dc.dose_id 
         AND DATE(dc.scheduled_for) = CURRENT_DATE
       WHERE tp.patient_id = $1 
         AND td.is_active = true
         AND td.is_deleted = false
         AND tp.is_deleted = false
         AND CURRENT_DATE BETWEEN td.start_date AND COALESCE(td.end_date, CURRENT_DATE + INTERVAL '100 years')
       ORDER BY td.ora`,
      [patientId]
    );

    res.json(result.rows.map((d: any) => ({
      doseId: d.dose_id,
      planId: d.plan_id,
      medicationName: d.medication_name,
      cantitate: d.cantitate,
      ora: d.ora,
      frecventa: d.frecventa,
      startDate: d.start_date,
      endDate: d.end_date,
      instructiuni: d.instructiuni,
      detaliiMedicament: d.detalii_medicament,
      isActive: d.is_active,
      status: d.status,
      confirmId: d.confirm_id,
      timestampConfirmare: d.timestamp_confirmare,
      rezultat: d.rezultat,
      snoozedUntil: d.snoozed_until
    })));
  } catch (error) {
    logger.error('Get today doses error', { error });
    res.status(500).json({ error: 'Failed to fetch doses' });
  }
});

// Confirm dose taken
router.post(
  '/confirm',
  authenticate,
  [
    body('doseId').isInt(),
    body('scheduledFor').isISO8601(),
    body('notes').optional(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const patientId = (req as AuthRequest).user!.userId;
      const { doseId, scheduledFor, notes } = req.body;

      const doseOwner = await query(
        `SELECT tp.patient_id 
         FROM treatment_doses td 
         JOIN treatment_plans tp ON td.plan_id = tp.plan_id
         WHERE td.dose_id = $1 AND tp.patient_id = $2 AND td.is_deleted = false AND tp.is_deleted = false`,
        [doseId, patientId]
      );

      if (doseOwner.rows.length === 0) {
        return res.status(404).json({ error: 'Dose not found' });
      }

      // Check if already confirmed
      const existingConfirmation = await query(
        'SELECT confirm_id, rezultat FROM dose_confirmations WHERE dose_id = $1 AND DATE(scheduled_for) = DATE($2::timestamp)',
        [doseId, scheduledFor]
      );

      if (existingConfirmation.rows.length > 0 && existingConfirmation.rows[0].rezultat === 'pozitiv') {
        return res.status(400).json({ error: 'Dose already confirmed' });
      }

      let confirmResult;

      if (existingConfirmation.rows.length > 0) {
        // Update existing
        confirmResult = await query(
          `UPDATE dose_confirmations 
           SET rezultat = 'pozitiv', timestamp_confirmare = CURRENT_TIMESTAMP, xp_earned = $1, notes = $2
           WHERE confirm_id = $3 
           RETURNING *`,
          [XP_PER_DOSE, notes, existingConfirmation.rows[0].confirm_id]
        );
      } else {
        // Create new confirmation
        confirmResult = await query(
          `INSERT INTO dose_confirmations 
           (dose_id, scheduled_for, timestamp_confirmare, rezultat, xp_earned, notes) 
           VALUES ($1, $2, CURRENT_TIMESTAMP, 'pozitiv', $3, $4) 
           RETURNING *`,
          [doseId, scheduledFor, XP_PER_DOSE, notes]
        );
      }

      // Update patient profile stats
      const statsResult = await query(
        `UPDATE patient_profiles 
         SET nivel_xp = nivel_xp + $1,
             current_streak = current_streak + 1,
             longest_streak = GREATEST(longest_streak, current_streak + 1),
             progres_total = progres_total + 1,
             last_activity = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE patient_id = $2
         RETURNING *`,
        [XP_PER_DOSE, patientId]
      );

      // Calculate badge
      const stats = statsResult.rows[0];
      let newBadge = null;
      
      if (stats.nivel_xp >= BADGE_THRESHOLDS.diamond) newBadge = 'diamond';
      else if (stats.nivel_xp >= BADGE_THRESHOLDS.platinum) newBadge = 'platinum';
      else if (stats.nivel_xp >= BADGE_THRESHOLDS.gold) newBadge = 'gold';
      else if (stats.nivel_xp >= BADGE_THRESHOLDS.silver) newBadge = 'silver';
      else if (stats.nivel_xp >= BADGE_THRESHOLDS.bronze) newBadge = 'bronze';

      if (newBadge && newBadge !== stats.current_badge) {
        await query(
          'UPDATE patient_profiles SET current_badge = $1 WHERE patient_id = $2',
          [newBadge, patientId]
        );
        
        await query(
          `INSERT INTO notifications (user_id, tip, status_notif, title, message) 
           VALUES ($1, 'alert', 'sent', 'Badge Deblocat!', $2)`,
          [patientId, `Felicitări! Ai obținut badge-ul ${getBadgeNameRo(newBadge)}!`]
        );
      }

      // Update dose status
      await query(
        'UPDATE treatment_doses SET status = $1 WHERE dose_id = $2',
        ['confirmed', doseId]
      );

      res.json({
        confirmation: confirmResult.rows[0],
        stats: {
          totalXp: stats.nivel_xp,
          currentStreak: stats.current_streak,
          longestStreak: stats.longest_streak,
          currentBadge: newBadge || stats.current_badge,
        },
      });
    } catch (error) {
      logger.error('Confirm dose error', { error });
      res.status(500).json({ error: 'Failed to confirm dose' });
    }
  }
);

// Snooze dose reminder
router.post(
  '/snooze',
  authenticate,
  [
    body('doseId').isInt(),
    body('scheduledFor').isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { doseId, scheduledFor } = req.body;

      const doseOwner = await query(
        `SELECT tp.patient_id 
         FROM treatment_doses td 
         JOIN treatment_plans tp ON td.plan_id = tp.plan_id
         WHERE td.dose_id = $1 AND tp.patient_id = $2 AND td.is_deleted = false AND tp.is_deleted = false`,
        [doseId, (req as AuthRequest).user!.userId]
      );

      if (doseOwner.rows.length === 0) {
        return res.status(404).json({ error: 'Dose not found' });
      }

      // Calculate snooze time (30 minutes from now)
      const snoozedUntil = new Date(Date.now() + 30 * 60 * 1000);

      // Check if confirmation exists
      const existing = await query(
        'SELECT confirm_id FROM dose_confirmations WHERE dose_id = $1 AND DATE(scheduled_for) = DATE($2::timestamp)',
        [doseId, scheduledFor]
      );

      let result;

      if (existing.rows.length > 0) {
        result = await query(
          'UPDATE dose_confirmations SET snoozed_until = $1 WHERE confirm_id = $2 RETURNING *',
          [snoozedUntil, existing.rows[0].confirm_id]
        );
      } else {
        result = await query(
          `INSERT INTO dose_confirmations 
           (dose_id, scheduled_for, snoozed_until, rezultat) 
           VALUES ($1, $2, $3, 'negativ') 
           RETURNING *`,
          [doseId, scheduledFor, snoozedUntil]
        );
      }

    // Update notification status
    await query(
      `UPDATE notifications 
         SET status_notif = 'snoozed' 
         WHERE user_id = $1 AND reference_id = $2 AND tip = 'reminder'`,
      [(req as AuthRequest).user!.userId, doseId]
    );

    const snooze = result.rows[0];
    res.json({
      confirmId: snooze.confirm_id,
      doseId: snooze.dose_id,
      scheduledFor: snooze.scheduled_for,
      timestampConfirmare: snooze.timestamp_confirmare,
      rezultat: snooze.rezultat,
      xpEarned: snooze.xp_earned,
      notes: snooze.notes,
      snoozedUntil: snooze.snoozed_until
    });
  } catch (error) {
    logger.error('Snooze dose error', { error });
    res.status(500).json({ error: 'Failed to snooze dose' });
  }
  }
);

// Get dose confirmation history
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const patientId = (req as AuthRequest).user!.userId;
    
    const result = await query(
      `SELECT dc.*, td.medication_name, td.cantitate, td.ora
       FROM dose_confirmations dc
       JOIN treatment_doses td ON dc.dose_id = td.dose_id
       JOIN treatment_plans tp ON td.plan_id = tp.plan_id
      WHERE tp.patient_id = $1 AND td.is_deleted = false AND tp.is_deleted = false
       ORDER BY dc.scheduled_for DESC
       LIMIT 100`,
      [patientId]
    );

    res.json(result.rows.map((d: any) => ({
      confirmId: d.confirm_id,
      doseId: d.dose_id,
      scheduledFor: d.scheduled_for,
      timestampConfirmare: d.timestamp_confirmare,
      rezultat: d.rezultat,
      xpEarned: d.xp_earned,
      notes: d.notes,
      snoozedUntil: d.snoozed_until,
      medicationName: d.medication_name,
      cantitate: d.cantitate,
      ora: d.ora
    })));
  } catch (error) {
    logger.error('Get history error', { error });
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get daily adherence history for the past 30 days
router.get('/history/adherence', authenticate, async (req: Request, res: Response) => {
  try {
    const patientId = (req as AuthRequest).user!.userId;
    const days = Math.min(parseInt((req.query.days as string) || '30'), 365);

    const result = await query(
      `SELECT 
         DATE(td.start_date) as date,
         COUNT(DISTINCT td.dose_id) as total_doses,
         COUNT(DISTINCT CASE WHEN dc.rezultat = 'pozitiv' THEN td.dose_id END) as taken_doses
       FROM treatment_doses td
       JOIN treatment_plans tp ON td.plan_id = tp.plan_id
       LEFT JOIN dose_confirmations dc ON td.dose_id = dc.dose_id 
         AND DATE(dc.scheduled_for) = DATE(td.start_date)
       WHERE tp.patient_id = $1
         AND td.is_deleted = false
         AND tp.is_deleted = false
         AND td.is_active = true
         AND DATE(td.start_date) >= CURRENT_DATE - INTERVAL '1 day' * $2
       GROUP BY DATE(td.start_date)
       ORDER BY date DESC`,
      [patientId, days]
    );

    res.json(result.rows.map((d: any) => ({
      date: d.date,
      totalDoses: parseInt(d.total_doses),
      takenDoses: parseInt(d.taken_doses),
      adherenceRate: d.total_doses ? Math.round((parseInt(d.taken_doses) / parseInt(d.total_doses)) * 100) : 0
    })));
  } catch (error) {
    logger.error('Get adherence history error', { error });
    res.status(500).json({ error: 'Failed to fetch adherence history' });
  }
});

export default router;
