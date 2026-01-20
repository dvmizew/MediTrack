import { describe, it, expect } from 'vitest';
import { 
  emailSchema, 
  passwordSchema, 
  authLoginSchema, 
  authRegisterSchema,
  profileUpdateSchema,
  messageSchema,
  treatmentSchema,
  parseWithFriendlyErrors 
} from './schemas.js';

describe('Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('notanemail');
      expect(result.success).toBe(false);
    });

    it('should trim and lowercase email', () => {
      const result = emailSchema.safeParse('  USER@EXAMPLE.COM  ');
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should reject email that is too short', () => {
      const result = emailSchema.safeParse('a@b');
      expect(result.success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      const result = passwordSchema.safeParse('password123');
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 6 characters', () => {
      const result = passwordSchema.safeParse('12345');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('minim 6');
      }
    });
  });

  describe('authLoginSchema', () => {
    it('should accept valid login data', () => {
      const data = { email: 'user@example.com', password: 'password123' };
      const result = authLoginSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject missing password', () => {
      const data = { email: 'user@example.com' };
      const result = authLoginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('authRegisterSchema', () => {
    it('should accept valid registration data', () => {
      const data = { 
        email: 'user@example.com', 
        password: 'password123',
        fullName: 'John Doe'
      };
      const result = authRegisterSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should default role to pacient', () => {
      const data = { 
        email: 'user@example.com', 
        password: 'password123',
        fullName: 'John Doe'
      };
      const result = authRegisterSchema.safeParse(data);
      if (result.success) {
        expect(result.data.role).toBe('pacient');
      }
    });

    it('should reject invalid role', () => {
      const data = { 
        email: 'user@example.com', 
        password: 'password123',
        fullName: 'John Doe',
        role: 'hacker' as any
      };
      const result = authRegisterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('profileUpdateSchema', () => {
    it('should accept valid avatar URL', () => {
      const data = { avatarUrl: 'https://example.com/avatar.jpg' };
      const result = profileUpdateSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const data = { avatarUrl: 'not-a-url' };
      const result = profileUpdateSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('messageSchema', () => {
    it('should accept valid message', () => {
      const data = { toUserId: 123, content: 'Hello world' };
      const result = messageSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const data = { toUserId: 123, content: '   ' };
      const result = messageSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject message exceeding max length', () => {
      const data = { toUserId: 123, content: 'a'.repeat(5001) };
      const result = messageSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('treatmentSchema', () => {
    it('should accept valid treatment', () => {
      const data = { 
        name: 'Aspirin', 
        dosage: '100mg daily',
        description: 'For pain relief'
      };
      const result = treatmentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject treatment without dosage', () => {
      const data = { name: 'Aspirin', dosage: '' };
      const result = treatmentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('parseWithFriendlyErrors', () => {
    it('should return success for valid data', () => {
      const result = parseWithFriendlyErrors(emailSchema, 'user@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should return friendly error messages', () => {
      const result = parseWithFriendlyErrors(emailSchema, 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeInstanceOf(Array);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Email');
      }
    });
  });
});
