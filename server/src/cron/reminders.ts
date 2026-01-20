import cron from 'node-cron';
import { query } from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

export const startReminderCron = () => {
  // Run every minute to check for medication reminders
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS format

      // Find doses that need reminders - use treatment_doses table
      const result = await query(
        `SELECT td.dose_id, td.medication_name, td.cantitate, tp.patient_id, td.ora, td.plan_id
         FROM treatment_doses td
         JOIN treatment_plans tp ON td.plan_id = tp.plan_id
         WHERE td.is_active = true
           AND td.is_deleted = false
           AND tp.is_deleted = false
           AND tp.activ = true
           AND CURRENT_DATE BETWEEN td.start_date AND COALESCE(td.end_date, CURRENT_DATE + INTERVAL '100 years')
           AND td.ora = $1::TIME`,
        [currentTime]
      );

      for (const dose of result.rows) {
        const scheduledTime = new Date();
        const [hours, minutes] = dose.ora.split(':');
        scheduledTime.setHours(parseInt(hours));
        scheduledTime.setMinutes(parseInt(minutes));
        scheduledTime.setSeconds(0);

        // Check if already confirmed or snoozed - use dose_confirmations table
        const confirmCheck = await query(
          `SELECT confirm_id, snoozed_until, rezultat FROM dose_confirmations 
           WHERE dose_id = $1 
             AND DATE(scheduled_for) = CURRENT_DATE`,
          [dose.dose_id]
        );

        if (confirmCheck.rows.length > 0) {
          const confirmation = confirmCheck.rows[0];
          
          // If already confirmed positively, skip
          if (confirmation.rezultat === 'pozitiv') {
            continue;
          }
          
          // If snoozed and snooze time hasn't passed, skip
          if (confirmation.snoozed_until && new Date(confirmation.snoozed_until) > now) {
            continue;
          }
        } else {
          // Create new dose confirmation entry with 'negativ' result
          await query(
            `INSERT INTO dose_confirmations (dose_id, scheduled_for, rezultat) 
             VALUES ($1, $2, 'negativ')`,
            [dose.dose_id, scheduledTime]
          );
        }

        // Create notification with status_notif='sent'
        await query(
          `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
           VALUES ($1, 'reminder', 'sent', 'Memento medicament', $2, $3)`,
          [
            dose.patient_id,
            `Ia ${dose.medication_name} - ${dose.cantitate}`,
            dose.dose_id
          ]
        );

        // Send real-time notification via Socket.io (stored in Redis for retrieval)
        await redis.publish(
          'medication-reminder',
          JSON.stringify({
            userId: dose.patient_id,
            doseId: dose.dose_id,
            medicationName: dose.medication_name,
            cantitate: dose.cantitate,
            scheduledTime: scheduledTime.toISOString(),
          })
        );
      }

    } catch (error) {
      console.error('Reminder cron error:', error);
    }
  });

  logger.info('Medication reminder cron started');
};
