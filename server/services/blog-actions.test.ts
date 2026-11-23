import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import { createShopifyDraftAction, generateBlogAction, isValidShopifyHost } from "./blog-actions.js";
import { ShopifyClient } from "./shopify-client.js";
import { handler } from "../../netlify/functions/api.js";
import { createServer } from "../index.js";

const blog = {
  title: "A title", metaTitle: "SEO title", metaDescription: "A description", slug: "a-title",
  excerpt: "An excerpt", keywords: "one, two", bodyHtml: "<h2>Introduction</h2><p>Text</p>",
};
const generation = { topic: "A topic", keywords: "one, two", audience: "Readers", instructions: "" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("GOOGLE_AI_API_KEY", "google-secret");
  vi.stubEnv("SHOPIFY_SHOP", "example.myshopify.com");
  vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "shopify-secret");
  vi.stubEnv("BLOG_ID", "123");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("blog generation", () => {
  it("validates input before calling Google", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await generateBlogAction({ ...generation, topic: "" })).statusCode).toBe(400);
    expect((await generateBlogAction({ ...generation, instructions: "x".repeat(4001) })).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the configured model and validates JSON output", async () => {
    vi.stubEnv("GOOGLE_AI_MODEL", "test-model");
    const fetch = vi.fn().mockResolvedValue(json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(blog) }] } }] }));
    vi.stubGlobal("fetch", fetch);
    expect(await generateBlogAction(generation)).toEqual({ statusCode: 200, body: { success: true, blog } });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("test-model:generateContent");
    expect(url).not.toContain("google-secret");
    expect(new Headers(options.headers).get("x-goog-api-key")).toBe("google-secret");
    expect(JSON.parse(options.body).generationConfig.responseMimeType).toBe("application/json");
    fetch.mockResolvedValueOnce(json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ ...blog, bodyHtml: 1 }) }] } }] }));
    expect((await generateBlogAction(generation)).statusCode).toBe(502);
  });
  it("defaults to an available Gemini model", async () => {
    vi.stubEnv("GOOGLE_AI_MODEL", "");
    const fetch = vi.fn().mockResolvedValue(json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(blog) }] } }] }));
    vi.stubGlobal("fetch", fetch);
    expect((await generateBlogAction(generation)).statusCode).toBe(200);
    expect(fetch.mock.calls[0][0]).toContain("gemini-3.6-flash:generateContent");
  });
  it("explains temporary provider unavailability without exposing credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new ApiError({ status: 503, message: "google-secret" })));
    const result = await generateBlogAction(generation);
    expect(result.statusCode).toBe(503);
    expect(JSON.stringify(result)).toContain("temporarily busy");
    expect(JSON.stringify(result)).not.toContain("google-secret");
  });
  it("does not expose unexpected upstream errors or credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("google-secret")));
    const result = await generateBlogAction(generation);
    expect(result.statusCode).toBe(502);
    expect(JSON.stringify(result)).not.toContain("google-secret");
  });
});

describe("Shopify drafts", () => {
  it("rejects invalid hosts and oversized blogs without sending credentials", async () => {
    for (const host of ["myshopify.com", "shop.myshopify.com.evil.test", "shop.myshopify.com:443", "https://shop.myshopify.com", "x/y.myshopify.com"]) expect(isValidShopifyHost(host)).toBe(false);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    vi.stubEnv("SHOPIFY_SHOP", "shop.myshopify.com.evil.test");
    expect((await createShopifyDraftAction({ blog })).statusCode).toBe(503);
    expect((await createShopifyDraftAction({ blog: { ...blog, bodyHtml: "x".repeat(200001) } })).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends a single create mutation with supported draft and SEO inputs", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ data: { articleCreate: { article: { id: "gid://shopify/Article/1", handle: "a-title" }, userErrors: [] } } }));
    vi.stubGlobal("fetch", fetch);
    expect((await createShopifyDraftAction({ blog })).statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.variables.article).toMatchObject({ blogId: "gid://shopify/Blog/123", isPublished: false, body: blog.bodyHtml, summary: blog.excerpt, handle: blog.slug, tags: ["one", "two"], author: { name: "Blog Generator" } });
    expect(request.variables.article.metafields).toEqual(expect.arrayContaining([
      expect.objectContaining({ namespace: "global", key: "title_tag", value: blog.metaTitle }),
      expect.objectContaining({ namespace: "global", key: "description_tag", value: blog.metaDescription }),
    ]));
  });
  it("looks up the first blog when no ID is configured", async () => {
    vi.stubEnv("BLOG_ID", "");
    const fetch = vi.fn().mockResolvedValueOnce(json({ data: { blogs: { nodes: [{ id: "gid://shopify/Blog/456" }] } } })).mockResolvedValueOnce(json({ data: { articleCreate: { article: { id: "gid://shopify/Article/1", handle: "a-title" }, userErrors: [] } } }));
    vi.stubGlobal("fetch", fetch);
    expect((await createShopifyDraftAction({ blog })).statusCode).toBe(200);
    expect(JSON.parse(fetch.mock.calls[1][1].body).variables.article.blogId).toBe("gid://shopify/Blog/456");
  });
  it("does not retry ambiguous failures or expose Shopify errors", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("shopify-secret")); vi.stubGlobal("fetch", fetch);
    const result = await createShopifyDraftAction({ blog });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.statusCode).toBe(502);
    expect(JSON.stringify(result)).toContain("Check Shopify before trying again");
    expect(JSON.stringify(result)).not.toContain("shopify-secret");
  });
  it("legacy REST creation always sends an unpublished article", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ article: { id: "1" } })); vi.stubGlobal("fetch", fetch);
    await new ShopifyClient().publishArticle("123", { title: "A", bodyHtml: "Text", publishedAt: "2025-01-01T00:00:00Z" });
    const article = JSON.parse(fetch.mock.calls[0][1].body).article;
    expect(article.published).toBe(false);
    expect(article).not.toHaveProperty("published_at");
  });
});

describe("deployment routes", () => {
  it("routes Netlify requests without CORS, and removes old endpoints", async () => {
    const call = (path: string, httpMethod: string, body: string | null = null) => handler({ path: `/api/${path}`, httpMethod, body });
    expect((await call("generate-blog", "POST", "{}" )).statusCode).toBe(400);
    expect((await call("create-shopify-draft", "POST", "{}" )).statusCode).toBe(400);
    expect((await call("verify-password", "POST", "{}" )).statusCode).toBe(404);
    expect((await call("env-check", "GET")).statusCode).toBe(404);
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "");
    expect((await call("diagnose-shopify", "GET")).statusCode).toBe(200);
    expect((await call("ping", "GET")).headers).not.toHaveProperty("Access-Control-Allow-Origin");
  });
  it("routes Express requests and removes old endpoints", async () => {
    const app = createServer();
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No port");
      const base = `http://127.0.0.1:${address.port}/api`;
      const post = (path: string) => fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      expect((await post("generate-blog")).status).toBe(400);
      expect((await post("create-shopify-draft")).status).toBe(400);
      expect((await post("verify-password")).status).toBe(404);
      expect((await fetch(`${base}/env-check`)).status).toBe(404);
      expect((await fetch(`${base}/ping`)).headers.has("access-control-allow-origin")).toBe(false);
    } finally { server.close(); }
  });
});
