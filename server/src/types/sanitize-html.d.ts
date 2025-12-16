declare module 'sanitize-html' {
  function sanitizeHtml(dirty: string, options?: sanitizeHtml.IOptions): string;

  namespace sanitizeHtml {
    interface IOptions {
      allowedTags?: string[];
      allowedAttributes?: Record<string, string[]>;
      allowedSchemes?: string[];
      transformTags?: Record<string, (tagName: string, attribs: any) => { tagName: string; attribs?: any }>;
    }

    const defaults: {
      allowedTags: string[];
      allowedAttributes: Record<string, string[]>;
      [key: string]: any;
    };
  }

  export = sanitizeHtml;
}
