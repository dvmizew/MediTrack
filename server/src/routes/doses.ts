import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
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
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const medicId = (req as AuthRequest).user!.userId;
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
         VALUES ($1, 'reminder', 'sent', 'Medicament nou', $2, $3)`,
        [plan.rows[0].patient_id, `Medicament adăugat: ${medicationName}`, result.rows[0].dose_id]
      );

      const dose = result.rows[0];
      res.status(201).json({
        doseId: dose.dose_id,
        planId: dose.plan_id,
        medicationName: dose.medication_name,
        cantitate: dose.cantitate,
        ora: dose.ora,
        frecventa: dose.frecventa,
        startDate: dose.start_date,
        endDate: dose.end_date,
        instructiuni: dose.instructiuni,
        detaliiMedicament: dose.detalii_medicament,
        isActive: dose.is_active,
        status: dose.status,
        createdAt: dose.created_at
      });
    } catch (error) {
      logger.error('Add dose error', { error });
      res.status(500).json({ error: 'Failed to add dose' });
    }
  }
);

// Get doses for treatment plan
router.get('/plan/:planId', authenticate, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

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
      createdAt: d.created_at
    })));
  } catch (error) {
    logger.error('Get doses error', { error });
    res.status(500).json({ error: 'Failed to fetch doses' });
  }
});

// Update dose (medic only)
router.patch(
  '/:doseId',
  authenticate,
  authorize('medic'),
  async (req: Request, res: Response) => {
    try {
      const { doseId } = req.params;
      const medicId = (req as AuthRequest).user!.userId;
      const updates = req.body;

      // Verify medic owns the dose through treatment plan
      const doseCheck = await query(
        `SELECT td.*, tp.patient_id 
         FROM treatment_doses td
         JOIN treatment_plans tp ON td.plan_id = tp.plan_id
         WHERE td.dose_id = $1 AND tp.doctor_id = $2`,
        [doseId, medicId]
      );

      if (doseCheck.rows.length === 0) {
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
         VALUES ($1, 'treatment_update', 'sent', 'Medicament actualizat', 'Programul de medicație a fost actualizat', $2)`,
        [doseCheck.rows[0].patient_id, doseId]
      );

      const dose = result.rows[0];
      res.json({
        doseId: dose.dose_id,
        planId: dose.plan_id,
        medicationName: dose.medication_name,
        cantitate: dose.cantitate,
        ora: dose.ora,
        frecventa: dose.frecventa,
        startDate: dose.start_date,
        endDate: dose.end_date,
        instructiuni: dose.instructiuni,
        detaliiMedicament: dose.detalii_medicament,
        isActive: dose.is_active,
        status: dose.status,
        createdAt: dose.created_at
      });
    } catch (error) {
      logger.error('Update dose error', { error });
      res.status(500).json({ error: 'Failed to update dose' });
    }
  }
);

export default router;
