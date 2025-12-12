import sanitizeHtml from 'sanitize-html';
import type { Request, Response, NextFunction } from 'express';

const defaultConfig: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags,
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    'script': () => ({ tagName: 'noscript' }),
    'iframe': () => ({ tagName: 'div' })
  }
};

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      const val = (req.body as any)[key];
      if (typeof val === 'string') {
        (req.body as any)[key] = sanitizeHtml(val, defaultConfig);
      }
    }
  }
  next();
}
