import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Create treatment plan (medic only)
router.post(
  '/',
  authenticate,
  authorize('medic'),
  [
    body('pacientId').isInt(),
    body('diagnosis').notEmpty(),
    body('description').optional(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const medicId = (req as AuthRequest).user!.userId;
      const { pacientId, diagnosis, description } = req.body;

      // Verify collaboration
      const collaboration = await query(
        'SELECT id FROM doctor_patient WHERE doctor_id = $1 AND patient_id = $2 AND status_invitatie = $3',
        [medicId, pacientId, 'accepted']
      );

      if (collaboration.rows.length === 0) {
        return res.status(403).json({ error: 'No active collaboration with this pacient' });
      }

      const result = await query(
        `INSERT INTO treatment_plans (patient_id, doctor_id, diagnoza, descriere) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [pacientId, medicId, diagnosis, description]
      );

      // Notify pacient
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'treatment_update', 'sent', 'New Treatment Plan', 'Your medic has created a new treatment plan', $2)`,
        [pacientId, result.rows[0].plan_id]
      );

      const plan = result.rows[0];
      res.status(201).json({
        planId: plan.plan_id,
        patientId: plan.patient_id,
        doctorId: plan.doctor_id,
        diagnoza: plan.diagnoza,
        descriere: plan.descriere,
        activ: plan.activ,
        dataCreare: plan.data_creare,
        updatedAt: plan.updated_at
      });
    } catch (error) {
      logger.error('Create treatment plan error', { error });
      res.status(500).json({ error: 'Failed to create treatment plan' });
    }
  }
);

// Get treatment plans
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const role = (req as AuthRequest).user!.role;

    let queryText;
    let params;

    if (role === 'medic') {
      queryText = `
        SELECT tp.*, u.full_name as patient_name, u.email as patient_email
        FROM treatment_plans tp
        JOIN users u ON tp.patient_id = u.user_id
        WHERE tp.doctor_id = $1 AND tp.activ = true
        ORDER BY tp.data_creare DESC
      `;
      params = [userId];
    } else {
      queryText = `
        SELECT tp.*, u.full_name as doctor_name, u.email as doctor_email
        FROM treatment_plans tp
        JOIN users u ON tp.doctor_id = u.user_id
        WHERE tp.patient_id = $1 AND tp.activ = true
        ORDER BY tp.data_creare DESC
      `;
      params = [userId];
    }

    const result = await query(queryText, params);
    res.json(result.rows.map((tp: any) => ({
      planId: tp.plan_id,
      patientId: tp.patient_id,
      doctorId: tp.doctor_id,
      diagnoza: tp.diagnoza,
      descriere: tp.descriere,
      activ: tp.activ,
      dataCreare: tp.data_creare,
      updatedAt: tp.updated_at,
      patientName: tp.patient_name,
      patientEmail: tp.patient_email,
      doctorName: tp.doctor_name,
      doctorEmail: tp.doctor_email
    })));
  } catch (error) {
    logger.error('Get treatment plans error', { error });
    res.status(500).json({ error: 'Failed to fetch treatment plans' });
  }
});

// Get treatment plan details
router.get('/:planId', authenticate, async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

    const result = await query(
      `SELECT tp.*, 
              m.full_name as doctor_name, m.email as doctor_email,
              p.full_name as patient_name, p.email as patient_email
       FROM treatment_plans tp
       JOIN users m ON tp.doctor_id = m.user_id
       JOIN users p ON tp.patient_id = p.user_id
       WHERE tp.plan_id = $1 AND (tp.doctor_id = $2 OR tp.patient_id = $2)`,
      [planId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    // Get medications
    const medications = await query(
      'SELECT * FROM treatment_doses WHERE plan_id = $1 ORDER BY created_at',
      [planId]
    );

    const plan = result.rows[0];
    res.json({
      planId: plan.plan_id,
      patientId: plan.patient_id,
      doctorId: plan.doctor_id,
      diagnoza: plan.diagnoza,
      descriere: plan.descriere,
      activ: plan.activ,
      dataCreare: plan.data_creare,
      updatedAt: plan.updated_at,
      doctorName: plan.doctor_name,
      doctorEmail: plan.doctor_email,
      patientName: plan.patient_name,
      patientEmail: plan.patient_email,
      medications: medications.rows.map((m: any) => ({
        doseId: m.dose_id,
        planId: m.plan_id,
        medicationName: m.medication_name,
        cantitate: m.cantitate,
        ora: m.ora,
        frecventa: m.frecventa,
        startDate: m.start_date,
        endDate: m.end_date,
        instructiuni: m.instructiuni,
        detaliiMedicament: m.detalii_medicament,
        isActive: m.is_active,
        status: m.status,
        createdAt: m.created_at
      }))
    });
  } catch (error) {
    logger.error('Get treatment plan error', { error });
    res.status(500).json({ error: 'Failed to fetch treatment plan' });
  }
});

// Update treatment plan (medic only)
router.patch(
  '/:planId',
  authenticate,
  authorize('medic'),
  [
    body('diagnosis').optional().notEmpty(),
    body('description').optional(),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { planId } = req.params;
      const medicId = (req as AuthRequest).user!.userId;
      const updates = req.body;

      // Verify ownership
      const planCheck = await query(
        'SELECT patient_id FROM treatment_plans WHERE plan_id = $1 AND doctor_id = $2',
        [planId, medicId]
      );

      if (planCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Treatment plan not found' });
      }

      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updates.diagnosis !== undefined) {
        fields.push(`diagnoza = $${paramCount}`);
        values.push(updates.diagnosis);
        paramCount++;
      }
      if (updates.description !== undefined) {
        fields.push(`descriere = $${paramCount}`);
        values.push(updates.description);
        paramCount++;
      }
      if (updates.isActive !== undefined) {
        fields.push(`activ = $${paramCount}`);
        values.push(updates.isActive);
        paramCount++;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(planId);

      const result = await query(
        `UPDATE treatment_plans SET ${fields.join(', ')} WHERE plan_id = $${paramCount} RETURNING *`,
        values
      );

      // Notify pacient
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'treatment_update', 'sent', 'Treatment Updated', 'Your treatment plan has been updated', $2)`,
        [planCheck.rows[0].patient_id, planId]
      );

      const plan = result.rows[0];
      res.json({
        planId: plan.plan_id,
        patientId: plan.patient_id,
        doctorId: plan.doctor_id,
        diagnoza: plan.diagnoza,
        descriere: plan.descriere,
        activ: plan.activ,
        dataCreare: plan.data_creare,
        updatedAt: plan.updated_at
      });
    } catch (error) {
      logger.error('Update treatment plan error', { error });
      res.status(500).json({ error: 'Failed to update treatment plan' });
    }
  }
);

export default router;
