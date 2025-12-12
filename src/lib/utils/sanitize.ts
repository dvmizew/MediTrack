import DOMPurify from 'dompurify';

export function sanitizeHTML(input: string): string {
  // Basic HTML sanitization for rendering user-provided content in the UI
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
  });
}
