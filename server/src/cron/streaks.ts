import cron from 'node-cron';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';

export const startStreakCheckCron = () => {
  // Run at 01:00 UTC every day to check for broken streaks
  cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('Starting streak reset check');
      
      // Find all active patients with active streaks
      const patients = await query(
        `SELECT pp.patient_id, pp.current_streak, pp.last_activity
         FROM patient_profiles pp
         JOIN users u ON pp.patient_id = u.user_id
         WHERE u.role = 'pacient' 
           AND u.is_active = true
           AND pp.current_streak > 0`
      );

      let resetCount = 0;

      for (const patient of patients.rows) {
        // Check if patient had any doses scheduled YESTERDAY
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const scheduledDoses = await query(
          `SELECT COUNT(*)::int as count
           FROM treatment_doses td
           JOIN treatment_plans tp ON td.plan_id = tp.plan_id
           WHERE tp.patient_id = $1
             AND td.is_active = true
             AND td.is_deleted = false
             AND tp.is_deleted = false
             AND tp.activ = true
             AND $2::DATE BETWEEN td.start_date AND COALESCE(td.end_date, $2::DATE)`,
          [patient.patient_id, yesterdayStr]
        );

        // Only reset if patient HAD doses scheduled yesterday but didn't confirm any
        if (scheduledDoses.rows[0]?.count > 0) {
          const confirmedDoses = await query(
            `SELECT COUNT(*)::int as count
             FROM dose_confirmations dc
             JOIN treatment_doses td ON dc.dose_id = td.dose_id
             JOIN treatment_plans tp ON td.plan_id = tp.plan_id
             WHERE tp.patient_id = $1
               AND td.is_deleted = false
               AND tp.is_deleted = false
               AND dc.rezultat = 'pozitiv'
               AND DATE(dc.scheduled_for) = $2::DATE`,
            [patient.patient_id, yesterdayStr]
          );

          // If NO confirmed doses, reset streak to 0
          if (confirmedDoses.rows[0]?.count === 0) {
            await query(
              `UPDATE patient_profiles 
               SET current_streak = 0, updated_at = CURRENT_TIMESTAMP 
               WHERE patient_id = $1`,
              [patient.patient_id]
            );

            await query(
              `INSERT INTO notifications (user_id, tip, status_notif, title, message) 
               VALUES ($1, 'alert', 'sent', 'Streak Pierdut', 'Seria ta de medicație a fost resetată. Începe din nou astăzi!')`,
              [patient.patient_id]
            );

            resetCount++;
            logger.info('Streak reset for patient', { patientId: patient.patient_id, previousStreak: patient.current_streak });
          }
        }
      }

      logger.info('Streak reset check completed', { totalPatients: patients.rows.length, resetCount });

    } catch (error) {
      logger.error('Streak check cron error', { error });
    }
  });

  logger.info('✓ Streak check cron started (runs daily at 01:00 UTC)');
};
