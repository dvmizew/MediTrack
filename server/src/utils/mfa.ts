import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const TOTP_WINDOW = Number(process.env.TOTP_WINDOW ?? 2); // ±2 windows (~±60s)
const BACKUP_CODE_COUNT = Number(process.env.BACKUP_CODE_COUNT ?? 10);

export async function generateTotpSecret(email: string): Promise<{ secret: string; qrCode: string }> {
  // Generate a base32 secret and construct a standards-compliant otpauth URL explicitly
  const secret = speakeasy.generateSecret({ length: 32 });
  const label = `MediTrack:${email}`; // Issuer:Account format is widely supported
  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.base32,
    label,
    issuer: 'MediTrack',
    encoding: 'base32',
  });

  const qrCode = await QRCode.toDataURL(otpauthUrl);
  return { secret: secret.base32, qrCode };
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: TOTP_WINDOW,
    });
  } catch {
    return false;
  }
}

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase().padEnd(8, '0');
    codes.push(code);
  }
  return codes;
}

export function verifyBackupCode(backupCodes: string[] | null, code: string): boolean {
  if (!backupCodes) return false;
  return backupCodes.includes(code.toUpperCase());
}

export function removeBackupCode(backupCodes: string[] | null, code: string): string[] {
  if (!backupCodes) return [];
  return backupCodes.filter((c) => c !== code.toUpperCase());
}
