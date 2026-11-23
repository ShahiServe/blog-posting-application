import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sanitizeBlogHtml } from "@shared/sanitize-blog";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, ClipboardList, FileText, Globe2, LayoutDashboard, Lightbulb, LoaderCircle, PanelTop, PenLine, Plus, Search, Settings2, Sparkles, Store, WandSparkles } from "lucide-react";

type Blog = { title: string; metaTitle: string; metaDescription: string; slug: string; excerpt: string; keywords: string; bodyHtml: string };
type Brief = { topic: string; keywords: string; audience: string; instructions: string };
const emptyBlog: Blog = { title: "", metaTitle: "", metaDescription: "", slug: "", excerpt: "", keywords: "", bodyHtml: "" };
const emptyBrief: Brief = { topic: "", keywords: "", audience: "", instructions: "" };
const storageKey = "shahiserve-blog-workspace";

function readSaved(): { brief: Brief; blog: Blog } {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return { brief: { ...emptyBrief, ...saved?.brief }, blog: { ...emptyBlog, ...saved?.blog } };
  } catch { return { brief: emptyBrief, blog: emptyBlog }; }
}

export default function Index() {
  const [saved] = useState(readSaved);
  const [brief, setBrief] = useState<Brief>(saved.brief);
  const [blog, setBlog] = useState<Blog>(saved.blog);
  const [tab, setTab] = useState<"content" | "seo">("content");
  const [busy, setBusy] = useState<"generate" | "publish" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify({ brief, blog })); }, [brief, blog]);
  const updateBrief = (field: keyof Brief, value: string) => setBrief((prev) => ({ ...prev, [field]: value }));
  const updateBlog = (field: keyof Blog, value: string) => setBlog((prev) => ({ ...prev, [field]: value }));
  const hasContent = Boolean(blog.title.trim() && blog.bodyHtml.trim());
  const wordCount = blog.bodyHtml.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;

  async function request(path: string, payload: object) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  async function generate() {
    if (!brief.topic.trim()) return;
    if (hasContent && !window.confirm("Generate a new article? This will replace the current article and SEO fields.")) return;
    setBusy("generate"); setMessage(null);
    try {
      const data = await request("/api/generate-blog", brief);
      setBlog(data.blog); setTab("content");
      setMessage({ kind: "success", text: "Your article is ready to review. Your work is saved in this browser." });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not generate the article." }); }
    finally { setBusy(null); }
  }
  async function publish() {
    if (!hasContent) return;
    setBusy("publish"); setMessage(null);
    try {
      await request("/api/create-shopify-draft", { blog });
      setMessage({ kind: "success", text: "Your article was created as a draft in Shopify. Review it there before publishing." });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not create the Shopify draft." }); }
    finally { setBusy(null); }
  }
  function download() {
    const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(blog.metaTitle || blog.title)}</title><meta name="description" content="${escape(blog.metaDescription)}"></head><body><h1>${escape(blog.title)}</h1>${sanitizeBlogHtml(blog.bodyHtml)}</body></html>`;
    const url = URL.createObjectURL(new Blob([document], { type: "text/html;charset=utf-8" }));
    const a = window.document.createElement("a"); a.href = url; a.download = `${blog.slug || "blog-post"}.html`; a.click(); URL.revokeObjectURL(url);
  }
  function reset() {
    if ((brief.topic || hasContent) && !window.confirm("Start a new post? This will clear the current brief and article from this browser.")) return;
    setBrief(emptyBrief); setBlog(emptyBlog); setMessage(null); setTab("content");
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>shahi<span className="brand-accent">studio</span><small>CONTENT WORKSPACE</small></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#workspace"><LayoutDashboard size={18} /> Overview <ChevronRight size={15} className="nav-end" /></a>
        <a className="nav-item" href="#brief"><WandSparkles size={18} /> Create a blog</a>
        <a className="nav-item" href="#editor"><FileText size={18} /> Blog editor</a>
        <Link className="nav-item" to="/diagnostics/shopify"><Store size={18} /> Shopify connection <ArrowUpRight size={14} className="nav-end" /></Link>
      </nav>
      <div className="sidebar-bottom"><div className="side-help-icon"><Lightbulb size={18} /></div><strong>A little inspiration?</strong><p>Great content starts with a great idea. Let's bring yours to life.</p><a href="#brief">Start writing <ArrowRight size={14} /></a></div>
      <div className="side-footer"><span className="avatar">S</span><span><b>ShahiServe</b><small>Content team</small></span><span className="side-dots">···</span></div>
    </aside>
    <main className="main-area" id="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>Overview</strong></div><div className="top-actions"><span className="top-status"><span /> Workspace ready</span><span className="top-divider" /><span className="avatar small">S</span><span className="top-name">ShahiServe</span></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span /> YOUR CONTENT WORKSPACE</div><h1>Good ideas deserve <em>great stories.</em></h1><p>From a spark of inspiration to a Shopify-ready story. Let's create something worth reading.</p></div><button className="button button-outline new-button" onClick={reset}><Plus size={16} /> New blog post</button></div>
        <section className="hero-card"><div className="hero-copy"><div className="hero-tag"><Sparkles size={13} /> YOUR AI WRITING PARTNER</div><h2>Make your next story<br /><em>your best one yet.</em></h2><p>Turn your ideas into thoughtful, search-friendly articles, ready for your audience and your store.</p><a href="#brief" className="hero-link">Create your first draft <ArrowRight size={16} /></a></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div><div className="paper paper-back"/><div className="paper paper-front"><div className="paper-top"><span/><i/></div><div className="paper-heading"/><div className="paper-heading short"/><div className="paper-line"/><div className="paper-line"/><div className="paper-line shorter"/><div className="paper-image"><span>✦</span></div><div className="paper-line"/><div className="paper-line shorter"/></div><div className="art-badge"><Sparkles size={16}/></div></div><div className="hero-number">01 / 03 <span>●</span> ○ ○</div></section>
        <div className="section-heading"><div><div className="eyebrow muted">THE CREATIVE PROCESS</div><h2>Everything you need, in one place.</h2><p>A simpler way to go from an idea to a polished post.</p></div><span className="section-count">YOUR WORKFLOW <ArrowRight size={15} /></span></div>
        <div className="steps-grid"><a href="#brief" className="step-card"><div className="step-top"><span className="step-icon pink"><WandSparkles size={19}/></span><span>01</span></div><h3>Start with an idea <ArrowUpRight size={16}/></h3><p>Tell us your topic, keywords, and who you're writing for.</p><span className="step-action">CREATE YOUR BRIEF <ArrowRight size={13}/></span></a><a href="#editor" className="step-card"><div className="step-top"><span className="step-icon peach"><PenLine size={19}/></span><span>02</span></div><h3>Make it your own <ArrowUpRight size={16}/></h3><p>Review your article and fine-tune the details that matter.</p><span className="step-action">EXPLORE THE EDITOR <ArrowRight size={13}/></span></a><Link to="/diagnostics/shopify" className="step-card"><div className="step-top"><span className="step-icon lavender"><Store size={19}/></span><span>03</span></div><h3>Send to Shopify <ArrowUpRight size={16}/></h3><p>Save a draft to your store, ready for a final review.</p><span className="step-action">CHECK CONNECTION <ArrowRight size={13}/></span></Link></div>
        <div className="work-grid"><section className="panel brief-panel" id="brief"><div className="panel-title"><div><div className="eyebrow muted">LET'S GET STARTED</div><h2>Create your brief <span>✳</span></h2><p>Give your story a little direction.</p></div><span className="panel-icon"><ClipboardList size={20}/></span></div><div className="form-stack"><label>What would you like to write about? <span className="required">*</span><input maxLength={500} value={brief.topic} onChange={e => updateBrief("topic", e.target.value)} placeholder="e.g. The magic of Indian comfort food" /></label><label>Focus keywords <span className="optional">OPTIONAL</span><input maxLength={1000} value={brief.keywords} onChange={e => updateBrief("keywords", e.target.value)} placeholder="e.g. Indian food, ready-to-eat meals" /><small>Separate keywords with commas</small></label><label>Target audience <span className="optional">OPTIONAL</span><input maxLength={500} value={brief.audience} onChange={e => updateBrief("audience", e.target.value)} placeholder="e.g. Curious food lovers" /></label><label>Anything else? <span className="optional">OPTIONAL</span><textarea maxLength={4000} rows={3} value={brief.instructions} onChange={e => updateBrief("instructions", e.target.value)} placeholder="Share a tone, angle, or details to include..." /></label><button className="button button-primary generate-button" onClick={generate} disabled={!!busy || !brief.topic.trim()}>{busy === "generate" ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} {busy === "generate" ? "Writing your article..." : "Generate blog post"} <ArrowRight size={16}/></button><div className="private-note"><CircleHelp size={14}/> Powered by Google AI. Review all generated content before publishing.</div></div></section>
        <section className="panel editor-panel" id="editor"><div className="panel-title"><div><div className="eyebrow muted">YOUR STORY, YOUR WAY</div><h2>Blog editor</h2><p>Review, refine, and get ready to share.</p></div><span className="draft-pill"><span/> DRAFT</span></div><div className="tabs"><button className={tab === "content" ? "selected" : ""} onClick={() => setTab("content")}><FileText size={15}/> Article</button><button className={tab === "seo" ? "selected" : ""} onClick={() => setTab("seo")}><Search size={15}/> SEO details</button></div>{message && <div role="status" className={`notice ${message.kind}`}>{message.kind === "success" ? <Check size={16}/> : <CircleHelp size={16}/>} {message.text}</div>}
        {tab === "content" ? <div className="editor-fields"><label>Article title<input maxLength={255} value={blog.title} onChange={e => updateBlog("title", e.target.value)} placeholder="Your brilliant title goes here" /></label><label>Article content <span className="optional">HTML</span><textarea className="content-area" value={blog.bodyHtml} onChange={e => updateBlog("bodyHtml", e.target.value)} placeholder="Your generated article will appear here. You can also write or paste HTML to get started." /></label><div className="editor-meta"><span><BookOpen size={14}/> {wordCount} words</span><span>Saved in this browser</span></div></div> : <div className="editor-fields seo-fields"><label>SEO title <input maxLength={255} value={blog.metaTitle} onChange={e => updateBlog("metaTitle", e.target.value)} placeholder="Title shown in search results"/><small>{blog.metaTitle.length} characters · Aim for around 60</small></label><label>Meta description<textarea maxLength={500} rows={3} value={blog.metaDescription} onChange={e => updateBlog("metaDescription", e.target.value)} placeholder="A short description for search results"/><small>{blog.metaDescription.length} characters · Aim for around 160</small></label><label>URL handle<input maxLength={255} value={blog.slug} onChange={e => updateBlog("slug", e.target.value)} placeholder="your-blog-post"/><small>Lowercase letters, numbers, and hyphens only</small></label><label>Excerpt<textarea maxLength={2000} rows={3} value={blog.excerpt} onChange={e => updateBlog("excerpt", e.target.value)} placeholder="A short introduction to your article"/></label><label>Keywords & tags<input maxLength={1000} value={blog.keywords} onChange={e => updateBlog("keywords", e.target.value)} placeholder="food, stories, inspiration"/><small>Separate tags with commas</small></label></div>}
        <div className="editor-actions"><button className="button button-outline" disabled={!hasContent || !!busy} onClick={download}><ArrowDownToLine size={16}/> Download HTML</button><button className="button button-dark" disabled={!hasContent || !!busy} onClick={publish}>{busy === "publish" ? <LoaderCircle size={16} className="spin"/> : <Store size={16}/>} {busy === "publish" ? "Creating draft..." : "Save to Shopify"} <ArrowRight size={15}/></button></div><p className="editor-footnote">Shopify posts are saved as drafts, never published automatically.</p></section></div>
        <div className="bottom-note"><div><span className="bottom-note-icon"><Globe2 size={18}/></span><span><strong>Thoughtful content, made simpler.</strong><small>Made for the stories you want to share with the world.</small></span></div><a href="#workspace">Back to top ↑</a></div><footer><span>© Shahi Studio · Made for better stories</span><span>YOUR IDEAS. BEAUTIFULLY TOLD.</span></footer>
      </div>
    </main>
  </div>;
}
