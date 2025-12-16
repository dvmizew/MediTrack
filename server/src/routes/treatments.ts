import express, { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { sanitizeBody } from '../middleware/sanitize.js';
import { query } from '../config/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();
const DELETE_CONFIRM_WINDOW_MS = 5000;
const pendingDeleteTokens = new Map<string, { planId: number; doctorId: number; expiresAt: number }>();

// Create treatment plan (medic only)
router.post(
  '/',
  authenticate,
  sanitizeBody,
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
         VALUES ($1, 'treatment_update', 'sent', 'Plan de tratament nou', 'Medicul tău a creat un plan de tratament nou', $2)`,
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
        WHERE tp.doctor_id = $1 AND tp.activ = true AND tp.is_deleted = false
        ORDER BY tp.data_creare DESC
      `;
      params = [userId];
    } else {
      queryText = `
        SELECT tp.*, u.full_name as doctor_name, u.email as doctor_email
        FROM treatment_plans tp
        JOIN users u ON tp.doctor_id = u.user_id
        WHERE tp.patient_id = $1 AND tp.activ = true AND tp.is_deleted = false
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
       WHERE tp.plan_id = $1 AND tp.is_deleted = false AND (tp.doctor_id = $2 OR tp.patient_id = $2)`,
      [planId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    // Get medications
    const medications = await query(
      'SELECT * FROM treatment_doses WHERE plan_id = $1 AND is_deleted = false ORDER BY created_at',
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
        'SELECT patient_id FROM treatment_plans WHERE plan_id = $1 AND doctor_id = $2 AND is_deleted = false',
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
         VALUES ($1, 'treatment_update', 'sent', 'Tratament actualizat', 'Planul tău de tratament a fost actualizat', $2)`,
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

// Delete treatment plan with 5s confirmation window (medic only, soft delete)
router.delete(
  '/:planId',
  authenticate,
  authorize('medic'),
  async (req: Request, res: Response) => {
    try {
      const { planId } = req.params;
      const doctorId = (req as AuthRequest).user!.userId;
      const confirmToken = (req.query.confirmToken as string | undefined) ?? undefined;
      const numericPlanId = parseInt(planId, 10);

      if (Number.isNaN(numericPlanId)) {
        return res.status(400).json({ error: 'Invalid plan id' });
      }

      // Verify ownership and current state
      const planCheck = await query(
        'SELECT patient_id, is_deleted FROM treatment_plans WHERE plan_id = $1 AND doctor_id = $2',
        [numericPlanId, doctorId]
      );

      if (planCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Treatment plan not found' });
      }

      if (planCheck.rows[0].is_deleted) {
        return res.status(410).json({ error: 'Treatment plan already deleted' });
      }

      // First call: issue confirmation token valid for 5 seconds
      if (!confirmToken) {
        const token = randomUUID();
        const expiresAt = Date.now() + DELETE_CONFIRM_WINDOW_MS;
        pendingDeleteTokens.set(token, { planId: numericPlanId, doctorId, expiresAt });

        setTimeout(() => {
          const pending = pendingDeleteTokens.get(token);
          if (pending && pending.expiresAt <= Date.now()) {
            pendingDeleteTokens.delete(token);
          }
        }, DELETE_CONFIRM_WINDOW_MS + 100);

        return res.status(202).json({ confirmToken: token, expiresAt });
      }

      // Second call: validate token and perform soft delete
      const tokenData = pendingDeleteTokens.get(confirmToken);

      if (!tokenData || tokenData.planId !== numericPlanId || tokenData.doctorId !== doctorId) {
        return res.status(400).json({ error: 'Invalid or expired confirmation token' });
      }

      if (tokenData.expiresAt < Date.now()) {
        pendingDeleteTokens.delete(confirmToken);
        return res.status(410).json({ error: 'Confirmation window expired' });
      }

      const result = await query(
        `UPDATE treatment_plans 
         SET activ = false, is_deleted = true, updated_at = CURRENT_TIMESTAMP 
         WHERE plan_id = $1 
         RETURNING *`,
        [numericPlanId]
      );

      await query(
        `UPDATE treatment_doses 
         SET is_active = false, is_deleted = true, updated_at = CURRENT_TIMESTAMP 
         WHERE plan_id = $1`,
        [numericPlanId]
      );

      pendingDeleteTokens.delete(confirmToken);

      // Notify patient about deletion
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'treatment_update', 'sent', 'Plan de tratament șters', 'Medicul tău a șters planul de tratament', $2)`,
        [planCheck.rows[0].patient_id, numericPlanId]
      );

      const plan = result.rows[0];
      res.json({
        message: 'Treatment plan deleted',
        planId: plan.plan_id,
        deletedAt: plan.updated_at
      });
    } catch (error) {
      logger.error('Delete treatment plan error', { error });
      res.status(500).json({ error: 'Failed to delete treatment plan' });
    }
  }
);

export default router;
