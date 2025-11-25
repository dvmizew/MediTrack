import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Send invite (pacient invites medic)
router.post(
  '/invite',
  authenticate,
  [body('medicEmail').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const pacientId = (req as AuthRequest).user!.userId;
      const { medicEmail } = req.body;

      // Find medic
      const medicResult = await query(
        'SELECT user_id, role FROM users WHERE email = $1 AND is_active = true',
        [medicEmail]
      );

      if (medicResult.rows.length === 0) {
        return res.status(404).json({ error: 'Medic not found' });
      }

      const medic = medicResult.rows[0];

      if (medic.role !== 'medic') {
        return res.status(400).json({ error: 'User is not a medic' });
      }

      // Check if collaboration already exists
      const existing = await query(
        'SELECT id, status_invitatie FROM doctor_patient WHERE patient_id = $1 AND doctor_id = $2',
        [pacientId, medic.user_id]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Invite already exists', 
          status: existing.rows[0].status_invitatie 
        });
      }

      // Create collaboration invite
      const result = await query(
        `INSERT INTO doctor_patient (patient_id, doctor_id, status_invitatie) 
         VALUES ($1, $2, 'pending') 
         RETURNING *`,
        [pacientId, medic.user_id]
      );

      // Create notification for medic
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'invite', 'sent', 'New Collaboration Invite', 'You have a new collaboration request', $2)`,
        [medic.user_id, result.rows[0].id]
      );

      const invite = result.rows[0];
      res.status(201).json({
        id: invite.id,
        patientId: invite.patient_id,
        doctorId: invite.doctor_id,
        statusInvitatie: invite.status_invitatie,
        invitedAt: invite.invited_at,
        respondedAt: invite.responded_at
      });
    } catch (error) {
      logger.error('Send invite error', { error });
      res.status(500).json({ error: 'Failed to send invite' });
    }
  }
);

// Get pending invites (for medic)
router.get('/pending', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;

    const result = await query(
      `SELECT c.*, u.email as pacient_email, u.full_name as pacient_name
       FROM doctor_patient c
       JOIN users u ON c.patient_id = u.user_id
       WHERE c.doctor_id = $1 AND c.status_invitatie = 'pending'
       ORDER BY c.invited_at DESC`,
      [userId]
    );

    res.json(result.rows.map((c: any) => ({
      id: c.id,
      patientId: c.patient_id,
      doctorId: c.doctor_id,
      statusInvitatie: c.status_invitatie,
      invitedAt: c.invited_at,
      respondedAt: c.responded_at,
      pacientEmail: c.pacient_email,
      pacientName: c.pacient_name
    })));
  } catch (error) {
    logger.error('Get pending invites error', { error });
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Respond to invite (medic accepts/rejects)
router.patch(
  '/:inviteId/respond',
  authenticate,
  [body('action').isIn(['accept', 'reject'])],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { inviteId } = req.params;
      const { action } = req.body;
      const medicId = (req as AuthRequest).user!.userId;

      const status = action === 'accept' ? 'accepted' : 'rejected';

      const result = await query(
        `UPDATE doctor_patient 
         SET status_invitatie = $1, responded_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND doctor_id = $3 AND status_invitatie = 'pending'
         RETURNING *`,
        [status, inviteId, medicId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invite not found or already responded' });
      }

      // Notify pacient
      const notificationMessage = action === 'accept' 
        ? 'Your collaboration request was accepted' 
        : 'Your collaboration request was declined';

      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'invite', 'sent', 'Invite Response', $2, $3)`,
        [result.rows[0].patient_id, notificationMessage, inviteId]
      );

      const collab = result.rows[0];
      res.json({
        id: collab.id,
        patientId: collab.patient_id,
        doctorId: collab.doctor_id,
        statusInvitatie: collab.status_invitatie,
        invitedAt: collab.invited_at,
        respondedAt: collab.responded_at
      });
    } catch (error) {
      logger.error('Respond to invite error', { error });
      res.status(500).json({ error: 'Failed to respond to invite' });
    }
  }
);

// Get my collaborations
router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const role = (req as AuthRequest).user!.role;

    let queryText;
    if (role === 'medic') {
      queryText = `
        SELECT c.*, u.email as pacient_email, u.full_name as pacient_name, u.avatar_url as pacient_avatar
        FROM doctor_patient c
        JOIN users u ON c.patient_id = u.user_id
        WHERE c.doctor_id = $1 AND c.status_invitatie = 'accepted'
        ORDER BY c.responded_at DESC
      `;
    } else {
      queryText = `
        SELECT c.*, u.email as medic_email, u.full_name as medic_name, u.avatar_url as medic_avatar
        FROM doctor_patient c
        JOIN users u ON c.doctor_id = u.user_id
        WHERE c.patient_id = $1 AND c.status_invitatie = 'accepted'
        ORDER BY c.responded_at DESC
      `;
    }

    const result = await query(queryText, [userId]);
    res.json(result.rows.map((c: any) => ({
      id: c.id,
      patientId: c.patient_id,
      doctorId: c.doctor_id,
      statusInvitatie: c.status_invitatie,
      invitedAt: c.invited_at,
      respondedAt: c.responded_at,
      pacientEmail: c.pacient_email,
      pacientName: c.pacient_name,
      pacientAvatar: c.pacient_avatar,
      medicEmail: c.medic_email,
      medicName: c.medic_name,
      medicAvatar: c.medic_avatar
    })));
  } catch (error) {
    logger.error('Get collaborations error', { error });
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

export default router;
