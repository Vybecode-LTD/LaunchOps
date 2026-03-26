import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api";

/* ═══════════════════════════════════════
   DATA & CONSTANTS
   ═══════════════════════════════════════ */

const WORKFLOWS = [
  { id: "competitor", name: "Competitor Deep-Dive", icon: "🔍", color: "#00f0ff", desc: "Analyze a competitor's product, pricing & positioning", tags: ["research"] },
  { id: "trend", name: "Trend Report", icon: "🔍", color: "#00f0ff", desc: "What's happening in your product's space", tags: ["research"] },
  { id: "cold_outreach", name: "Cold Outreach Drafts", icon: "📡", color: "#ff6b35", desc: "Personalized outreach emails", tags: ["outreach", "email"] },
  { id: "partnerships", name: "Partnership Scan", icon: "📡", color: "#ff6b35", desc: "Find collaboration opportunities", tags: ["outreach", "email"] },
  { id: "social_posts", name: "Social Media Posts", icon: "✨", color: "#a855f7", desc: "Platform-specific social content", tags: ["social", "content"] },
  { id: "ad_copy", name: "Ad Copy Variations", icon: "✨", color: "#a855f7", desc: "A/B test-ready ad sets", tags: ["social", "content", "ads"] },
  { id: "blog", name: "Blog Post Draft", icon: "✨", color: "#a855f7", desc: "SEO-aware blog content", tags: ["content", "blog"] },
  { id: "announcement", name: "Product Announcement", icon: "✨", color: "#a855f7", desc: "Launch & update copy", tags: ["content", "social", "email"] },
  { id: "reddit", name: "Reddit Communities", icon: "🎯", color: "#22c55e", desc: "Relevant subreddits with posting rules", tags: ["social", "community"] },
  { id: "directories", name: "Free Directories", icon: "🎯", color: "#22c55e", desc: "Product listing & advertising directories", tags: ["outreach"] },
  { id: "launch_platforms", name: "Launch Platforms", icon: "🎯", color: "#22c55e", desc: "Product Hunt, Hacker News & more", tags: ["outreach", "community"] },
  { id: "podcasts", name: "Podcast Opportunities", icon: "🎯", color: "#22c55e", desc: "Guest spots on relevant podcasts", tags: ["outreach"] },
];

const PLATFORMS = [
  { id: "twitter", name: "Twitter/X", icon: "𝕏", color: "#fff" },
  { id: "instagram", name: "Instagram", icon: "📸", color: "#E4405F" },
  { id: "linkedin", name: "LinkedIn", icon: "in", color: "#0A66C2" },
  { id: "tiktok", name: "TikTok", icon: "♪", color: "#00f2ea" },
  { id: "reddit", name: "Reddit", icon: "⬡", color: "#FF4500" },
  { id: "youtube", name: "YouTube", icon: "▶", color: "#FF0000" },
  { id: "facebook", name: "Facebook", icon: "f", color: "#1877F2" },
  { id: "threads", name: "Threads", icon: "@", color: "#fff" },
];

const LAUNCH_CHECKLIST = [
  { phase: "Pre-Launch", color: "#ffaa00", items: [
    "Brand assets finalized (logo, colors, screenshots)", "Press kit created & reviewed",
    "Landing page / product page live", "Social media profiles set up",
    "Email list / waitlist ready", "Beta testers recruited",
    "Content calendar planned (2 weeks)", "Press & influencer outreach list built",
    "Reddit communities identified", "SEO keywords researched",
    "Product URL live & accessible", "SSL certificate valid",
    "Payment / signup flow tested", "Download links verified",
    "Analytics & UTM tracking installed",
  ]},
  { phase: "Launch Day", color: "#00f0ff", items: [
    "8:00 — Final pre-flight checks", "9:00 — Product Hunt listing live",
    "9:15 — Twitter/X launch thread posted", "9:30 — LinkedIn announcement",
    "9:45 — Reddit posts to target communities", "10:00 — Email blast sent",
    "10:30 — Instagram post + stories", "11:00 — Submit to free directories",
    "12:00 — Engage with early comments", "2:00 — Share social proof / reactions",
    "5:00 — End-of-day check-in post",
  ]},
  { phase: "Post-Launch", color: "#22c55e", items: [
    "Press follow-up emails (day 3)", "Collect & respond to user feedback",
    "Engage with social mentions & comments", "Review analytics & adjust strategy",
    "Week 2 content published", "Gather testimonials & reviews",
    "Launch retrospective — what worked?",
  ]},
];

const copyToClipboard = (text, notify) => {
  navigator.clipboard.writeText(text).then(() => notify("Copied to clipboard ✓", "#22c55e")).catch(() => notify("Copy failed", "#ef4444"));
};

/** Convert workflow content to plain text */
const contentToText = (content) => {
  if (typeof content === "string") return content;
  const lines = [];
  const flatten = (obj, prefix = "") => {
    for (const [key, val] of Object.entries(obj)) {
      const label = key.replace(/_/g, " ").toUpperCase();
      if (typeof val === "string") {
        lines.push(`${prefix}${label}: ${val}`);
      } else if (Array.isArray(val)) {
        lines.push(`\n${prefix}${label}:`);
        val.forEach((item, i) => {
          if (typeof item === "string") lines.push(`  ${i + 1}. ${item}`);
          else if (typeof item === "object" && item !== null) {
            lines.push(`  --- ${item.name || `Item ${i + 1}`} ---`);
            Object.entries(item).forEach(([k, v]) => lines.push(`    ${k.replace(/_/g, " ")}: ${typeof v === "string" ? v : JSON.stringify(v)}`));
          }
        });
      } else if (typeof val === "object" && val !== null) {
        lines.push(`\n${prefix}${label}:`);
        flatten(val, prefix + "  ");
      } else {
        lines.push(`${prefix}${label}: ${val}`);
      }
    }
  };
  flatten(content);
  return lines.join("\n");
};

/** Convert workflow content to markdown */
const contentToMarkdown = (content, title = "Workflow Results") => {
  if (typeof content === "string") return `# ${title}\n\n${content}`;
  const lines = [`# ${title}\n`];
  for (const [key, val] of Object.entries(content)) {
    const heading = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (typeof val === "string") {
      lines.push(`## ${heading}\n\n${val}\n`);
    } else if (Array.isArray(val)) {
      lines.push(`## ${heading}\n`);
      val.forEach((item, i) => {
        if (typeof item === "string") lines.push(`${i + 1}. ${item}`);
        else if (typeof item === "object" && item !== null) {
          lines.push(`\n### ${item.name || `Item ${i + 1}`}\n`);
          Object.entries(item).filter(([k]) => k !== "name").forEach(([k, v]) => {
            lines.push(`- **${k.replace(/_/g, " ")}**: ${typeof v === "string" ? v : JSON.stringify(v)}`);
          });
        }
      });
      lines.push("");
    } else if (typeof val === "object" && val !== null) {
      lines.push(`## ${heading}\n`);
      Object.entries(val).forEach(([k, v]) => lines.push(`- **${k.replace(/_/g, " ")}**: ${typeof v === "string" ? v : JSON.stringify(v)}`));
      lines.push("");
    } else {
      lines.push(`## ${heading}\n\n${val}\n`);
    }
  }
  return lines.join("\n");
};

/** Save text as a downloadable file */
const saveAsFile = (text, filename, mimeType = "text/plain") => {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Get compose URL for a social platform, or null if not supported */
const getComposeUrl = (platform, text, url) => {
  const encoded = encodeURIComponent(text);
  const encodedUrl = url ? encodeURIComponent(url) : "";
  switch ((platform || "").toLowerCase().replace(/[^a-z]/g, "")) {
    case "twitter": case "twitterx": case "x": return `https://twitter.com/intent/tweet?text=${encoded}`;
    case "linkedin": return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl || encoded}`;
    case "reddit": return `https://www.reddit.com/submit?title=${encoded}${encodedUrl ? `&url=${encodedUrl}` : ""}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?quote=${encoded}`;
    default: return null; // TikTok, Instagram, Threads, YouTube — no compose URL
  }
};

/** Lightweight markdown→React renderer (no dependencies) */
const renderMarkdown = (text) => {
  if (!text || typeof text !== "string") return text;
  const lines = text.split("\n");
  const elements = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${elements.length}`} style={{ margin: "6px 0", paddingLeft: "18px" }}>{listItems}</ul>);
      listItems = [];
      inList = false;
    }
  };

  const renderInline = (str) => {
    // Bold, italic, inline code, links, auto-link URLs and emails
    return str
      .replace(/\*\*(.+?)\*\*/g, "⟪b⟫$1⟪/b⟫")
      .replace(/\*(.+?)\*/g, "⟪i⟫$1⟪/i⟫")
      .replace(/`(.+?)`/g, "⟪code⟫$1⟪/code⟫")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "⟪a⟫$1⟪href⟫$2⟪/a⟫")
      .replace(/(?<!\()(https?:\/\/[^\s<>)]+)/g, "⟪a⟫$1⟪href⟫$1⟪/a⟫")
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "⟪a⟫$1⟪href⟫mailto:$1⟪/a⟫")
      .split(/(⟪\/?[a-z]+⟫)/g)
      .reduce((acc, part, i, arr) => {
        if (part === "⟪b⟫") { const end = arr.indexOf("⟪/b⟫", i); if (end > i) { acc.push(<strong key={i}>{arr.slice(i+1, end).join("")}</strong>); arr.splice(i+1, end-i); } }
        else if (part === "⟪i⟫") { const end = arr.indexOf("⟪/i⟫", i); if (end > i) { acc.push(<em key={i}>{arr.slice(i+1, end).join("")}</em>); arr.splice(i+1, end-i); } }
        else if (part === "⟪code⟫") { const end = arr.indexOf("⟪/code⟫", i); if (end > i) { acc.push(<code key={i} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "3px", fontSize: "11px" }}>{arr.slice(i+1, end).join("")}</code>); arr.splice(i+1, end-i); } }
        else if (part === "⟪a⟫") { const hrefIdx = arr.indexOf("⟪href⟫", i); const end = arr.indexOf("⟪/a⟫", i); if (hrefIdx > i && end > hrefIdx) { acc.push(<a key={i} href={arr[hrefIdx+1]} target="_blank" rel="noopener" style={{ color: "#00f0ff", textDecoration: "underline" }}>{arr.slice(i+1, hrefIdx).join("")}</a>); arr.splice(i+1, end-i); } }
        else if (!part.startsWith("⟪")) { acc.push(part); }
        return acc;
      }, []);
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); elements.push(<div key={i} style={{ height: "8px" }} />); return; }

    // Headings
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const sizes = { 1: "16px", 2: "14px", 3: "13px", 4: "12px" };
      elements.push(<div key={i} style={{ fontSize: sizes[level], fontWeight: 700, color: "#e0e0e0", marginTop: "12px", marginBottom: "4px" }}>{renderInline(hMatch[2])}</div>);
      return;
    }

    // List items (- or * or numbered)
    const liMatch = trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (liMatch) {
      inList = true;
      listItems.push(<li key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: "2px" }}>{renderInline(liMatch[1])}</li>);
      return;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) { flushList(); elements.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "10px 0" }} />); return; }

    // Regular paragraph
    flushList();
    elements.push(<div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{renderInline(trimmed)}</div>);
  });

  flushList();
  return elements;
};

/** Build a Claude Code prompt from a queue item's content */
const buildClaudeCodePrompt = (queueItem, workflowName, productName) => {
  const content = queueItem.content || {};
  let prompt = `## ${workflowName} Results for ${productName}\n\n`;
  prompt += `Use the following AI-generated content to take action. Review each section and implement the recommended steps:\n\n`;

  if (typeof content === "string") {
    prompt += content;
  } else if (typeof content === "object") {
    for (const [key, val] of Object.entries(content)) {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      prompt += `### ${label}\n`;
      if (typeof val === "string") {
        prompt += val + "\n\n";
      } else if (Array.isArray(val)) {
        val.forEach((item, i) => {
          prompt += typeof item === "string" ? `${i + 1}. ${item}\n` : `${i + 1}. ${JSON.stringify(item)}\n`;
        });
        prompt += "\n";
      } else {
        prompt += JSON.stringify(val, null, 2) + "\n\n";
      }
    }
  }

  return prompt;
};

/* ═══════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════ */

const Toggle = ({ on, onChange, color = "#00f0ff" }) => (
  <button onClick={() => onChange(!on)} style={{ width: 36, height: 20, borderRadius: 20, border: "none", cursor: "pointer", background: on ? color : "rgba(255,255,255,0.1)", transition: "all 0.25s ease", position: "relative", flexShrink: 0 }}>
    <div style={{ width: 14, height: 14, borderRadius: "50%", background: on ? "#0a0a0f" : "rgba(255,255,255,0.3)", position: "absolute", top: 3, left: on ? 19 : 3, transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)" }} />
  </button>
);

const Badge = ({ children, color }) => <span style={{ padding: "3px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", background: `${color}22`, color, fontFamily: "var(--mono)" }}>{children}</span>;
const SL = ({ children, style = {} }) => <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--mono)", marginBottom: "14px", ...style }}>{children}</div>;
const Card = ({ children, style = {}, onClick }) => <div onClick={onClick} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "20px", cursor: onClick ? "pointer" : "default", transition: "border-color 0.2s, transform 0.2s", ...style }}>{children}</div>;

