declare module 'speakeasy' {
  interface GeneratedSecret {
    ascii?: string;
    hex?: string;
    base32: string;
    otpauth_url?: string;
  }
  interface GenerateSecretOptions {
    name?: string;
    issuer?: string;
    length?: number;
  }
  interface TotpVerifyOptions {
    secret: string;
    encoding?: 'ascii' | 'hex' | 'base32';
    token: string;
    window?: number | [number, number];
  }
  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
  export const totp: {
    verify(options: TotpVerifyOptions): boolean;
  };
  const _default: any;
  export default _default;
}