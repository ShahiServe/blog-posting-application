import sanitizeHtml from "sanitize-html";

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: { a: ["href", "name", "id"], img: ["src", "alt", "width", "height"], "*": ["id"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
  });
}