const Btn = ({ children, onClick, color = "#00f0ff", outline, disabled, small, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? "6px 14px" : "10px 22px", borderRadius: "8px", fontSize: small ? "11px" : "12px", fontWeight: 700,
    cursor: disabled ? "default" : "pointer", fontFamily: "var(--mono)", transition: "all 0.2s ease",
    ...(outline ? { border: `1px solid ${color}44`, background: `${color}11`, color } : { border: "none", background: disabled ? "rgba(255,255,255,0.08)" : color, color: disabled ? "rgba(255,255,255,0.4)" : "#0a0a0f" }), ...style,
  }}>{children}</button>
);

const Inp = ({ label, value, onChange, placeholder, type = "text", mono }) => (
  <div style={{ marginBottom: "14px" }}>
    {label && <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box", fontFamily: mono ? "var(--mono)" : "var(--sans)" }}
      onFocus={e => e.target.style.borderColor = "rgba(0,240,255,0.4)"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
  </div>
);

const TA = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div style={{ marginBottom: "14px" }}>
    {label && <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>{label}</label>}
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box", fontFamily: "var(--mono)", resize: "vertical", lineHeight: 1.6 }} />
  </div>
);

const Sel = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: "14px" }}>
    {label && <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", fontFamily: "var(--mono)", appearance: "none", cursor: "pointer", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: "#15151f" }}>{o.label}</option>)}
    </select>
  </div>
);

const Tags = ({ label, tags, onChange, placeholder }) => {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (t && !tags.includes(t)) { onChange([...tags, t]); setV(""); } };
  return (
    <div style={{ marginBottom: "14px" }}>
      {label && <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>{label}</label>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: tags.length ? "8px" : 0 }}>
        {tags.map((t, i) => <span key={i} style={{ padding: "4px 10px", borderRadius: "5px", fontSize: "11px", fontFamily: "var(--mono)", background: "rgba(0,240,255,0.1)", color: "#00f0ff", display: "flex", alignItems: "center", gap: "6px" }}>{t}<button onClick={() => onChange(tags.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "rgba(0,240,255,0.5)", cursor: "pointer", fontSize: "13px", padding: 0 }}>×</button></span>)}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          style={{ flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#e0e0e0", fontSize: "12px", outline: "none", fontFamily: "var(--mono)" }} />
        <Btn onClick={add} outline small>+</Btn>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════
   QUICK CAPTURE
   ═══════════════════════════════════════ */

const QuickCapture = ({ products, onCapture }) => {
  const [text, setText] = useState("");
  const [pid, setPid] = useState(products[0]?.id || "");
  useEffect(() => { if (products[0]?.id && !pid) setPid(products[0].id); }, [products]);
  const go = async () => {
    if (!text.trim() || !pid) return;
    try {
      await onCapture({ text, product_id: pid });
      setText("");
    } catch (e) { /* parent handles error */ }
  };
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "24px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", alignItems: "center" }}>
      <span style={{ fontSize: "15px" }}>⚡</span>
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && go()}
        placeholder='Quick capture: "Reddit post for DSP targeting Ableton users"'
        style={{ flex: 1, padding: "8px 0", background: "none", border: "none", color: "#e0e0e0", fontSize: "13px", outline: "none", fontFamily: "var(--mono)" }} />
      {products.length > 1 && <select value={pid} onChange={e => setPid(e.target.value)} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#e0e0e0", fontSize: "11px", fontFamily: "var(--mono)", outline: "none" }}>{products.map(p => <option key={p.id} value={p.id} style={{ background: "#15151f" }}>{p.name}</option>)}</select>}
      <Btn onClick={go} disabled={!text.trim()} small>Capture</Btn>
    </div>
  );
};

/* ═══════════════════════════════════════
   DYNAMIC CONTENT CALENDAR
   ═══════════════════════════════════════ */

