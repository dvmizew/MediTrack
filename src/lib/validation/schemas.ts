import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email prea scurt')
  .max(254, 'Email prea lung')
  .email('Email invalid');

export const passwordSchema = z
  .string()
  .min(6, 'Parola trebuie să aibă minim 6 caractere')
  .max(128, 'Parola prea lungă');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Nume prea scurt')
  .max(100, 'Nume prea lung');

export const roleSchema = z.enum(['admin', 'medic', 'pacient'], {
  errorMap: () => ({ message: 'Rol invalid' })
});

export const authLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const authRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  role: roleSchema.optional().default('pacient')
});

export const profileUpdateSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: emailSchema.optional(),
  avatarUrl: z
    .string()
    .trim()
    .url('URL avatar invalid')
    .max(500, 'URL prea lung')
    .optional()
});

export const messageSchema = z.object({
  toUserId: z.number().int('ID invalid'),
  content: z.string().trim().min(1, 'Mesajul este gol').max(5000, 'Mesaj prea lung')
});

export const treatmentSchema = z.object({
  name: z.string().trim().min(2, 'Nume tratament prea scurt').max(200, 'Nume prea lung'),
  description: z.string().trim().max(2000, 'Descriere prea lungă').optional(),
  dosage: z.string().trim().min(1, 'Dozaj necesar').max(200, 'Dozaj prea lung'),
  startDate: z.string().datetime().or(z.string()).optional(),
  endDate: z.string().datetime().or(z.string()).optional()
});

export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type TreatmentInput = z.infer<typeof treatmentSchema>;

export function parseWithFriendlyErrors<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((i) => i.message)
  };
}
