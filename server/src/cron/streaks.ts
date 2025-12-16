import cron from 'node-cron';
import { query } from '../config/database.js';

export const startStreakCheckCron = () => {
  // Run at midnight every day to check for broken streaks
  cron.schedule('0 0 * * *', async () => {
    try {
      // Find patients who haven't confirmed medication in the last 24 hours - use patient_profiles table
      const result = await query(
        `SELECT pp.patient_id, pp.current_streak, pp.last_activity
         FROM patient_profiles pp
         JOIN users u ON pp.patient_id = u.user_id
         WHERE u.role = 'pacient' 
           AND u.is_active = true
           AND pp.current_streak > 0
           AND (pp.last_activity IS NULL 
                OR pp.last_activity < NOW() - INTERVAL '24 hours')`
      );

      for (const patient of result.rows) {
        // Check if patient had any doses scheduled yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const scheduledDoses = await query(
          `SELECT COUNT(*) as count
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

        if (scheduledDoses.rows[0].count > 0) {
          // Check if patient confirmed any doses yesterday
          const confirmedDoses = await query(
            `SELECT COUNT(*) as count
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

          if (confirmedDoses.rows[0].count === 0) {
            // Patient had doses scheduled but didn't confirm any - break streak
            await query(
              `UPDATE patient_profiles 
               SET current_streak = 0, updated_at = CURRENT_TIMESTAMP 
               WHERE patient_id = $1`,
              [patient.patient_id]
            );

            // Create notification with status_notif='sent'
            await query(
              `INSERT INTO notifications (user_id, tip, status_notif, title, message) 
               VALUES ($1, 'alert', 'sent', 'Streak Pierdut', 'Seria ta de medicație a fost resetată. Începe din nou astăzi!')`,
              [patient.patient_id]
            );

            console.log(`Streak reset for patient ${patient.patient_id}`);
          }
        }
      }

      // Mark missed doses - update status in treatment_doses
      await query(
        `UPDATE treatment_doses td
         SET status = 'missed'
         FROM dose_confirmations dc
         WHERE td.dose_id = dc.dose_id
           AND dc.rezultat = 'negativ' 
           AND dc.scheduled_for < NOW() - INTERVAL '24 hours'
           AND td.status != 'missed'
           AND td.is_deleted = false`
      );

    } catch (error) {
      console.error('Streak check cron error:', error);
    }
  });

  console.log('✓ Streak check cron started');
};