const Calendar = ({ events, products, onAdd, onRemove }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [newTask, setNewTask] = useState("");
  const [newProduct, setNewProduct] = useState(products[0]?.id || "");
  const [newPlatform, setNewPlatform] = useState("twitter");

  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - today.getDay() + 1);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const todayStr = today.toISOString().split("T")[0];

  const addEvent = async () => {
    if (!newTask.trim() || !selectedDate) return;
    await onAdd({ date: selectedDate, product_id: newProduct, platform: newPlatform, title: newTask });
    setNewTask("");
  };

  const selectedEvents = events.filter(e => {
    const d = typeof e.date === "string" ? e.date : (e.date ? new Date(e.date).toISOString().split("T")[0] : "");
    return d === selectedDate;
  });

  return (
    <div>
      <SL>Content Calendar</SL>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: selectedDate ? "16px" : 0 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", padding: "6px 0" }}>{d}</div>)}
        {days.map((day, i) => {
          const ds = day.toISOString().split("T")[0];
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          const dayEvts = events.filter(e => {
            const d = typeof e.date === "string" ? e.date : (e.date ? new Date(e.date).toISOString().split("T")[0] : "");
            return d === ds;
          });
          return (
            <div key={i} onClick={() => setSelectedDate(isSelected ? null : ds)}
              style={{ background: isSelected ? "rgba(0,240,255,0.08)" : isToday ? "rgba(0,240,255,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${isSelected ? "rgba(0,240,255,0.3)" : isToday ? "rgba(0,240,255,0.12)" : "rgba(255,255,255,0.04)"}`, borderRadius: "8px", padding: "8px", minHeight: "78px", cursor: "pointer", transition: "all 0.15s ease" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: isToday ? "#00f0ff" : "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", marginBottom: "4px" }}>{day.getDate()}</div>
              {dayEvts.map(ev => (
                <div key={ev.id} style={{ padding: "3px 5px", borderRadius: "3px", marginBottom: "3px", background: `${ev.color || "#00f0ff"}15`, borderLeft: `2px solid ${ev.color || "#00f0ff"}`, fontSize: "9px", color: "#e0e0e0", fontFamily: "var(--mono)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
              ))}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <Card style={{ animation: "fadeIn 0.2s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <SL style={{ marginBottom: 0 }}>{new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</SL>
            <button onClick={() => setSelectedDate(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px" }}>×</button>
          </div>

          {selectedEvents.length > 0 ? selectedEvents.map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ev.color || "#00f0ff", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "13px", color: "#e0e0e0", fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", marginTop: "2px" }}>{ev.product_name || "—"} · {ev.platform}</div>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRemove(ev.id); }} style={{ background: "none", border: "none", color: "rgba(239,68,68,0.5)", cursor: "pointer", fontSize: "14px", padding: "4px" }}>×</button>
            </div>
          )) : <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", padding: "12px 0", fontFamily: "var(--mono)" }}>No content scheduled. Add something below.</div>}

          <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addEvent()} placeholder="Task title..."
              style={{ flex: "1 1 200px", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#e0e0e0", fontSize: "12px", fontFamily: "var(--mono)", outline: "none" }} />
            {products.length > 1 && <select value={newProduct} onChange={e => setNewProduct(e.target.value)} style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#e0e0e0", fontSize: "11px", fontFamily: "var(--mono)", outline: "none" }}>
              {products.map(p => <option key={p.id} value={p.id} style={{ background: "#15151f" }}>{p.name}</option>)}
            </select>}
            <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)} style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#e0e0e0", fontSize: "11px", fontFamily: "var(--mono)", outline: "none" }}>
              {[{ id: "all", name: "All" }, ...PLATFORMS].map(p => <option key={p.id} value={p.id} style={{ background: "#15151f" }}>{p.name}</option>)}
            </select>
            <Btn onClick={addEvent} disabled={!newTask.trim()} small>+ Add</Btn>
          </div>
        </Card>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════
   COMMAND CENTER
   ═══════════════════════════════════════ */

const Home = ({ products, captures, templates, calEvents, products_loading, onAddCalEvent, onRemoveCalEvent, onSelect, onCreate, onCapture, onDeleteTemplate, sub, setSub, notify }) => {
  const totalPending = 0; // Will be fetched per-product from queue

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <QuickCapture products={products} onCapture={onCapture} />

      <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
        {[["products", "Projects"], ["calendar", "📅 Calendar"], ["templates", "📄 Templates"]].map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: sub === id ? "rgba(255,255,255,0.08)" : "transparent", color: sub === id ? "#f0f0f0" : "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>
        ))}
      </div>

      {sub === "products" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[{ l: "Projects", v: products.length, c: "#00f0ff" }, { l: "Pending", v: totalPending, c: "#ffaa00" }, { l: "Captures", v: captures.length, c: "#a855f7" }, { l: "Templates", v: templates.length, c: "#22c55e" }].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{s.l}</div>
              <div style={{ fontSize: "26px", fontWeight: 700, color: s.c, fontFamily: "'Space Mono', monospace" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <SL style={{ marginBottom: 0 }}>Your Projects</SL>
          <Btn onClick={onCreate} outline small>+ New Project</Btn>
        </div>

        {products_loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", fontSize: "12px" }}>Loading projects...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px", marginBottom: "28px" }}>
            {products.map(p => {
              const total = LAUNCH_CHECKLIST.reduce((s, ph) => s + ph.items.length, 0);
              const done = Object.values(p.checklist || {}).filter(Boolean).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Card key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: "pointer", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent, ${p.color}, transparent)`, opacity: 0.6 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0f0", fontFamily: "'Space Mono', monospace" }}>{p.name}</div>
                    <Badge color={p.status === "pre_launch" ? "#ffaa00" : "#22c55e"}>{(p.status || "pre_launch").replace("_", "-").toUpperCase()}</Badge>
                  </div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>{p.tagline}</div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", marginBottom: "8px" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, #22c55e, ${p.color})`, borderRadius: "2px", transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", gap: "10px", fontSize: "10px", fontFamily: "var(--mono)" }}>
                    <span style={{ color: "#22c55e" }}>{pct}%</span>
                    {p.press_kit && <span style={{ color: "#a855f7" }}>Press kit ✓</span>}
                  </div>
                </Card>
              );
            })}
            <Card onClick={onCreate} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "110px", borderStyle: "dashed" }}>
              <div style={{ fontSize: "28px", opacity: 0.3 }}>+</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)" }}>Add Project</div>
            </Card>
          </div>
        )}

        {captures.length > 0 && <>
          <SL>Quick Captures</SL>
          {captures.map(c => (
            <Card key={c.id} style={{ marginBottom: "6px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "#e0e0e0" }}>{c.text}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", marginTop: "3px" }}>{products.find(p => p.id === c.product_id)?.name}</div>
              </div>
            </Card>
          ))}
        </>}
      </>}

      {sub === "calendar" && <Calendar events={calEvents} products={products} onAdd={onAddCalEvent} onRemove={onRemoveCalEvent} />}

      {sub === "templates" && <>
        <SL>Template Library</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>Reusable content patterns. Copy and customize, or load directly into a workflow.</div>
        {templates.map(t => (
          <Card key={t.id} style={{ marginBottom: "8px", padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#e0e0e0" }}>{t.name}</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Badge color="#a855f7">{t.type}</Badge>
                {t.source_product && <Badge color="rgba(255,255,255,0.3)">{t.source_product}</Badge>}
                <Btn onClick={() => copyToClipboard(t.content, notify)} outline small color="#22c55e" style={{ padding: "4px 10px", fontSize: "10px" }}>📋 Copy</Btn>
                <Btn onClick={() => onDeleteTemplate(t.id)} outline small color="#ef4444" style={{ padding: "4px 10px", fontSize: "10px" }}>×</Btn>
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.5, background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "10px 12px", maxHeight: "120px", overflow: "auto" }}>{t.content}</div>
          </Card>
        ))}
        {templates.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", fontSize: "12px" }}>No templates yet.</div>}
      </>}
    </div>
  );
};

/* ═══════════════════════════════════════
   PRODUCT DASHBOARD
   ═══════════════════════════════════════ */

const ProductDash = ({ product: p, reloadProduct, onBack, notify, templates = [] }) => {
  const [tab, setTab] = useState("overview");
  const [selWf, setSelWf] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [repInput, setRepInput] = useState("");
  const [repResults, setRepResults] = useState(null);
  const [repLoading, setRepLoading] = useState(false);
  const [pressUrl, setPressUrl] = useState(p.url || "");
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");
  const [prUrl, setPrUrl] = useState(p.url || "");
  const [prResult, setPrResult] = useState(p.press_release || null);
  const [prLoading, setPrLoading] = useState(false);
  const [prContacts, setPrContacts] = useState({ media_contact_name: "", media_contact_email: "", media_contact_phone: "", technical_contact_name: "", technical_contact_email: "", sales_contact_name: "", sales_contact_email: "", additional_notes: "" });
  const [priceResult, setPriceResult] = useState(p.pricing_result || null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [seoUrl, setSeoUrl] = useState(p.url || "");
  const [seoResult, setSeoResult] = useState(p.seo_result || null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoMethod, setSeoMethod] = useState("manual");
  const [queueItems, setQueueItems] = useState([]);
  const [emailItems, setEmailItems] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [wfTemplates, setWfTemplates] = useState([]);
  const [editDirty, setEditDirty] = useState({});
  const [expandedQueue, setExpandedQueue] = useState(null);
  const [availableBrands, setAvailableBrands] = useState([]);
  const pollRef = useRef(null);

  // Load queue items
  const loadQueue = useCallback(async () => {
    try {
      setQueueLoading(true);
      const items = await api.queue.list({ product_id: p.id });
      setQueueItems(items);
    } catch (e) { notify("Failed to load queue: " + e.message, "#ef4444"); }
    finally { setQueueLoading(false); }
  }, [p.id]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { if (tab === "edit") api.brands.list().then(setAvailableBrands).catch(() => {}); }, [tab]);

  // Load email queue
  const loadEmails = useCallback(async () => {
    try {
      setEmailLoading(true);
      const items = await api.emailQueue.list({ product_id: p.id });
      setEmailItems(items);
    } catch (e) { /* email queue may not exist yet */ }
    finally { setEmailLoading(false); }
  }, [p.id]);
  useEffect(() => { if (tab === "emails") loadEmails(); }, [tab, loadEmails]);

  // Poll for running items
  useEffect(() => {
    const hasRunning = queueItems.some(q => q.status === "running");
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(loadQueue, 4000);
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [queueItems, loadQueue]);

  // Load templates for selected workflow
  useEffect(() => {
    if (selWf) {
      api.templates.forWorkflow(selWf.id).then(setWfTemplates).catch(() => setWfTemplates([]));
    } else {
      setWfTemplates([]);
    }
  }, [selWf]);

  const pending = queueItems.filter(q => q.status === "pending").length;
  const totalItems = LAUNCH_CHECKLIST.reduce((s, ph) => s + ph.items.length, 0);
  const done = Object.values(p.checklist || {}).filter(Boolean).length;
  const pct = totalItems > 0 ? Math.round((done / totalItems) * 100) : 0;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "workflows", label: "Workflows" },
    { id: "press_kit", label: "Press Kit" },
    { id: "repurpose", label: "Repurposer" },
    { id: "pricing", label: "Pricing" },
    { id: "seo", label: "🔎 SEO" },
    { id: "checklist", label: "Launch Checklist" },
    { id: "queue", label: `Queue (${pending})`, pulse: pending > 0 },
    { id: "edit", label: "Edit" },
  ];

  // ─── Workflow Launch (API) ───
  const launchWorkflow = async () => {
    if (!selWf) return;
    setLaunching(true);
    try {
      await api.workflows.launch({ product_id: p.id, workflow_id: selWf.id, instructions: taskInput });
      notify(`Launched: ${selWf.name}`, selWf.color);
      setSelWf(null);
      setTaskInput("");
      loadQueue();
      setTab("queue");
    } catch (e) { notify("Launch failed: " + e.message, "#ef4444"); }
    finally { setLaunching(false); }
  };

  // ─── Press Kit (API) ───
  const generatePressKit = async () => {
    if (!pressUrl) return;
    setGenerating(true);
    setGenStep("Analyzing site...");
    try {
      await api.pressKit.generate({ product_id: p.id, url: pressUrl });
      notify("Press kit ready ✓", "#22c55e");
      await reloadProduct();
    } catch (e) { notify("Press kit failed: " + e.message, "#ef4444"); }
    finally { setGenerating(false); setGenStep(""); }
  };

  // ─── Press Release (API) ───
  const generatePressRelease = async () => {
    if (!prUrl) return;
    setPrLoading(true);
    try {
      const result = await api.pressRelease.generate({ product_id: p.id, url: prUrl, ...prContacts });
      setPrResult(result);
      notify("Press release ready ✓", "#22c55e");
    } catch (e) { notify("Press release failed: " + e.message, "#ef4444"); }
    finally { setPrLoading(false); }
  };

  // ─── Repurpose (API) — only enabled platforms ───
  const repurpose = async () => {
    if (!repInput) return;
    setRepLoading(true);
    try {
      const enabledPlatforms = Object.entries(settings?.platforms || {}).filter(([, cfg]) => cfg.connected).map(([id]) => id);
      const platforms = enabledPlatforms.length > 0 ? enabledPlatforms : ["twitter", "instagram", "linkedin"];
      const result = await api.repurpose.create({ product_id: p.id, content: repInput, platforms });
      setRepResults(result.platforms || result.raw_response ? [result] : []);
      notify("Repurposed ✓", "#a855f7");
    } catch (e) { notify("Repurpose failed: " + e.message, "#ef4444"); }
    finally { setRepLoading(false); }
  };

  // ─── Pricing (API) ───
  const analyzePricing = async () => {
    setPriceLoading(true);
    try {
      const result = await api.pricing.analyze({ product_id: p.id });
      setPriceResult(result);
      notify("Pricing analysis ready ✓", "#22c55e");
    } catch (e) { notify("Pricing failed: " + e.message, "#ef4444"); }
    finally { setPriceLoading(false); }
  };

  // ─── SEO (API) ───
  const analyzeSeo = async () => {
    if (!seoUrl) return;
    setSeoLoading(true);
    try {
      const result = await api.seo.analyze({ product_id: p.id, url: seoUrl });
      setSeoResult(result);
      notify("SEO analysis complete ✓", "#22c55e");
    } catch (e) { notify("SEO failed: " + e.message, "#ef4444"); }
    finally { setSeoLoading(false); }
  };

  // ─── Queue actions (API) ───
  const approveItem = async (id) => {
    try {
      await api.queue.update(id, { status: "approved" });
      notify("Approved ✓", "#22c55e");
      loadQueue();
      loadEmails();
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
  };
  const rejectItem = async (id) => {
    try {
      await api.queue.update(id, { status: "rejected" });
      notify("Rejected", "#ef4444");
      loadQueue();
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
  };
  const saveAsTemplate = async (queueItem) => {
    try {
      const content = typeof queueItem.content === "string" ? queueItem.content : JSON.stringify(queueItem.content, null, 2);
      await api.templates.create({
        name: `${queueItem.workflow_id || "workflow"} — ${new Date().toLocaleDateString()}`,
        type: "content",
        content: content,
        tags: [queueItem.workflow_id || "general"],
      });
      notify("Saved as template ✓", "#22c55e");
    } catch (e) { notify("Save failed: " + e.message, "#ef4444"); }
  };

  const deleteQueueItem = async (id) => {
    try {
      await api.queue.delete(id);
      notify("Deleted ✓", "#22c55e");
      loadQueue();
    } catch (e) { notify("Delete failed: " + e.message, "#ef4444"); }
  };

  // ─── Checklist (API) ───
  const toggleChecklist = async (key, checked) => {
    const newChecklist = { ...(p.checklist || {}), [key]: checked };
    try {
      await api.products.updateChecklist(p.id, newChecklist);
      await reloadProduct();
    } catch (e) { notify("Save failed: " + e.message, "#ef4444"); }
  };

  // ─── Edit product (API) ───
  const saveEdit = async (field, value) => {
    try {
      await api.products.update(p.id, { [field]: value });
      await reloadProduct();
    } catch (e) { notify("Save failed: " + e.message, "#ef4444"); }
  };

  const pk = p.press_kit;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--mono)", padding: 0, marginBottom: "8px" }}>← Projects</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: p.color }}>{p.name}</h2>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{p.tagline}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)" }}>LAUNCH</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#22c55e", fontFamily: "'Space Mono', monospace" }}>{pct}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "3px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px", overflowX: "auto" }}>
        {tabs.map(t => <button key={t.id} onClick={() => { setTab(t.id); setSelWf(null); }} style={{ padding: "7px 13px", borderRadius: "6px", border: "none", whiteSpace: "nowrap", background: tab === t.id ? `${p.color}18` : "transparent", color: tab === t.id ? p.color : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)", ...(t.pulse && tab !== t.id ? { animation: "queuePulse 2s ease-in-out infinite", boxShadow: "0 0 8px rgba(255,170,0,0.4)" } : {}) }}>{t.label}</button>)}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
          {[{ l: "Pending", v: pending, c: "#ffaa00" }, { l: "Progress", v: `${pct}%`, c: "#22c55e" }, { l: "Press Kit", v: pk ? "Ready" : "—", c: pk ? "#22c55e" : "rgba(255,255,255,0.25)" }].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>{s.l}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: s.c, fontFamily: "'Space Mono', monospace" }}>{s.v}</div>
            </div>
          ))}
        </div>
        <SL>Quick Actions</SL>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          {[["📦", "Press Kit", "press_kit"], ["📰", "Press Release", "press_release"], ["🔄", "Repurpose", "repurpose"], ["💰", "Pricing", "pricing"], ["🔎", "SEO", "seo"], ["✨", "Workflows", "workflows"], ["🛫", "Checklist", "checklist"], ["📋", "Queue", "queue"], ["📧", "Emails", "emails"], ["✏️", "Edit", "edit"]].map(([icon, label, t], i) => (
            <Card key={i} onClick={() => setTab(t)} style={{ cursor: "pointer", padding: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#e0e0e0" }}>{label}</div>
            </Card>
          ))}
        </div>
      </div>}

      {/* WORKFLOWS */}
      {tab === "workflows" && <div>
        <SL>AI Workflows</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "14px" }}>Select a workflow, add optional instructions, and launch. Results appear in your queue.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {WORKFLOWS.map(wf => (
            <button key={wf.id} onClick={() => setSelWf(selWf?.id === wf.id ? null : wf)} style={{
              padding: "14px 16px", borderRadius: "10px", textAlign: "left", cursor: "pointer", transition: "all 0.15s ease",
              background: selWf?.id === wf.id ? `${wf.color}12` : "rgba(255,255,255,0.03)",
              border: `1px solid ${selWf?.id === wf.id ? `${wf.color}44` : "rgba(255,255,255,0.06)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px" }}>{wf.icon}</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: selWf?.id === wf.id ? wf.color : "#e0e0e0" }}>{wf.name}</span>
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{wf.desc}</div>
            </button>
          ))}
        </div>
        {selWf && <Card style={{ marginTop: "14px" }}>
          {wfTemplates.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--mono)", marginBottom: "8px" }}>📄 Templates for this workflow</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                {wfTemplates.map(tmpl => (
                  <div key={tmpl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)", borderRadius: "6px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#e0e0e0" }}>{tmpl.name}</div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", marginTop: "2px" }}>{tmpl.source_product}</div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <Btn onClick={() => setTaskInput(tmpl.content)} outline small color="#a855f7" style={{ padding: "4px 10px", fontSize: "9px" }}>Load</Btn>
                      <Btn onClick={() => copyToClipboard(tmpl.content, notify)} outline small color="#22c55e" style={{ padding: "4px 10px", fontSize: "9px" }}>📋</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <TA label="Instructions (optional)" value={taskInput} onChange={setTaskInput} placeholder="Add context or load a template above..." rows={2} />
          <Btn onClick={launchWorkflow} disabled={launching} color={selWf.color}>
            {launching ? "⏳ Launching..." : `Launch: ${selWf.name}`}
          </Btn>
        </Card>}
      </div>}

      {/* PRESS KIT */}
      {tab === "press_kit" && <div>
        {!pk && !generating && <Card style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.6 }}>📦</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0", marginBottom: "16px" }}>Generate Press Kit from URL</div>
          <div style={{ display: "flex", gap: "8px", maxWidth: "460px", margin: "0 auto" }}>
            <input value={pressUrl} onChange={e => setPressUrl(e.target.value)} placeholder="https://..." style={{ flex: 1, padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", fontFamily: "var(--mono)", outline: "none" }} />
            <Btn onClick={generatePressKit} disabled={!pressUrl || generating}>Generate</Btn>
          </div>
        </Card>}
        {generating && <Card style={{ textAlign: "center", padding: "50px" }}><div style={{ fontSize: "28px", marginBottom: "14px", animation: "pulse 1.5s infinite" }}>🔄</div><div style={{ fontSize: "13px", color: "#00f0ff", fontFamily: "var(--mono)" }}>{genStep}</div></Card>}
        {pk && !generating && <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><Badge color="#22c55e">READY</Badge><Btn onClick={async () => { await saveEdit("press_kit", null); }} color="#ef4444" outline small>Regenerate</Btn></div>
          <Card><SL>Boilerplate</SL><p style={{ margin: 0, fontSize: "13px", color: "#e0e0e0", lineHeight: 1.7 }}>{pk.boilerplate}</p></Card>
          <Card><SL>Key Features</SL>{(pk.key_features || pk.features || []).map((f, i) => <div key={i} style={{ padding: "5px 0", fontSize: "12px", color: "#e0e0e0" }}>• {f}</div>)}</Card>
          {pk.target_audience && <Card><SL>Target Audience</SL><p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{pk.target_audience}</p></Card>}
          <Card><SL>Media Assets</SL>{(pk.media_assets || pk.assets || []).map((a, i) => <div key={i} style={{ padding: "5px 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>☐ {a}</div>)}</Card>
        </div>}
      </div>}

      {/* PRESS RELEASE */}
      {tab === "press_release" && <div>
        <SL>Press Release Builder</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>Generate a publication-ready press release from your website. URL analysis required.</div>
        {!prResult && !prLoading ? <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Card>
            <Inp label="Website URL (required)" value={prUrl} onChange={setPrUrl} placeholder="https://vybecod.ing" mono />
          </Card>
          <Card>
            <SL>Media Contact</SL>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Inp label="Name" value={prContacts.media_contact_name} onChange={v => setPrContacts(c => ({ ...c, media_contact_name: v }))} placeholder="Jane Smith" />
              <Inp label="Email" value={prContacts.media_contact_email} onChange={v => setPrContacts(c => ({ ...c, media_contact_email: v }))} placeholder="press@company.com" mono />
            </div>
            <Inp label="Phone" value={prContacts.media_contact_phone} onChange={v => setPrContacts(c => ({ ...c, media_contact_phone: v }))} placeholder="+1 (555) 123-4567" mono />
          </Card>
          <Card>
            <SL>Technical Contact</SL>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Inp label="Name" value={prContacts.technical_contact_name} onChange={v => setPrContacts(c => ({ ...c, technical_contact_name: v }))} placeholder="John Doe" />
              <Inp label="Email" value={prContacts.technical_contact_email} onChange={v => setPrContacts(c => ({ ...c, technical_contact_email: v }))} placeholder="tech@company.com" mono />
            </div>
          </Card>
          <Card>
            <SL>Sales Contact</SL>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Inp label="Name" value={prContacts.sales_contact_name} onChange={v => setPrContacts(c => ({ ...c, sales_contact_name: v }))} placeholder="Sales Team" />
              <Inp label="Email" value={prContacts.sales_contact_email} onChange={v => setPrContacts(c => ({ ...c, sales_contact_email: v }))} placeholder="sales@company.com" mono />
            </div>
          </Card>
          <Card>
            <TA label="Additional Notes (optional)" value={prContacts.additional_notes} onChange={v => setPrContacts(c => ({ ...c, additional_notes: v }))} placeholder="Any specific angle, news hook, or details to include..." rows={3} />
          </Card>
          <Btn onClick={generatePressRelease} disabled={!prUrl || prLoading}>Generate Press Release</Btn>
        </div>
        : prLoading ? <Card style={{ textAlign: "center", padding: "50px" }}><div style={{ fontSize: "28px", marginBottom: "14px", animation: "pulse 1.5s infinite" }}>📰</div><div style={{ fontSize: "13px", color: "#00f0ff", fontFamily: "var(--mono)" }}>Analyzing site & writing press release...</div></Card>
        : prResult && <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Badge color="#22c55e">READY</Badge>
            <div style={{ display: "flex", gap: "6px" }}>
              <Btn onClick={() => copyToClipboard(prResult.body || JSON.stringify(prResult, null, 2), notify)} color="#a855f7" outline small>Copy Full Text</Btn>
              <Btn onClick={() => setPrResult(null)} color="#ef4444" outline small>Regenerate</Btn>
            </div>
          </div>
          {prResult.headline && <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#e0e0e0", lineHeight: 1.4, marginBottom: "6px" }}>{prResult.headline}</div>
                {prResult.subheadline && <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>{prResult.subheadline}</div>}
              </div>
              <Btn onClick={() => copyToClipboard(`${prResult.headline}${prResult.subheadline ? "\n" + prResult.subheadline : ""}`, notify)} outline small color="#a855f7" style={{ flexShrink: 0 }}>📋</Btn>
            </div>
          </Card>}
          {prResult.body && <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0 }}>Full Press Release</SL>
              <Btn onClick={() => copyToClipboard(prResult.body, notify)} outline small color="#a855f7">📋 Copy</Btn>
            </div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>{renderMarkdown(prResult.body)}</div>
          </Card>}
          {prResult.summary && <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0 }}>Distribution Summary</SL>
              <Btn onClick={() => copyToClipboard(prResult.summary, notify)} outline small color="#a855f7">📋 Copy</Btn>
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{prResult.summary}</div>
          </Card>}
          {prResult.suggested_distribution && <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0 }}>Suggested Distribution Channels</SL>
              <Btn onClick={() => copyToClipboard(prResult.suggested_distribution.map(ch => typeof ch === "string" ? ch : `${ch.name}${ch.url ? " — " + ch.url : ""}${ch.contact_email ? " — " + ch.contact_email : ""}`).join("\n"), notify)} outline small color="#a855f7">📋 Copy All</Btn>
            </div>
            {prResult.suggested_distribution.map((ch, i) => {
              if (typeof ch === "string") return <div key={i} style={{ padding: "4px 0", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>• {ch}</div>;
              return <div key={i} style={{ padding: "10px 12px", marginBottom: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>{ch.name || "Unknown"}</span>
                  {ch.type && <Badge color={ch.type === "wire_service" ? "#00f0ff" : ch.type === "journalist" ? "#a855f7" : ch.type === "tech_blog" ? "#22c55e" : "#ff6b35"}>{ch.type.replace(/_/g, " ")}</Badge>}
                </div>
                {ch.notes && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "6px", lineHeight: 1.4 }}>{ch.notes}</div>}
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {ch.url && <a href={ch.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#00f0ff", textDecoration: "none", fontFamily: "var(--mono)" }}>Website ↗</a>}
                  {ch.submission_url && <a href={ch.submission_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#22c55e", textDecoration: "none", fontFamily: "var(--mono)" }}>Submit ↗</a>}
                  {ch.contact_email && <a href={"mailto:" + ch.contact_email} style={{ fontSize: "11px", color: "#ff6b35", textDecoration: "none", fontFamily: "var(--mono)" }}>{ch.contact_email}</a>}
                </div>
              </div>;
            })}
          </Card>}
          {prResult.seo_keywords && <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0 }}>SEO Keywords</SL>
              <Btn onClick={() => copyToClipboard(prResult.seo_keywords.join(", "), notify)} outline small color="#a855f7">📋 Copy</Btn>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{prResult.seo_keywords.map((kw, i) => <Badge key={i} color="#00f0ff">{kw}</Badge>)}</div>
          </Card>}
        </div>}
      </div>}

      {/* REPURPOSER */}
      {tab === "repurpose" && <div>
        <SL>Cross-Platform Repurposer</SL>
        {!repResults ? <Card>
          <TA label="Write your content once" value={repInput} onChange={setRepInput} placeholder="Paste any announcement, update, or idea..." rows={4} />
          <Btn onClick={repurpose} disabled={!repInput || repLoading}>{repLoading ? "⏳ Repurposing..." : "Repurpose for Enabled Platforms"}</Btn>
        </Card> : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Btn onClick={() => setRepResults(null)} color="#ef4444" outline small style={{ alignSelf: "flex-end" }}>Start Over</Btn>
          {(repResults[0]?.platforms || repResults).map((r, i) => {
            const fullText = r.content + (r.hashtags ? "\n" + (Array.isArray(r.hashtags) ? r.hashtags.join(" ") : r.hashtags) : "");
            const composeUrl = getComposeUrl(r.platform, fullText, p.url);
            const platInfo = PLATFORMS.find(pl => pl.id === (r.platform || "").toLowerCase().replace(/[^a-z]/g, ""));
            return <Card key={i} style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: platInfo?.color || "#e0e0e0" }}>{platInfo?.icon || "📱"} {r.platform}</span>
                {r.character_count && <Badge color="rgba(255,255,255,0.3)">{r.character_count} chars</Badge>}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.content}</div>
              {r.hashtags && <div style={{ fontSize: "10px", color: "rgba(0,240,255,0.5)", fontFamily: "var(--mono)", marginTop: "6px" }}>{Array.isArray(r.hashtags) ? r.hashtags.join(" ") : r.hashtags}</div>}
              <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                <button onClick={() => copyToClipboard(fullText, notify)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", fontSize: "10px", fontFamily: "var(--mono)", padding: "4px 10px", cursor: "pointer" }}>📋 Copy</button>
                {composeUrl && <a href={composeUrl} target="_blank" rel="noopener noreferrer" style={{ background: `${platInfo?.color || "#fff"}18`, border: `1px solid ${platInfo?.color || "#fff"}33`, borderRadius: "6px", color: platInfo?.color || "#fff", fontSize: "10px", fontFamily: "var(--mono)", padding: "4px 10px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>Open in {r.platform} ↗</a>}
                {!composeUrl && <button onClick={() => { copyToClipboard(fullText, notify); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", fontSize: "10px", fontFamily: "var(--mono)", padding: "4px 10px", cursor: "pointer" }}>📋 Copy & post manually</button>}
              </div>
            </Card>;
          })}
        </div>}
      </div>}

      {/* PRICING */}
      {tab === "pricing" && <div>
        <SL>Pricing Strategy Advisor</SL>
        {!priceResult ? <Card>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "14px" }}>AI analyzes competitors, market positioning, and your product to suggest pricing tiers.</div>
          <Btn onClick={analyzePricing} disabled={priceLoading}>{priceLoading ? "⏳ Analyzing..." : "Analyze & Suggest Pricing"}</Btn>
        </Card> : <div>
          <Btn onClick={() => setPriceResult(null)} color="#ef4444" outline small style={{ marginBottom: "12px" }}>Re-analyze</Btn>
          {priceResult.tiers && <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(priceResult.tiers.length, 3)}, 1fr)`, gap: "10px", marginBottom: "12px" }}>
            {priceResult.tiers.map((t, i) => <Card key={i} style={{ textAlign: "center", border: t.recommended ? `1px solid ${p.color}44` : undefined, background: t.recommended ? `${p.color}06` : undefined, padding: "18px" }}>
              {t.recommended && <Badge color={p.color}>RECOMMENDED</Badge>}
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0f0", fontFamily: "'Space Mono', monospace", margin: "10px 0 4px" }}>{t.name}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: p.color, fontFamily: "'Space Mono', monospace", marginBottom: "10px" }}>{t.price}</div>
              {(t.features || []).map((f, j) => <div key={j} style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", padding: "3px 0" }}>✓ {f}</div>)}
            </Card>)}
          </div>}
          {priceResult.insights && <Card><SL>Market Insights</SL>{priceResult.insights.map((ins, i) => <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>→ {ins}</div>)}</Card>}
        </div>}
      </div>}

      {/* SEO OPTIMIZER */}
      {tab === "seo" && <div>
        <SL>SEO Optimizer</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>Analyze your site's metadata and get optimized tags, descriptions, and structured data — ready to deploy.</div>
        {!seoResult && !seoLoading ? <Card>
          <Inp label="Product URL to analyze" value={seoUrl} onChange={setSeoUrl} placeholder="https://vybecod.ing/dsp" mono />
          <Btn onClick={analyzeSeo} disabled={!seoUrl || seoLoading}>Analyze & Optimize</Btn>
        </Card> : seoLoading ? <Card style={{ textAlign: "center", padding: "50px" }}><div style={{ fontSize: "28px", marginBottom: "14px", animation: "pulse 1.5s infinite" }}>🔎</div><div style={{ fontSize: "13px", color: "#00f0ff", fontFamily: "var(--mono)" }}>Analyzing metadata...</div></Card> : seoResult && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Score comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", marginBottom: "6px" }}>CURRENT SCORE</div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#ef4444", fontFamily: "'Space Mono', monospace" }}>{seoResult.current_score || seoResult.current?.score || "?"}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>/ 100</div>
            </Card>
            <Card style={{ textAlign: "center", background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.15)" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", marginBottom: "6px" }}>OPTIMIZED SCORE</div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#22c55e", fontFamily: "'Space Mono', monospace" }}>{seoResult.optimized_score || seoResult.optimized?.score || "?"}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>/ 100</div>
            </Card>
          </div>

          {/* Issues found */}
          {seoResult.issues && <Card>
            <SL>Issues Found ({seoResult.issues.length})</SL>
            {seoResult.issues.map((issue, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                <span style={{ color: "#ef4444", fontSize: "12px" }}>✗</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{issue}</span>
              </div>
            ))}
          </Card>}

          {/* Optimized metadata */}
          {seoResult.optimized && <Card>
            <SL>Optimized Metadata</SL>
            {Object.entries(seoResult.optimized).filter(([k]) => k !== "score").map(([key, value], i) => (
              <div key={i} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)" }}>{key.replace(/_/g, " ").toUpperCase()}</span>
                  <button onClick={() => copyToClipboard(typeof value === "string" ? value : JSON.stringify(value), notify)} style={{ background: "none", border: "none", color: "rgba(0,240,255,0.5)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--mono)" }}>📋 copy</button>
                </div>
                <div style={{ fontSize: "12px", color: "#e0e0e0", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: "6px", fontFamily: "var(--mono)", lineHeight: 1.5, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</div>
              </div>
            ))}
          </Card>}

          {/* Head block */}
          {seoResult.head_block && <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0 }}>Full Head Block</SL>
              <Btn onClick={() => copyToClipboard(seoResult.head_block, notify)} color="#22c55e" small>📋 Copy</Btn>
            </div>
            <div style={{ fontSize: "10px", color: "#00f0ff", padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.7, maxHeight: "250px", overflow: "auto" }}>{seoResult.head_block}</div>
          </Card>}

          {/* Export for AI Assistant */}
          <Card style={{ background: "rgba(168,85,247,0.04)", borderColor: "rgba(168,85,247,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0, color: "#a855f7" }}>Export for AI Assistant</SL>
              <Btn onClick={() => {
                const opt = seoResult.optimized || {};
                const issues = seoResult.issues || [];
                const prompt = [
                  `Update the SEO metadata for ${seoUrl}. Here are the specific changes to make:`,
                  ``,
                  `## Issues to Fix`,
                  ...issues.map((issue, i) => `${i + 1}. ${issue}`),
                  ``,
                  `## Optimized Metadata`,
                  opt.title ? `- **Title tag**: \`${opt.title}\`` : null,
                  opt.description ? `- **Meta description**: \`${opt.description}\`` : null,
                  opt.og_title ? `- **OG Title**: \`${opt.og_title}\`` : null,
                  opt.og_description ? `- **OG Description**: \`${opt.og_description}\`` : null,
                  opt.og_image ? `- **OG Image**: \`${opt.og_image}\`` : null,
                  opt.canonical ? `- **Canonical URL**: \`${opt.canonical}\`` : null,
                  opt.keywords ? `- **Keywords**: \`${opt.keywords}\`` : null,
                  opt.twitter_card ? `- **Twitter Card**: \`${typeof opt.twitter_card === "string" ? opt.twitter_card : JSON.stringify(opt.twitter_card)}\`` : null,
                  opt.robots ? `- **Robots**: \`${opt.robots}\`` : null,
                  ``,
                  opt.json_ld ? `## JSON-LD Structured Data\nAdd this to the page's \`<head>\`:\n\`\`\`html\n<script type="application/ld+json">\n${typeof opt.json_ld === "string" ? opt.json_ld : JSON.stringify(opt.json_ld, null, 2)}\n</script>\n\`\`\`` : null,
                  ``,
                  seoResult.head_block ? `## Full Head Block\nReplace the existing meta tags in \`<head>\` with:\n\`\`\`html\n${seoResult.head_block}\n\`\`\`` : null,
                  ``,
                  `Find the HTML file(s) for this page and apply all the changes above. Preserve any existing tags not covered by these changes.`,
                ].filter(Boolean).join("\n");
                copyToClipboard(prompt, notify);
              }} color="#a855f7" small>Copy Prompt</Btn>
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
              Generates a ready-to-paste prompt with all SEO changes. Open your AI coding assistant in your project directory and paste it — it will find the right files and apply every change automatically.
            </div>
          </Card>

          <Btn onClick={() => setSeoResult(null)} color="#ef4444" outline small style={{ alignSelf: "flex-end" }}>Re-analyze</Btn>
        </div>}
      </div>}

      {/* LAUNCH CHECKLIST */}
      {tab === "checklist" && <div>
        <SL>Launch Checklist</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>{done}/{totalItems} complete · {pct}% ready</div>
        {LAUNCH_CHECKLIST.map(phase => {
          const customItems = (p.checklist?.[`_custom_${phase.phase}`] || []);
          const allItems = [...phase.items, ...customItems];
          const phaseDone = allItems.filter((_, i) => p.checklist?.[`${phase.phase}_${i}`]).length;
          return <div key={phase.phase} style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: phase.color }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: phase.color, fontFamily: "'Space Mono', monospace" }}>{phase.phase}</span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)" }}>{phaseDone}/{allItems.length}</span>
            </div>
            <div style={{ marginLeft: "16px", borderLeft: `2px solid ${phase.color}22`, paddingLeft: "14px" }}>
              {allItems.map((item, i) => {
                const key = `${phase.phase}_${i}`;
                const isCustom = i >= phase.items.length;
                return <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "6px 0" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" checked={!!p.checklist?.[key]} onChange={e => toggleChecklist(key, e.target.checked)} style={{ accentColor: phase.color, width: "15px", height: "15px", marginTop: "1px", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: p.checklist?.[key] ? "rgba(255,255,255,0.3)" : "#e0e0e0", textDecoration: p.checklist?.[key] ? "line-through" : "none", lineHeight: 1.5 }}>{item}</span>
                  </label>
                  {isCustom && <button onClick={async () => {
                    const idx = i - phase.items.length;
                    const newCustom = customItems.filter((_, ci) => ci !== idx);
                    const newChecklist = { ...(p.checklist || {}), [`_custom_${phase.phase}`]: newCustom };
                    await api.products.updateChecklist(p.id, newChecklist);
                    await reloadProduct();
                  }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "12px", flexShrink: 0 }}>✕</button>}
                </div>;
              })}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const input = e.target.elements.newItem;
                const val = input.value.trim();
                if (!val) return;
                const newCustom = [...customItems, val];
                const newChecklist = { ...(p.checklist || {}), [`_custom_${phase.phase}`]: newCustom };
                await api.products.updateChecklist(p.id, newChecklist);
                await reloadProduct();
                input.value = "";
              }} style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                <input name="newItem" placeholder="Add custom item..." style={{ flex: 1, padding: "6px 10px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "#e0e0e0", fontSize: "11px", outline: "none", fontFamily: "var(--mono)" }} />
                <button type="submit" style={{ background: `${phase.color}22`, border: `1px solid ${phase.color}33`, borderRadius: "6px", color: phase.color, fontSize: "10px", padding: "4px 10px", cursor: "pointer", fontFamily: "var(--mono)" }}>+ Add</button>
              </form>
            </div>
          </div>;
        })}
      </div>}

      {/* QUEUE */}
      {tab === "queue" && <div>
        <SL>Approval Queue</SL>
        {queueLoading && queueItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", fontSize: "12px" }}>Loading...</div>
        ) : queueItems.length > 0 ? queueItems.map(q => {
          const wf = WORKFLOWS.find(w => w.id === q.workflow_id);
          const isExpanded = expandedQueue === q.id;
          const content = q.content || {};
          const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);
          const hasContent = contentStr && contentStr !== "{}" && contentStr !== "null";
          return <Card key={q.id} style={{ marginBottom: "8px", padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", cursor: hasContent ? "pointer" : "default" }} onClick={() => hasContent && setExpandedQueue(isExpanded ? null : q.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span>{wf?.icon || "📋"}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#e0e0e0" }}>{wf?.name || q.workflow_id}</span>
                  <Badge color={q.status === "pending" ? "#ffaa00" : q.status === "approved" ? "#22c55e" : q.status === "running" ? "#00f0ff" : "#ef4444"}>{q.status.toUpperCase()}</Badge>
                  {hasContent && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{isExpanded ? "▼" : "▶"} view</span>}
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{q.preview}</div>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {q.status === "pending" && <>
                  <Btn onClick={(e) => { e.stopPropagation(); approveItem(q.id); }} color="#22c55e" outline small>✓</Btn>
                  <Btn onClick={(e) => { e.stopPropagation(); rejectItem(q.id); }} color="#ef4444" outline small>✗</Btn>
                </>}
                {q.status === "running" && <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "#00f0ff", fontFamily: "var(--mono)" }}><span style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid #00f0ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><span style={{ animation: "pulse 1.5s infinite" }}>Working...</span></div>}
                {hasContent && <>
                  <Btn onClick={(e) => { e.stopPropagation(); copyToClipboard(contentStr, notify); }} outline small color="#a855f7" style={{ padding: "4px 10px", fontSize: "9px" }}>📋</Btn>
                  <Btn onClick={(e) => { e.stopPropagation(); saveAsTemplate(q); }} outline small color="#00f0ff" style={{ padding: "4px 10px", fontSize: "9px" }}>💾</Btn>
                </>}
                {q.status !== "running" && <Btn onClick={(e) => { e.stopPropagation(); if (confirm("Delete this queue item?")) deleteQueueItem(q.id); }} outline small color="#ef4444" style={{ padding: "4px 10px", fontSize: "9px" }}>🗑</Btn>}
              </div>
            </div>
            {isExpanded && hasContent && <div style={{ marginTop: "12px" }}>
              <div style={{ padding: "18px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", maxHeight: "500px", overflow: "auto" }}>
                {typeof content === "object" && !Array.isArray(content) ? Object.entries(content).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0)).map(([key, val], secIdx) => (
                  <div key={key} style={{ marginBottom: "20px", paddingBottom: secIdx < Object.keys(content).length - 1 ? "16px" : 0, borderBottom: secIdx < Object.keys(content).length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: p.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "3px", height: "14px", background: p.color, borderRadius: "2px", display: "inline-block" }} />
                      {key.replace(/_/g, " ")}
                      {Array.isArray(val) && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>({val.length})</span>}
                    </div>
                    <div style={{ lineHeight: 1.7, paddingLeft: "11px" }}>{typeof val === "string" ? <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)" }}>{renderMarkdown(val)}</div> : Array.isArray(val) ? val.map((item, i) => (
                      <div key={i} style={{ marginBottom: "10px" }}>{typeof item === "string" ? <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", padding: "4px 0", display: "flex", gap: "8px" }}><span style={{ color: p.color, flexShrink: 0 }}>•</span><span>{renderMarkdown(item)}</span></div> : typeof item === "object" && item !== null ? (
                        <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                          {item.name && <div style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0", marginBottom: "10px" }}>{renderMarkdown(item.name)}</div>}
                          {Object.entries(item).filter(([ik]) => ik !== "name").map(([ik, iv]) => (
                            <div key={ik} style={{ marginBottom: "8px" }}>
                              <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>{ik.replace(/_/g, " ")}</div>
                              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{
                                ik === "threat_level" ? <span style={{ fontWeight: 700, color: iv >= 7 ? "#ef4444" : iv >= 4 ? "#ffaa00" : "#22c55e" }}>{iv ?? "?"}/10</span>
                                : ik === "url" && typeof iv === "string" && iv.startsWith("http") ? <a href={iv} target="_blank" rel="noopener noreferrer" style={{ color: "#00f0ff", textDecoration: "none" }}>{iv} ↗</a>
                                : typeof iv === "string" ? renderMarkdown(iv) : Array.isArray(iv) ? iv.join(", ") : String(iv ?? "N/A")
                              }</div>
                            </div>
                          ))}
                        </div>
                      ) : <span style={{ fontSize: "13px" }}>{String(item)}</span>}</div>
                    )) : typeof val === "object" && val !== null ? (
                      <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                        {Object.entries(val).map(([vk, vv]) => (
                          <div key={vk} style={{ marginBottom: "8px" }}>
                            <div style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>{vk.replace(/_/g, " ")}</div>
                            <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{typeof vv === "string" ? renderMarkdown(vv) : String(vv)}</div>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", whiteSpace: "pre-wrap" }}>{JSON.stringify(val, null, 2)}</div>}</div>
                  </div>
                )) : <div style={{ lineHeight: 1.7, fontSize: "14px" }}>{renderMarkdown(contentStr)}</div>}
              </div>
              {/* Export options */}
              <div style={{ display: "flex", gap: "6px", marginTop: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button onClick={(e) => { e.stopPropagation(); copyToClipboard(contentToText(content), notify); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", fontSize: "10px", fontFamily: "var(--mono)", padding: "5px 12px", cursor: "pointer" }}>Copy TXT</button>
                <button onClick={(e) => { e.stopPropagation(); copyToClipboard(contentToMarkdown(content, wf?.name || q.workflow_id), notify); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", fontSize: "10px", fontFamily: "var(--mono)", padding: "5px 12px", cursor: "pointer" }}>Copy MD</button>
                <button onClick={(e) => { e.stopPropagation(); saveAsFile(contentToText(content), `${q.workflow_id}.txt`, "text/plain"); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", fontSize: "10px", fontFamily: "var(--mono)", padding: "5px 12px", cursor: "pointer" }}>Save TXT</button>
                <button onClick={(e) => { e.stopPropagation(); saveAsFile(contentToMarkdown(content, wf?.name || q.workflow_id), `${q.workflow_id}.md`, "text/markdown"); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", fontSize: "10px", fontFamily: "var(--mono)", padding: "5px 12px", cursor: "pointer" }}>Save MD</button>
              </div>
            </div>}
          </Card>;
        }) : <div style={{ textAlign: "center", padding: "50px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", fontSize: "12px" }}>Queue empty. Launch a workflow to populate it.</div>}
      </div>}

      {/* EMAIL ACTIONS */}
      {tab === "emails" && <div>
        <SL>Email Actions</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>Contacts extracted from approved workflows. Emails auto-send when SMTP is configured, or send manually below.</div>
        {emailLoading ? <div style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>Loading...</div>
        : emailItems.length > 0 ? <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <Badge color="#22c55e">Sent: {emailItems.filter(e => e.status === "sent").length}</Badge>
            <Badge color="#ffaa00">Pending: {emailItems.filter(e => e.status === "pending").length}</Badge>
            <Badge color="#ef4444">Failed: {emailItems.filter(e => e.status === "failed").length}</Badge>
          </div>
          {emailItems.map(em => (
            <Card key={em.id} style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>{em.recipient_name || em.recipient_email}</span>
                    <Badge color={em.status === "sent" ? "#22c55e" : em.status === "pending" ? "#ffaa00" : "#ef4444"}>{em.status.toUpperCase()}</Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)" }}>{em.recipient_email}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>Subject: {em.subject}</div>
                  {em.error && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{em.error}</div>}
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {em.status !== "sent" && <Btn onClick={async () => {
                    try {
                      await api.emailQueue.send(em.id);
                      notify("Sent ✓", "#22c55e");
                      loadEmails();
                    } catch (e) { notify("Send failed: " + e.message, "#ef4444"); }
                  }} color="#22c55e" small outline>Send</Btn>}
                  <Btn onClick={async () => {
                    try {
                      await api.emailQueue.delete(em.id);
                      setEmailItems(items => items.filter(x => x.id !== em.id));
                    } catch (e) { notify("Delete failed: " + e.message, "#ef4444"); }
                  }} color="#ef4444" small outline>✗</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
        : <div style={{ textAlign: "center", padding: "50px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", fontSize: "12px" }}>
          No emails yet. Approve workflow items (cold outreach, partnerships, announcements) to extract contacts automatically.
        </div>}
      </div>}

      {/* EDIT */}
      {tab === "edit" && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Card>
          <SL>Project Details</SL>
          <Inp label="Name" value={editDirty.name ?? p.name} onChange={v => setEditDirty(d => ({ ...d, name: v }))} />
          <Inp label="Tagline" value={editDirty.tagline ?? p.tagline} onChange={v => setEditDirty(d => ({ ...d, tagline: v }))} />
          <Inp label="URL" value={editDirty.url ?? (p.url || "")} onChange={v => setEditDirty(d => ({ ...d, url: v }))} mono />
          <TA label="Description (context for AI)" value={editDirty.description ?? (p.description || "")} onChange={v => setEditDirty(d => ({ ...d, description: v }))} placeholder="What does this product do?" />
          <Tags label="Keywords" tags={editDirty.keywords ?? (p.keywords || [])} onChange={v => setEditDirty(d => ({ ...d, keywords: v }))} placeholder="keyword..." />
          <Sel label="Color" value={editDirty.color ?? p.color} onChange={v => setEditDirty(d => ({ ...d, color: v }))} options={[{ value: "#00f0ff", label: "Cyan" }, { value: "#a855f7", label: "Purple" }, { value: "#ff6b35", label: "Orange" }, { value: "#22c55e", label: "Green" }, { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" }]} />
        </Card>

        {/* Brand Assignment */}
        <Card style={{ borderColor: "rgba(0,240,255,0.15)" }}>
          <SL style={{ color: "#00f0ff" }}>Brand / Company</SL>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "14px" }}>Assign a brand to this project. Brand info is used in press releases, press kits, and all AI workflows. Manage brands in Settings → Brands.</div>
          <Sel label="Assigned Brand" value={editDirty.brand_id ?? (p.brand_id || "")} onChange={v => setEditDirty(d => ({ ...d, brand_id: v || null }))} options={[{ value: "", label: "— No brand (use details below) —" }, ...availableBrands.map(b => ({ value: b.id, label: b.name + (b.industry ? ` (${b.industry})` : "") }))]} />
          {!(editDirty.brand_id ?? p.brand_id) && <div style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>No brand assigned. You can enter company details below as a fallback, or create a brand in Settings → Brands.</div>}
          {(() => {
            const cd = editDirty.company_details ?? p.company_details ?? {};
            const upCo = (field, val) => setEditDirty(d => ({ ...d, company_details: { ...(d.company_details ?? p.company_details ?? {}), [field]: val } }));
            return <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Company Name" value={cd.company_name || ""} onChange={v => upCo("company_name", v)} placeholder="Acme Corp" />
                <Inp label="Industry" value={cd.industry || ""} onChange={v => upCo("industry", v)} placeholder="Music Technology" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Location (City, State/Country)" value={cd.location || ""} onChange={v => upCo("location", v)} placeholder="Los Angeles, CA" />
                <Inp label="Founded Year" value={cd.founded || ""} onChange={v => upCo("founded", v)} placeholder="2024" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Founder / CEO Name" value={cd.founder_name || ""} onChange={v => upCo("founder_name", v)} placeholder="Jane Smith" />
                <Inp label="Founder Title" value={cd.founder_title || ""} onChange={v => upCo("founder_title", v)} placeholder="CEO & Founder" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Company Phone" value={cd.phone || ""} onChange={v => upCo("phone", v)} placeholder="+1 (555) 123-4567" mono />
                <Inp label="Company Email" value={cd.email || ""} onChange={v => upCo("email", v)} placeholder="press@company.com" mono />
              </div>
              <Inp label="Company Size" value={cd.company_size || ""} onChange={v => upCo("company_size", v)} placeholder="1-10 employees" />
              <TA label="Company Boilerplate (About paragraph for press)" value={cd.boilerplate || ""} onChange={v => upCo("boilerplate", v)} placeholder="A short paragraph about the company used at the bottom of press releases..." />
            </>;
          })()}
        </Card>

        {/* Email Server Settings */}
        <Card style={{ borderColor: "rgba(255,107,53,0.15)" }}>
          <SL style={{ color: "#ff6b35" }}>Email Server</SL>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "14px" }}>Configure SMTP for outreach emails sent under this product's brand.</div>
          {(() => {
            const es = editDirty.email_settings ?? p.email_settings ?? {};
            const upEmail = (field, val) => setEditDirty(d => ({ ...d, email_settings: { ...(d.email_settings ?? p.email_settings ?? {}), [field]: val } }));
            return <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="SMTP Host" value={es.smtp_host || ""} onChange={v => upEmail("smtp_host", v)} placeholder="smtp.gmail.com" mono />
                <Inp label="SMTP Port" value={es.smtp_port ?? 587} onChange={v => upEmail("smtp_port", parseInt(v) || 587)} type="number" mono />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Username" value={es.smtp_user || ""} onChange={v => upEmail("smtp_user", v)} placeholder="you@example.com" mono />
                <Inp label="Password" value={es.smtp_password || ""} onChange={v => upEmail("smtp_password", v)} placeholder="app password" type="password" mono />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="From Name" value={es.from_name || ""} onChange={v => upEmail("from_name", v)} placeholder="VybeCode Team" />
                <Inp label="From Email" value={es.from_email || ""} onChange={v => upEmail("from_email", v)} placeholder="hello@vybecod.ing" mono />
              </div>
              <Inp label="Reply-To (optional)" value={es.reply_to || ""} onChange={v => upEmail("reply_to", v)} placeholder="support@vybecod.ing" mono />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                <Toggle on={es.use_tls !== false} onChange={v => upEmail("use_tls", v)} color="#ff6b35" />
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)" }}>Use TLS</span>
              </div>
            </>;
          })()}
        </Card>

        <Btn onClick={async () => {
          if (Object.keys(editDirty).length === 0) return;
          try {
            await api.products.update(p.id, editDirty);
            setEditDirty({});
            await reloadProduct();
            notify("Saved ✓", "#22c55e");
          } catch (e) { notify("Save failed: " + e.message, "#ef4444"); }
        }} disabled={Object.keys(editDirty).length === 0}>Save Changes</Btn>

        {/* Danger Zone */}
        <Card style={{ borderColor: "rgba(239,68,68,0.15)", marginTop: "12px" }}>
          <SL style={{ color: "#ef4444" }}>Danger Zone</SL>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Delete this project and all its data permanently.</div>
            <Btn onClick={async () => {
              if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
              try {
                await api.products.delete(p.id);
                notify("Project deleted", "#ef4444");
                onBack();
              } catch (e) { notify("Delete failed: " + e.message, "#ef4444"); }
            }} color="#ef4444" outline small>Delete Project</Btn>
          </div>
        </Card>
      </div>}
    </div>
  );
};

/* ═══════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════ */

const Settings = ({ settings: st, onSave, onBack, user }) => {
  const [tab, setTab] = useState("platforms");
  const [local, setLocal] = useState(st);
  const [saving, setSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [regEnabled, setRegEnabled] = useState(true);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "" });
  const [adminError, setAdminError] = useState("");
  const [adminProjects, setAdminProjects] = useState([]);
  const [transferProject, setTransferProject] = useState("");
  const [transferUser, setTransferUser] = useState("");
  const [brandsList, setBrandsList] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [newBrand, setNewBrand] = useState({});
  const [editingBrand, setEditingBrand] = useState(null);

  const isAdmin = user?.role === "admin";

  const loadBrands = async () => {
    setBrandsLoading(true);
    try { setBrandsList(await api.brands.list()); } catch {}
    setBrandsLoading(false);
  };

  useEffect(() => { setLocal(st); }, [st]);
  useEffect(() => { if (tab === "brands") loadBrands(); }, [tab]);

  // Load admin data when admin tab is selected
  useEffect(() => {
    if (tab === "admin" && isAdmin) {
      setAdminLoading(true);
      Promise.all([api.admin.listUsers(), api.admin.getRegistration(), api.admin.listProjects()])
        .then(([users, reg, projects]) => { setAdminUsers(users); setRegEnabled(reg.registration_enabled); setAdminProjects(projects); })
        .catch(() => {})
        .finally(() => setAdminLoading(false));
    }
  }, [tab, isAdmin]);

  const d = { platforms: PLATFORMS.reduce((a, p) => ({ ...a, [p.id]: { connected: false, handle: "", mode: "manual" } }), {}), brand: { name: "VybeCod.ing", tagline: "", tone: "creative", keywords: ["no-code", "creative tools"], avoid: ["corporate jargon"], elevator: "" }, prefs: { depth: "thorough", length: "medium", emoji: true, hashtags: "moderate", sources: true } };
  const s = { ...d, ...local, platforms: { ...d.platforms, ...local?.platforms }, brand: { ...d.brand, ...local?.brand }, prefs: { ...d.prefs, ...local?.prefs } };
  const up = (k, f, v) => setLocal(prev => ({ ...prev, [k]: { ...(prev?.[k] || d[k]), [f]: v } }));
  const upp = (id, f, v) => setLocal(prev => ({ ...prev, platforms: { ...(prev?.platforms || d.platforms), [id]: { ...(prev?.platforms || d.platforms)[id], [f]: v } } }));

  const doSave = async () => {
    setSaving(true);
    await onSave(local);
    setSaving(false);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--mono)", padding: 0 }}>← Back</button><h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f0f0f0" }}>Settings</h2></div>
        <Btn onClick={doSave} color={saving ? "#22c55e" : "#00f0ff"}>{saving ? "✓ Saving..." : "Save"}</Btn>
      </div>

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px", overflowX: "auto" }}>
        {[["platforms", "📱 Platforms"], ["brands", "🏢 Brands"], ["brand", "🎨 Voice"], ["prefs", "⚙ Preferences"], ...(isAdmin ? [["admin", "🔒 Admin"]] : [])].map(([id, label]) => <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", whiteSpace: "nowrap", background: tab === id ? "rgba(0,240,255,0.1)" : "transparent", color: tab === id ? "#00f0ff" : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>)}
      </div>

      {tab === "platforms" && <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}><span style={{ color: "#00f0ff", fontWeight: 600 }}>Auto</span> = AI posts after approval · <span style={{ color: "#ffaa00", fontWeight: 600 }}>Manual</span> = You post yourself</div>
        {PLATFORMS.map(pl => { const ps = s.platforms[pl.id] || { connected: false, handle: "", mode: "manual" }; return <Card key={pl.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", flexWrap: "wrap" }}>
          <div style={{ width: 32, height: 32, borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", background: ps.connected ? `${pl.color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${ps.connected ? `${pl.color}33` : "rgba(255,255,255,0.08)"}`, fontSize: "13px", fontWeight: 900, color: ps.connected ? pl.color : "rgba(255,255,255,0.2)", fontFamily: "var(--mono)", flexShrink: 0 }}>{pl.icon}</div>
          <div style={{ flex: 1, minWidth: 70 }}><div style={{ fontSize: "12px", fontWeight: 600, color: ps.connected ? "#e0e0e0" : "rgba(255,255,255,0.4)" }}>{pl.name}</div></div>
          {ps.connected && <input value={ps.handle || ""} onChange={e => upp(pl.id, "handle", e.target.value)} placeholder="handle" style={{ width: "100px", padding: "5px 8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "#e0e0e0", fontSize: "10px", fontFamily: "var(--mono)", outline: "none" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}><span style={{ fontSize: "9px", fontWeight: 700, fontFamily: "var(--mono)", color: ps.mode === "auto" ? "#00f0ff" : "#ffaa00" }}>{ps.mode === "auto" ? "AUTO" : "MANUAL"}</span><Toggle on={ps.mode === "auto"} onChange={v => upp(pl.id, "mode", v ? "auto" : "manual")} /></div>
          <button onClick={() => upp(pl.id, "connected", !ps.connected)} style={{ padding: "5px 10px", borderRadius: "5px", fontSize: "9px", fontWeight: 700, fontFamily: "var(--mono)", cursor: "pointer", border: "none", background: ps.connected ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.12)", color: ps.connected ? "#ef4444" : "#22c55e" }}>{ps.connected ? "Disconnect" : "Connect"}</button>
        </Card>; })}
      </div>}

      {tab === "brands" && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>Create brands with company details. Assign them to projects so AI outputs use the correct company info, tone, and boilerplate.</div>

        {/* Brand form helper */}
        {(() => {
          const BrandForm = ({ data, setData, onSave, saveLabel, saveColor, onCancel }) => {
            const founders = data.founders || [];
            const addFounder = () => setData(d => ({ ...d, founders: [...(d.founders || []), { name: "", title: "" }] }));
            const updateFounder = (idx, field, val) => setData(d => ({ ...d, founders: (d.founders || []).map((f, i) => i === idx ? { ...f, [field]: val } : f) }));
            const removeFounder = (idx) => setData(d => ({ ...d, founders: (d.founders || []).filter((_, i) => i !== idx) }));
            return <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Brand Name *" value={data.name || ""} onChange={v => setData(d => ({ ...d, name: v }))} placeholder="Acme Corp" />
                <Inp label="Industry" value={data.industry || ""} onChange={v => setData(d => ({ ...d, industry: v }))} placeholder="Music Technology" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Location" value={data.location || ""} onChange={v => setData(d => ({ ...d, location: v }))} placeholder="Los Angeles, CA" />
                <Inp label="Founded" value={data.founded || ""} onChange={v => setData(d => ({ ...d, founded: v }))} placeholder="2024" />
              </div>

              {/* Founders */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)" }}>FOUNDERS / KEY PEOPLE</label>
                  <button onClick={addFounder} style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)", color: "#00f0ff", cursor: "pointer", fontSize: "11px", fontFamily: "var(--mono)", padding: "3px 10px", borderRadius: "5px" }}>+ Add</button>
                </div>
                {founders.length === 0 && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", padding: "8px 0" }}>No founders added. Click + Add above.</div>}
                {founders.map((f, idx) => <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ flex: 1 }}><Inp label="" value={f.name || ""} onChange={v => updateFounder(idx, "name", v)} placeholder="Name" /></div>
                  <div style={{ flex: 1 }}><Inp label="" value={f.title || ""} onChange={v => updateFounder(idx, "title", v)} placeholder="Title (CEO, CTO...)" /></div>
                  <button onClick={() => removeFounder(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px", flexShrink: 0, padding: "0 4px" }}>✕</button>
                </div>)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Inp label="Phone" value={data.phone || ""} onChange={v => setData(d => ({ ...d, phone: v }))} placeholder="+1 (555) 123-4567" mono />
                <Inp label="Email" value={data.email || ""} onChange={v => setData(d => ({ ...d, email: v }))} placeholder="press@company.com" mono />
              </div>
              <Inp label="Company Size" value={data.company_size || ""} onChange={v => setData(d => ({ ...d, company_size: v }))} placeholder="1-10 employees" />
              <Inp label="Tagline" value={data.tagline || ""} onChange={v => setData(d => ({ ...d, tagline: v }))} placeholder="Empowering creators everywhere" />
              <Inp label="Tone" value={data.tone || ""} onChange={v => setData(d => ({ ...d, tone: v }))} placeholder="professional, approachable" />
              <TA label="Elevator Pitch" value={data.elevator || ""} onChange={v => setData(d => ({ ...d, elevator: v }))} placeholder="One paragraph about what the company does..." />
              <TA label="Boilerplate (for press releases)" value={data.boilerplate || ""} onChange={v => setData(d => ({ ...d, boilerplate: v }))} placeholder="About the company paragraph used at the bottom of press releases..." />
              <div style={{ display: "flex", gap: "8px" }}>
                <Btn onClick={onSave} disabled={!data.name} color={saveColor}>{saveLabel}</Btn>
                {onCancel && <Btn onClick={onCancel} color="#ef4444" outline>Cancel</Btn>}
              </div>
            </>;
          };

          return <>
            {/* Create new brand */}
            <Card style={{ borderColor: "rgba(0,240,255,0.15)" }}>
              <SL style={{ color: "#00f0ff" }}>Create Brand</SL>
              <BrandForm data={newBrand} setData={setNewBrand} saveLabel="Create Brand" saveColor="#00f0ff" onSave={async () => {
                if (!newBrand.name) return;
                try {
                  // Flatten founders for backward compat
                  const payload = { ...newBrand };
                  if (payload.founders?.length > 0) {
                    payload.founder_name = payload.founders.map(f => f.name).join(", ");
                    payload.founder_title = payload.founders.map(f => f.title).join(", ");
                  }
                  await api.brands.create(payload);
                  setNewBrand({});
                  loadBrands();
                } catch (e) { setAdminError(e.message); }
              }} />
            </Card>

            {/* Existing brands */}
            {brandsLoading ? <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.3)" }}>Loading...</div> :
            brandsList.length === 0 ? <div style={{ textAlign: "center", padding: "30px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", fontSize: "12px" }}>No brands yet. Create one above.</div> :
            brandsList.map(br => <Card key={br.id} style={{ borderColor: editingBrand === br.id ? "rgba(0,240,255,0.3)" : "rgba(255,255,255,0.08)" }}>
              {editingBrand === br.id ? (() => {
                const [editData, setEditData] = [brandsList.find(b => b.id === br.id) || br, (fn) => {
                  setBrandsList(prev => prev.map(b => b.id === br.id ? (typeof fn === "function" ? fn(b) : fn) : b));
                }];
                // Parse existing founder_name/title into founders array if not already
                if (!editData.founders) {
                  const names = (editData.founder_name || "").split(",").map(s => s.trim()).filter(Boolean);
                  const titles = (editData.founder_title || "").split(",").map(s => s.trim());
                  const parsedFounders = names.map((n, i) => ({ name: n, title: titles[i] || "" }));
                  if (parsedFounders.length > 0) editData.founders = parsedFounders;
                }
                return <>
                  <SL style={{ color: "#00f0ff" }}>Edit: {br.name}</SL>
                  <BrandForm data={editData} setData={setEditData} saveLabel="Save Changes" saveColor="#22c55e" onCancel={() => { setEditingBrand(null); loadBrands(); }} onSave={async () => {
                    try {
                      const payload = { ...editData };
                      delete payload.id; delete payload.user_id; delete payload.created_at; delete payload.updated_at;
                      if (payload.founders?.length > 0) {
                        payload.founder_name = payload.founders.map(f => f.name).join(", ");
                        payload.founder_title = payload.founders.map(f => f.title).join(", ");
                      }
                      delete payload.founders;
                      await api.brands.update(br.id, payload);
                      setEditingBrand(null);
                      loadBrands();
                    } catch (e) { setAdminError(e.message); }
                  }} />
                </>;
              })() : <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#e0e0e0" }}>{br.name}</div>
                    {br.industry && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{br.industry}{br.location ? ` · ${br.location}` : ""}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Btn onClick={() => setEditingBrand(br.id)} color="#00f0ff" outline small>Edit</Btn>
                    <Btn onClick={async () => {
                      if (confirm("Delete this brand?")) {
                        await api.brands.delete(br.id);
                        loadBrands();
                      }
                    }} color="#ef4444" outline small>Delete</Btn>
                  </div>
                </div>
                {br.founder_name && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{br.founder_name}{br.founder_title ? ` (${br.founder_title})` : ""}</div>}
                {br.email && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)" }}>{br.email}{br.phone ? ` · ${br.phone}` : ""}</div>}
                {br.boilerplate && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "6px", lineHeight: 1.4 }}>{br.boilerplate.substring(0, 150)}{br.boilerplate.length > 150 ? "..." : ""}</div>}
              </>}
            </Card>)}
          </>;
        })()}
      </div>}

      {tab === "brand" && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Card style={{ borderColor: "rgba(0,240,255,0.15)" }}>
          <SL style={{ color: "#00f0ff" }}>White-Label Branding</SL>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "14px" }}>Customize the app appearance. Company name replaces the header. Logo replaces everything.</div>
          <Inp label="Company Name" value={s.brand.company_name || ""} onChange={v => up("brand", "company_name", v)} placeholder="Your Company Name" />
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>Logo URL</label>
            <input type="text" value={s.brand.logo_url || ""} onChange={e => up("brand", "logo_url", e.target.value)} placeholder="https://example.com/logo.png"
              style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box", fontFamily: "var(--mono)" }} />
            {s.brand.logo_url && <div style={{ marginTop: "10px", padding: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={s.brand.logo_url} alt="Logo preview" style={{ maxHeight: "36px", maxWidth: "200px", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)" }}>Preview</span>
            </div>}
          </div>
        </Card>
        <Card>
          <SL>Brand Voice</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}><Inp label="Brand Name" value={s.brand.name} onChange={v => up("brand", "name", v)} /><Inp label="Tagline" value={s.brand.tagline} onChange={v => up("brand", "tagline", v)} /></div>
          <TA label="Elevator Pitch" value={s.brand.elevator} onChange={v => up("brand", "elevator", v)} placeholder="What does your company do?" />
          <Sel label="Tone" value={s.brand.tone} onChange={v => up("brand", "tone", v)} options={[{ value: "creative", label: "Creative & Empowering" }, { value: "professional", label: "Professional" }, { value: "edgy", label: "Edgy & Bold" }, { value: "casual", label: "Casual" }, { value: "technical", label: "Technical" }]} />
          <Tags label="Keywords" tags={s.brand.keywords} onChange={v => up("brand", "keywords", v)} placeholder="keyword..." />
          <Tags label="Avoid" tags={s.brand.avoid} onChange={v => up("brand", "avoid", v)} placeholder="phrase..." />
        </Card>
      </div>}

      {tab === "prefs" && <Card>
        <SL>Agent Behavior</SL>
        <Sel label="Research Depth" value={s.prefs.depth} onChange={v => up("prefs", "depth", v)} options={[{ value: "quick", label: "Quick (1-3 sources)" }, { value: "thorough", label: "Thorough (5-8)" }, { value: "deep", label: "Deep (10+)" }]} />
        <Sel label="Content Length" value={s.prefs.length} onChange={v => up("prefs", "length", v)} options={[{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "long", label: "Long" }]} />
        <Sel label="Hashtags" value={s.prefs.hashtags} onChange={v => up("prefs", "hashtags", v)} options={[{ value: "none", label: "None" }, { value: "minimal", label: "1-3" }, { value: "moderate", label: "5-8" }, { value: "heavy", label: "10-15" }]} />
        {[{ k: "emoji", l: "Emoji in Posts" }, { k: "sources", l: "Cite Sources" }].map(i => <div key={i.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}><span style={{ fontSize: "13px", color: "#e0e0e0" }}>{i.l}</span><Toggle on={s.prefs[i.k]} onChange={v => up("prefs", i.k, v)} /></div>)}
      </Card>}

      {/* ADMIN PANEL */}
      {tab === "admin" && isAdmin && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Registration toggle */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <SL style={{ marginBottom: "4px" }}>Public Registration</SL>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>When off, only admins can create accounts.</div>
            </div>
            <Toggle on={regEnabled} onChange={async (v) => {
              try {
                await api.admin.setRegistration({ registration_enabled: v });
                setRegEnabled(v);
              } catch (e) { setAdminError(e.message); }
            }} color={regEnabled ? "#22c55e" : "#ef4444"} />
          </div>
        </Card>

        {/* Create user */}
        <Card>
          <SL>Create User</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", alignItems: "end" }}>
            <Inp label="Email" value={newUser.email} onChange={v => setNewUser(u => ({ ...u, email: v }))} placeholder="email@example.com" mono />
            <Inp label="Name" value={newUser.name} onChange={v => setNewUser(u => ({ ...u, name: v }))} placeholder="Name" />
            <Inp label="Password" value={newUser.password} onChange={v => setNewUser(u => ({ ...u, password: v }))} placeholder="min 6 chars" type="password" />
          </div>
          {adminError && <div style={{ fontSize: "11px", color: "#ef4444", marginBottom: "8px" }}>{adminError}</div>}
          <Btn onClick={async () => {
            setAdminError("");
            try {
              const created = await api.admin.createUser(newUser);
              setAdminUsers(us => [...us, { ...created, created_at: new Date().toISOString() }]);
              setNewUser({ email: "", password: "", name: "" });
            } catch (e) { setAdminError(e.message); }
          }} disabled={!newUser.email || !newUser.password || newUser.password.length < 6} small>Create User</Btn>
        </Card>

        {/* User list */}
        <Card>
          <SL>Users ({adminUsers.length})</SL>
          {adminLoading ? <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>Loading...</div> :
            adminUsers.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: u.enabled ? "#e0e0e0" : "rgba(255,255,255,0.3)", textDecoration: u.enabled ? "none" : "line-through" }}>{u.name || u.email}</div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)" }}>{u.email}</div>
                </div>
                <Badge color={u.role === "admin" ? "#00f0ff" : "rgba(255,255,255,0.2)"}>{u.role}</Badge>
                <button onClick={async () => {
                  const newRole = u.role === "admin" ? "user" : "admin";
                  try {
                    await api.admin.updateUser(u.id, { role: newRole });
                    setAdminUsers(us => us.map(x => x.id === u.id ? { ...x, role: newRole } : x));
                  } catch (e) { setAdminError(e.message); }
                }} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: "9px", cursor: "pointer", fontFamily: "var(--mono)" }}>
                  {u.role === "admin" ? "Demote" : "Promote"}
                </button>
                <Toggle on={u.enabled} onChange={async (v) => {
                  try {
                    await api.admin.updateUser(u.id, { enabled: v });
                    setAdminUsers(us => us.map(x => x.id === u.id ? { ...x, enabled: v } : x));
                  } catch (e) { setAdminError(e.message); }
                }} color={u.enabled ? "#22c55e" : "#ef4444"} />
                {u.id !== user?.id && <button onClick={async () => {
                  if (!confirm(`Delete ${u.email}?`)) return;
                  try {
                    await api.admin.deleteUser(u.id);
                    setAdminUsers(us => us.filter(x => x.id !== u.id));
                  } catch (e) { setAdminError(e.message); }
                }} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#ef4444", fontSize: "9px", cursor: "pointer", fontFamily: "var(--mono)" }}>Delete</button>}
              </div>
            ))}
        </Card>

        {/* Transfer project */}
        <Card style={{ borderColor: "rgba(168,85,247,0.15)" }}>
          <SL style={{ color: "#a855f7" }}>Transfer Project</SL>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "14px" }}>Move a project and all its data to a different user account.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>Project</label>
              <select value={transferProject} onChange={e => setTransferProject(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "12px", fontFamily: "var(--mono)", outline: "none" }}>
                <option value="" style={{ background: "#15151f" }}>Select project...</option>
                {adminProjects.map(p => <option key={p.id} value={p.id} style={{ background: "#15151f" }}>{p.name} ({p.user_email})</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>Transfer To</label>
              <select value={transferUser} onChange={e => setTransferUser(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "12px", fontFamily: "var(--mono)", outline: "none" }}>
                <option value="" style={{ background: "#15151f" }}>Select user...</option>
                {adminUsers.map(u => <option key={u.id} value={u.id} style={{ background: "#15151f" }}>{u.name || u.email} ({u.email})</option>)}
              </select>
            </div>
          </div>
          <Btn onClick={async () => {
            if (!transferProject || !transferUser) return;
            const proj = adminProjects.find(p => p.id === transferProject);
            const usr = adminUsers.find(u => u.id === transferUser);
            if (!confirm(`Transfer "${proj?.name}" to ${usr?.email}?`)) return;
            try {
              await api.admin.transferProject({ product_id: transferProject, target_user_id: transferUser });
              // Refresh project list
              const projects = await api.admin.listProjects();
              setAdminProjects(projects);
              setTransferProject(""); setTransferUser("");
              setAdminError("");
            } catch (e) { setAdminError(e.message); }
          }} disabled={!transferProject || !transferUser} color="#a855f7" small>Transfer Project</Btn>
        </Card>
      </div>}
    </div>
  );
};

/* ═══════════════════════════════════════
   CREATE PRODUCT MODAL
   ═══════════════════════════════════════ */

const CreateModal = ({ onClose, onCreate }) => {
  const [n, setN] = useState(""); const [t, setT] = useState(""); const [u, setU] = useState(""); const [c, setC] = useState("#00f0ff");
  const [projectType, setProjectType] = useState("product");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const hasEnoughData = u.trim().length > 0 || desc.trim().length > 80;
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "440px", animation: "slideIn 0.3s ease", maxHeight: "90vh", overflowY: "auto" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f0f0f0" }}>New Project</h3>
      <Sel label="Project Type" value={projectType} onChange={setProjectType} options={[
        { value: "product", label: "Product" },
        { value: "service", label: "Service" },
        { value: "persona", label: "Persona (Blogger/Podcaster/YouTuber)" },
      ]} />
      <Inp label="Name" value={n} onChange={setN} placeholder={projectType === "persona" ? "e.g., TechTalkWithTina" : projectType === "service" ? "e.g., CloudOps Consulting" : "e.g., VybeCode DSP"} />
      <Inp label="Tagline" value={t} onChange={setT} placeholder="One-liner" />
      <Inp label="URL (optional)" value={u} onChange={setU} placeholder="https://..." mono />
      <TA label="Description" value={desc} onChange={setDesc} placeholder={projectType === "persona" ? "Describe your persona, content niche, audience, and brand identity..." : projectType === "service" ? "Describe your service, target clients, and key differentiators..." : "What does this product do? Target audience, key features, etc."} rows={3} />
      {!hasEnoughData && n.trim().length > 0 && <div style={{ padding: "10px 14px", background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: "8px", marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <span style={{ color: "#ffaa00", fontSize: "14px", flexShrink: 0 }}>!</span>
        <span style={{ fontSize: "11px", color: "#ffaa00", lineHeight: 1.5 }}>Not enough information to extract valuation. Please add a web URL or thorough description for best results from AI workflows.</span>
      </div>}
      <Sel label="Color" value={c} onChange={setC} options={[{ value: "#00f0ff", label: "Cyan" }, { value: "#a855f7", label: "Purple" }, { value: "#ff6b35", label: "Orange" }, { value: "#22c55e", label: "Green" }, { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" }]} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <Btn onClick={async () => {
          if (!n) return;
          setCreating(true);
          await onCreate({ name: n, tagline: t, url: u, color: c, description: desc ? `[${projectType.toUpperCase()}] ${desc}` : `[${projectType.toUpperCase()}]` });
          setCreating(false);
        }} disabled={!n || creating} style={{ flex: 1 }}>{creating ? "Creating..." : "Create"}</Btn>
        <Btn onClick={onClose} color="#ef4444" outline>Cancel</Btn>
      </div>
    </div>
  </div>;
};

/* ═══════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════ */

const LoginPage = ({ onAuth }) => {
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = mode === "login"
        ? await api.auth.login({ email, password })
        : await api.auth.register({ email, password, name });
      localStorage.setItem("launchops_token", result.token);
      onAuth(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080d", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "380px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f0f0f0" }}>
            VybeCod<span style={{ color: "#00f0ff" }}>.</span>ing
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "4px" }}>Launch Operations</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "28px" }}>
          <div style={{ display: "flex", gap: "0", marginBottom: "24px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "3px" }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{ flex: 1, padding: "8px", border: "none", borderRadius: "6px", background: mode === m ? "rgba(0,240,255,0.12)" : "transparent", color: mode === m ? "#00f0ff" : "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box", fontFamily: "var(--mono)" }} />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "var(--mono)", display: "block", marginBottom: "6px" }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                style={{ width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            </div>

            {error && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "14px", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.15)" }}>{error}</div>}

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "12px", border: "none", borderRadius: "8px", background: loading ? "rgba(0,240,255,0.3)" : "#00f0ff", color: "#0a0a0f", fontSize: "13px", fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "var(--mono)" }}>
              {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════
   APP
   ═══════════════════════════════════════ */

export default function App() {
  // ─── Auth state ───
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("launchops_token");
    if (token) {
      api.auth.me()
        .then(profile => setUser(profile))
        .catch(() => localStorage.removeItem("launchops_token"))
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("launchops_token");
    setUser(null);
  };

  // Show loading while checking auth
  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080d" }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", fontSize: "12px" }}>Loading...</div>
    </div>;
  }

  // Show login if not authenticated
  if (!user) return <LoginPage onAuth={setUser} />;

  // Authenticated — render main app
  return <AuthenticatedApp user={user} onLogout={handleLogout} />;
}


function AuthenticatedApp({ user, onLogout }) {
  const [view, setView] = useState("home");
  const [sub, setSub] = useState("products");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selId, setSelId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notif, setNotif] = useState(null);
  const [settings, setSettings] = useState({});
  const [captures, setCaptures] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [calEvents, setCalEvents] = useState([]);

  const notify = (msg, color) => { setNotif({ msg, color }); setTimeout(() => setNotif(null), 3000); };
  const selProduct = products.find(p => p.id === selId);

  // ─── Load all data on mount ───
  useEffect(() => {
    const load = async () => {
      try {
        const [prods, tmpls, events, caps, sett] = await Promise.all([
          api.products.list(),
          api.templates.list(),
          api.calendar.list(),
          api.captures.list(),
          api.settings.get(),
        ]);
        setProducts(prods);
        setTemplates(tmpls);
        setCalEvents(events);
        setCaptures(caps);
        setSettings(sett);
      } catch (e) {
        notify("Failed to load data: " + e.message, "#ef4444");
      } finally {
        setProductsLoading(false);
      }
    };
    load();
  }, []);

  // ─── Product CRUD ───
  const createProduct = async (data) => {
    try {
      const product = await api.products.create(data);
      setProducts(ps => [...ps, product]);
      setShowCreate(false);
      notify(`${data.name} created ✓`, "#22c55e");
    } catch (e) { notify("Create failed: " + e.message, "#ef4444"); }
  };

  const reloadProduct = async () => {
    if (!selId) return;
    try {
      const updated = await api.products.get(selId);
      setProducts(ps => ps.map(p => p.id === selId ? updated : p));
    } catch (e) { /* silently fail reload */ }
  };

  // ─── Captures ───
  const addCapture = async (data) => {
    try {
      const capture = await api.captures.create(data);
      setCaptures(cs => [capture, ...cs]);
      notify("Captured ⚡", "#a855f7");
    } catch (e) { notify("Capture failed: " + e.message, "#ef4444"); }
  };

  // ─── Calendar ───
  const addCalEvent = async (data) => {
    try {
      const event = await api.calendar.create(data);
      setCalEvents(ev => [...ev, event]);
      notify("Event added ✓", "#22c55e");
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
  };
  const removeCalEvent = async (id) => {
    try {
      await api.calendar.delete(id);
      setCalEvents(ev => ev.filter(e => e.id !== id));
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
  };

  // ─── Templates ───
  const deleteTemplate = async (id) => {
    try {
      await api.templates.delete(id);
      setTemplates(ts => ts.filter(t => t.id !== id));
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
  };

  // ─── Settings ───
  const saveSettings = async (data) => {
    try {
      await api.settings.update(data);
      setSettings(data);
      notify("Settings saved ✓", "#22c55e");
    } catch (e) { notify("Save failed: " + e.message, "#ef4444"); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#e0e0e0", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "15px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
        :root { --mono: Arial, Helvetica, sans-serif; --sans: Arial, Helvetica, sans-serif; }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes queuePulse { 0%,100%{box-shadow:0 0 4px rgba(255,170,0,0.2)}50%{box-shadow:0 0 12px rgba(255,170,0,0.6);background:rgba(255,170,0,0.08)} }
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.25)}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        select option{background:#15151f}
      `}</style>

      {notif && <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1001, background: "rgba(15,15,25,0.95)", border: `1px solid ${notif.color}44`, borderRadius: "10px", padding: "14px 24px", animation: "slideDown 0.3s ease", backdropFilter: "blur(12px)" }}><span style={{ fontSize: "13px", fontWeight: 600, color: notif.color, fontFamily: "var(--mono)" }}>{notif.msg}</span></div>}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={createProduct} />}

      {/* Header */}
      <div style={{ padding: "18px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.01)", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }} onClick={() => { setView("home"); setSelId(null); setSub("products"); }}>
          {settings?.brand?.logo_url ? (
            <img src={settings.brand.logo_url} alt="Logo" style={{ maxHeight: "36px", maxWidth: "180px", objectFit: "contain" }} />
          ) : (<>
            <div style={{ width: 34, height: 34, borderRadius: "8px", background: "linear-gradient(135deg, #00f0ff, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 900, color: "#0a0a0f", fontFamily: "'Space Mono', monospace" }}>{(settings?.brand?.company_name || "V")[0].toUpperCase()}</div>
            <div><div style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{settings?.brand?.company_name || <>VybeCod<span style={{ color: "#00f0ff" }}>.</span>ing</>}</div><div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Launch Operations</div></div>
          </>)}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[["home", "Command Center"], ["settings", "⚙ Settings"]].map(([id, label]) => <button key={id} onClick={() => { setView(id); setSelId(null); }} style={{ padding: "7px 16px", borderRadius: "6px", border: "none", background: view === id && !selId ? "rgba(255,255,255,0.08)" : "transparent", color: view === id && !selId ? "#f0f0f0" : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>)}
          <button onClick={onLogout} style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "rgba(239,68,68,0.6)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
        {view === "home" && !selId && <Home products={products} captures={captures} templates={templates} calEvents={calEvents} products_loading={productsLoading} onAddCalEvent={addCalEvent} onRemoveCalEvent={removeCalEvent} onSelect={id => { setSelId(id); setView("product"); }} onCreate={() => setShowCreate(true)} onCapture={addCapture} onDeleteTemplate={deleteTemplate} sub={sub} setSub={setSub} notify={notify} />}
        {selId && selProduct && <ProductDash product={selProduct} reloadProduct={reloadProduct} onBack={() => { setSelId(null); setView("home"); }} notify={notify} templates={templates} />}
        {view === "settings" && !selId && <Settings settings={settings} onSave={saveSettings} onBack={() => setView("home")} user={user} />}
      </div>
    </div>
  );
}
