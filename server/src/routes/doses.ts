import express, { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Add dose to treatment plan (medic only) - Uses TreatmentDose table
router.post(
  '/',
  authenticate,
  authorize('medic'),
  [
    body('planId').isInt(),
    body('medicationName').notEmpty(),
    body('cantitate').notEmpty(),
    body('ora').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('frecventa').notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').optional().isISO8601(),
    body('instructiuni').optional(),
    body('detaliiMedicament').notEmpty(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const medicId = req.user!.userId;
      const {
        planId,
        medicationName,
        cantitate,
        ora,
        frecventa,
        startDate,
        endDate,
        instructiuni,
        detaliiMedicament,
      } = req.body;

      // Verify medic owns the treatment plan
      const plan = await query(
        'SELECT patient_id FROM treatment_plans WHERE plan_id = $1 AND doctor_id = $2',
        [planId, medicId]
      );

      if (plan.rows.length === 0) {
        return res.status(404).json({ error: 'Treatment plan not found' });
      }

      const result = await query(
        `INSERT INTO treatment_doses 
         (plan_id, medication_name, cantitate, ora, frecventa, start_date, end_date, instructiuni, detalii_medicament) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [planId, medicationName, cantitate, ora, frecventa, startDate, endDate, instructiuni, detaliiMedicament]
      );

      // Notify patient
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'reminder', 'sent', 'New Medication', $2, $3)`,
        [plan.rows[0].patient_id, `New medication added: ${medicationName}`, result.rows[0].dose_id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Add dose error:', error);
      res.status(500).json({ error: 'Failed to add dose' });
    }
  }
);

// Get doses for treatment plan
router.get('/plan/:planId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user!.userId;

    // Verify access to treatment plan
    const plan = await query(
      'SELECT plan_id FROM treatment_plans WHERE plan_id = $1 AND (doctor_id = $2 OR patient_id = $2)',
      [planId, userId]
    );

    if (plan.rows.length === 0) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const result = await query(
      'SELECT * FROM treatment_doses WHERE plan_id = $1 AND is_active = true ORDER BY ora',
      [planId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get doses error:', error);
    res.status(500).json({ error: 'Failed to fetch doses' });
  }
});

// Update dose (medic only)
router.patch(
  '/:doseId',
  authenticate,
  authorize('medic'),
  async (req: AuthRequest, res) => {
    try {
      const { doseId } = req.params;
      const medicId = req.user!.userId;
      const updates = req.body;

      // Verify medic owns the dose through treatment plan
      const dose = await query(
        `SELECT td.*, tp.patient_id 
         FROM treatment_doses td
         JOIN treatment_plans tp ON td.plan_id = tp.plan_id
         WHERE td.dose_id = $1 AND tp.doctor_id = $2`,
        [doseId, medicId]
      );

      if (dose.rows.length === 0) {
        return res.status(404).json({ error: 'Dose not found' });
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['medicationName', 'cantitate', 'ora', 'frecventa', 'startDate', 'endDate', 'instructiuni', 'detaliiMedicament', 'isActive'];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          // Convert camelCase to snake_case
          const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          fields.push(`${dbField} = $${paramCount}`);
          values.push(updates[field]);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(doseId);

      const result = await query(
        `UPDATE treatment_doses SET ${fields.join(', ')} WHERE dose_id = $${paramCount} RETURNING *`,
        values
      );

      // Notify patient
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'treatment_update', 'sent', 'Medication Updated', 'Your medication schedule has been updated', $2)`,
        [dose.rows[0].patient_id, doseId]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update dose error:', error);
      res.status(500).json({ error: 'Failed to update dose' });
    }
  }
);

export default router;
