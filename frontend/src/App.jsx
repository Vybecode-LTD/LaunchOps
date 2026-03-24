import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api";

/* ═══════════════════════════════════════
   DATA & CONSTANTS
   ═══════════════════════════════════════ */

const WORKFLOWS = [
  { id: "competitor", name: "Competitor Deep-Dive", icon: "🔍", color: "#00f0ff", desc: "Analyze a competitor's product, pricing & positioning", tags: ["research"] },
  { id: "trend", name: "Trend Report", icon: "🔍", color: "#00f0ff", desc: "What's happening in your product's space", tags: ["research"] },
  { id: "press_targets", name: "Press Kit Targets", icon: "📡", color: "#ff6b35", desc: "Discover blogs, publications & influencers", tags: ["outreach", "email"] },
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
    // Bold, italic, inline code, links
    return str
      .replace(/\*\*(.+?)\*\*/g, "⟪b⟫$1⟪/b⟫")
      .replace(/\*(.+?)\*/g, "⟪i⟫$1⟪/i⟫")
      .replace(/`(.+?)`/g, "⟪code⟫$1⟪/code⟫")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "⟪a⟫$1⟪href⟫$2⟪/a⟫")
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
        {[["products", "Products"], ["calendar", "📅 Calendar"], ["templates", "📄 Templates"]].map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: sub === id ? "rgba(255,255,255,0.08)" : "transparent", color: sub === id ? "#f0f0f0" : "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>
        ))}
      </div>

      {sub === "products" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[{ l: "Products", v: products.length, c: "#00f0ff" }, { l: "Pending", v: totalPending, c: "#ffaa00" }, { l: "Captures", v: captures.length, c: "#a855f7" }, { l: "Templates", v: templates.length, c: "#22c55e" }].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{s.l}</div>
              <div style={{ fontSize: "26px", fontWeight: 700, color: s.c, fontFamily: "'Space Mono', monospace" }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <SL style={{ marginBottom: 0 }}>Your Products</SL>
          <Btn onClick={onCreate} outline small>+ New Product</Btn>
        </div>

        {products_loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", fontSize: "12px" }}>Loading products...</div>
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
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)" }}>Add Product</div>
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
  const [priceResult, setPriceResult] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [seoUrl, setSeoUrl] = useState(p.url || "");
  const [seoResult, setSeoResult] = useState(p.seo_result || null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoMethod, setSeoMethod] = useState("manual");
  const [queueItems, setQueueItems] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [wfTemplates, setWfTemplates] = useState([]);
  const [editDirty, setEditDirty] = useState({});
  const [expandedQueue, setExpandedQueue] = useState(null);
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
    { id: "queue", label: `Queue (${pending})` },
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
    } catch (e) { notify("Launch failed: " + e.message, "#ef4444"); }
    finally { setLaunching(false); }
  };

  // ─── Press Kit (API) ───
  const generatePressKit = async () => {
    if (!pressUrl) return;
    setGenerating(true);
    setGenStep("Scraping & analyzing...");
    try {
      await api.pressKit.generate({ product_id: p.id, url: pressUrl });
      notify("Press kit ready ✓", "#22c55e");
      await reloadProduct();
    } catch (e) { notify("Press kit failed: " + e.message, "#ef4444"); }
    finally { setGenerating(false); setGenStep(""); }
  };

  // ─── Repurpose (API) ───
  const repurpose = async () => {
    if (!repInput) return;
    setRepLoading(true);
    try {
      const result = await api.repurpose.create({ product_id: p.id, content: repInput });
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
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
  };
  const rejectItem = async (id) => {
    try {
      await api.queue.update(id, { status: "rejected" });
      notify("Rejected", "#ef4444");
      loadQueue();
    } catch (e) { notify("Failed: " + e.message, "#ef4444"); }
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
      <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--mono)", padding: 0, marginBottom: "8px" }}>← Products</button>
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
        {tabs.map(t => <button key={t.id} onClick={() => { setTab(t.id); setSelWf(null); }} style={{ padding: "7px 13px", borderRadius: "6px", border: "none", whiteSpace: "nowrap", background: tab === t.id ? `${p.color}18` : "transparent", color: tab === t.id ? p.color : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{t.label}</button>)}
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
          {[["📦", "Press Kit", "press_kit"], ["🔄", "Repurpose", "repurpose"], ["💰", "Pricing", "pricing"], ["🔎", "SEO", "seo"], ["✨", "Workflows", "workflows"], ["🛫", "Checklist", "checklist"], ["📋", "Queue", "queue"], ["✏️", "Edit", "edit"]].map(([icon, label, t], i) => (
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

      {/* REPURPOSER */}
      {tab === "repurpose" && <div>
        <SL>Cross-Platform Repurposer</SL>
        {!repResults ? <Card>
          <TA label="Write your content once" value={repInput} onChange={setRepInput} placeholder="Paste any announcement, update, or idea..." rows={4} />
          <Btn onClick={repurpose} disabled={!repInput || repLoading}>{repLoading ? "⏳ Repurposing..." : "Repurpose for All Platforms"}</Btn>
        </Card> : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Btn onClick={() => setRepResults(null)} color="#ef4444" outline small style={{ alignSelf: "flex-end" }}>Start Over</Btn>
          {(repResults[0]?.platforms || repResults).map((r, i) => <Card key={i} style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#e0e0e0" }}>{r.platform}</span>
              {r.character_count && <Badge color="rgba(255,255,255,0.3)">{r.character_count} chars</Badge>}
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.content}</div>
            {r.hashtags && <div style={{ fontSize: "10px", color: "rgba(0,240,255,0.5)", fontFamily: "var(--mono)", marginTop: "6px" }}>{Array.isArray(r.hashtags) ? r.hashtags.join(" ") : r.hashtags}</div>}
          </Card>)}
        </div>}
      </div>}

      {/* PRICING */}
      {tab === "pricing" && <div>
        <SL>Pricing Strategy Advisor</SL>
        {!priceResult ? <Card>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "14px" }}>Claude analyzes competitors, market positioning, and your product to suggest pricing tiers.</div>
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

          {/* Export to Claude Code */}
          <Card style={{ background: "rgba(168,85,247,0.04)", borderColor: "rgba(168,85,247,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0, color: "#a855f7" }}>Export to Claude Code</SL>
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
              Generates a ready-to-paste prompt with all SEO changes. Open Claude Code in your project directory and paste it — Claude will find the right files and apply every change automatically.
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
          const phaseDone = phase.items.filter((_, i) => p.checklist?.[`${phase.phase}_${i}`]).length;
          return <div key={phase.phase} style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: phase.color }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: phase.color, fontFamily: "'Space Mono', monospace" }}>{phase.phase}</span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)" }}>{phaseDone}/{phase.items.length}</span>
            </div>
            <div style={{ marginLeft: "16px", borderLeft: `2px solid ${phase.color}22`, paddingLeft: "14px" }}>
              {phase.items.map((item, i) => {
                const key = `${phase.phase}_${i}`;
                return <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "6px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!p.checklist?.[key]} onChange={e => toggleChecklist(key, e.target.checked)} style={{ accentColor: phase.color, width: "15px", height: "15px", marginTop: "1px", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: p.checklist?.[key] ? "rgba(255,255,255,0.3)" : "#e0e0e0", textDecoration: p.checklist?.[key] ? "line-through" : "none", lineHeight: 1.5 }}>{item}</span>
                </label>;
              })}
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
                {q.status === "running" && <div style={{ fontSize: "10px", color: "#00f0ff", fontFamily: "var(--mono)", animation: "pulse 1.5s infinite" }}>Running...</div>}
                {hasContent && <Btn onClick={(e) => { e.stopPropagation(); copyToClipboard(contentStr, notify); }} outline small color="#a855f7" style={{ padding: "4px 10px", fontSize: "9px" }}>📋</Btn>}
              </div>
            </div>
            {isExpanded && hasContent && <div style={{ marginTop: "12px" }}>
              <div style={{ padding: "14px", background: "rgba(0,0,0,0.25)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", maxHeight: "400px", overflow: "auto" }}>
                {typeof content === "object" && !Array.isArray(content) ? Object.entries(content).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: p.color, fontFamily: "var(--mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{key.replace(/_/g, " ")}</div>
                    <div style={{ lineHeight: 1.6 }}>{typeof val === "string" ? renderMarkdown(val) : Array.isArray(val) ? val.map((item, i) => <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", padding: "3px 0", lineHeight: 1.6 }}>{typeof item === "string" ? renderMarkdown(`• ${item}`) : <span style={{ fontFamily: "var(--mono)", fontSize: "11px" }}>{JSON.stringify(item, null, 2)}</span>}</div>) : <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "rgba(255,255,255,0.5)", whiteSpace: "pre-wrap" }}>{JSON.stringify(val, null, 2)}</div>}</div>
                  </div>
                )) : <div style={{ lineHeight: 1.6 }}>{renderMarkdown(contentStr)}</div>}
              </div>
              {/* Export to Claude Code */}
              <div style={{ display: "flex", gap: "6px", marginTop: "8px", justifyContent: "flex-end" }}>
                <button onClick={(e) => { e.stopPropagation(); copyToClipboard(buildClaudeCodePrompt(q, wf?.name || q.workflow_id, p.name), notify); }} style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "6px", color: "#a855f7", fontSize: "10px", fontFamily: "var(--mono)", padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "12px" }}>🤖</span> Export to Claude Code
                </button>
              </div>
            </div>}
          </Card>;
        }) : <div style={{ textAlign: "center", padding: "50px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", fontSize: "12px" }}>Queue empty. Launch a workflow to populate it.</div>}
      </div>}

      {/* EDIT */}
      {tab === "edit" && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Card>
          <SL>Product Details</SL>
          <Inp label="Name" value={editDirty.name ?? p.name} onChange={v => setEditDirty(d => ({ ...d, name: v }))} />
          <Inp label="Tagline" value={editDirty.tagline ?? p.tagline} onChange={v => setEditDirty(d => ({ ...d, tagline: v }))} />
          <Inp label="URL" value={editDirty.url ?? (p.url || "")} onChange={v => setEditDirty(d => ({ ...d, url: v }))} mono />
          <TA label="Description (context for Claude)" value={editDirty.description ?? (p.description || "")} onChange={v => setEditDirty(d => ({ ...d, description: v }))} placeholder="What does this product do?" />
          <Tags label="Keywords" tags={editDirty.keywords ?? (p.keywords || [])} onChange={v => setEditDirty(d => ({ ...d, keywords: v }))} placeholder="keyword..." />
          <Sel label="Color" value={editDirty.color ?? p.color} onChange={v => setEditDirty(d => ({ ...d, color: v }))} options={[{ value: "#00f0ff", label: "Cyan" }, { value: "#a855f7", label: "Purple" }, { value: "#ff6b35", label: "Orange" }, { value: "#22c55e", label: "Green" }, { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" }]} />
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
      </div>}
    </div>
  );
};

/* ═══════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════ */

const Settings = ({ settings: st, onSave, onBack }) => {
  const [tab, setTab] = useState("platforms");
  const [local, setLocal] = useState(st);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(st); }, [st]);

  const d = { platforms: PLATFORMS.reduce((a, p) => ({ ...a, [p.id]: { connected: false, handle: "", mode: "manual" } }), {}), brand: { name: "VybeCod.ing", tagline: "", tone: "creative", keywords: ["no-code", "creative tools"], avoid: ["corporate jargon"], elevator: "" }, prefs: { depth: "thorough", length: "medium", emoji: true, hashtags: "moderate", sources: true } };
  const s = { ...d, ...local, platforms: { ...d.platforms, ...local?.platforms }, prefs: { ...d.prefs, ...local?.prefs } };
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
        {[["platforms", "📱 Platforms"], ["brand", "🎨 Brand"], ["prefs", "⚙ Preferences"]].map(([id, label]) => <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", whiteSpace: "nowrap", background: tab === id ? "rgba(0,240,255,0.1)" : "transparent", color: tab === id ? "#00f0ff" : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>)}
      </div>

      {tab === "platforms" && <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}><span style={{ color: "#00f0ff", fontWeight: 600 }}>Auto</span> = Claude posts after approval · <span style={{ color: "#ffaa00", fontWeight: 600 }}>Manual</span> = You post yourself</div>
        {PLATFORMS.map(pl => { const ps = s.platforms[pl.id] || { connected: false, handle: "", mode: "manual" }; return <Card key={pl.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", flexWrap: "wrap" }}>
          <div style={{ width: 32, height: 32, borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", background: ps.connected ? `${pl.color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${ps.connected ? `${pl.color}33` : "rgba(255,255,255,0.08)"}`, fontSize: "13px", fontWeight: 900, color: ps.connected ? pl.color : "rgba(255,255,255,0.2)", fontFamily: "var(--mono)", flexShrink: 0 }}>{pl.icon}</div>
          <div style={{ flex: 1, minWidth: 70 }}><div style={{ fontSize: "12px", fontWeight: 600, color: ps.connected ? "#e0e0e0" : "rgba(255,255,255,0.4)" }}>{pl.name}</div></div>
          {ps.connected && <input value={ps.handle || ""} onChange={e => upp(pl.id, "handle", e.target.value)} placeholder="handle" style={{ width: "100px", padding: "5px 8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "#e0e0e0", fontSize: "10px", fontFamily: "var(--mono)", outline: "none" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}><span style={{ fontSize: "9px", fontWeight: 700, fontFamily: "var(--mono)", color: ps.mode === "auto" ? "#00f0ff" : "#ffaa00" }}>{ps.mode === "auto" ? "AUTO" : "MANUAL"}</span><Toggle on={ps.mode === "auto"} onChange={v => upp(pl.id, "mode", v ? "auto" : "manual")} /></div>
          <button onClick={() => upp(pl.id, "connected", !ps.connected)} style={{ padding: "5px 10px", borderRadius: "5px", fontSize: "9px", fontWeight: 700, fontFamily: "var(--mono)", cursor: "pointer", border: "none", background: ps.connected ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.12)", color: ps.connected ? "#ef4444" : "#22c55e" }}>{ps.connected ? "Disconnect" : "Connect"}</button>
        </Card>; })}
      </div>}

      {tab === "brand" && <Card>
        <SL>Brand Identity</SL>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}><Inp label="Brand Name" value={s.brand.name} onChange={v => up("brand", "name", v)} /><Inp label="Tagline" value={s.brand.tagline} onChange={v => up("brand", "tagline", v)} /></div>
        <TA label="Elevator Pitch" value={s.brand.elevator} onChange={v => up("brand", "elevator", v)} placeholder="What does VybeCod.ing do?" />
        <Sel label="Tone" value={s.brand.tone} onChange={v => up("brand", "tone", v)} options={[{ value: "creative", label: "Creative & Empowering" }, { value: "professional", label: "Professional" }, { value: "edgy", label: "Edgy & Bold" }, { value: "casual", label: "Casual" }, { value: "technical", label: "Technical" }]} />
        <Tags label="Keywords" tags={s.brand.keywords} onChange={v => up("brand", "keywords", v)} placeholder="keyword..." />
        <Tags label="Avoid" tags={s.brand.avoid} onChange={v => up("brand", "avoid", v)} placeholder="phrase..." />
      </Card>}

      {tab === "prefs" && <Card>
        <SL>Agent Behavior</SL>
        <Sel label="Research Depth" value={s.prefs.depth} onChange={v => up("prefs", "depth", v)} options={[{ value: "quick", label: "Quick (1-3 sources)" }, { value: "thorough", label: "Thorough (5-8)" }, { value: "deep", label: "Deep (10+)" }]} />
        <Sel label="Content Length" value={s.prefs.length} onChange={v => up("prefs", "length", v)} options={[{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "long", label: "Long" }]} />
        <Sel label="Hashtags" value={s.prefs.hashtags} onChange={v => up("prefs", "hashtags", v)} options={[{ value: "none", label: "None" }, { value: "minimal", label: "1-3" }, { value: "moderate", label: "5-8" }, { value: "heavy", label: "10-15" }]} />
        {[{ k: "emoji", l: "Emoji in Posts" }, { k: "sources", l: "Cite Sources" }].map(i => <div key={i.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}><span style={{ fontSize: "13px", color: "#e0e0e0" }}>{i.l}</span><Toggle on={s.prefs[i.k]} onChange={v => up("prefs", i.k, v)} /></div>)}
      </Card>}
    </div>
  );
};

/* ═══════════════════════════════════════
   CREATE PRODUCT MODAL
   ═══════════════════════════════════════ */

const CreateModal = ({ onClose, onCreate }) => {
  const [n, setN] = useState(""); const [t, setT] = useState(""); const [u, setU] = useState(""); const [c, setC] = useState("#00f0ff");
  const [creating, setCreating] = useState(false);
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "440px", animation: "slideIn 0.3s ease" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f0f0f0" }}>New Product</h3>
      <Inp label="Name" value={n} onChange={setN} placeholder="e.g., VybeCode DSP" />
      <Inp label="Tagline" value={t} onChange={setT} placeholder="One-liner" />
      <Inp label="URL (optional)" value={u} onChange={setU} placeholder="https://..." mono />
      <Sel label="Color" value={c} onChange={setC} options={[{ value: "#00f0ff", label: "Cyan" }, { value: "#a855f7", label: "Purple" }, { value: "#ff6b35", label: "Orange" }, { value: "#22c55e", label: "Green" }, { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" }]} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <Btn onClick={async () => {
          if (!n) return;
          setCreating(true);
          await onCreate({ name: n, tagline: t, url: u, color: c });
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
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#e0e0e0", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        :root { --mono: 'JetBrains Mono', monospace; --sans: 'Inter', -apple-system, sans-serif; }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
        textarea::placeholder,input::placeholder{color:rgba(255,255,255,0.25)}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        select option{background:#15151f}
      `}</style>

      {notif && <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1001, background: "rgba(15,15,25,0.95)", border: `1px solid ${notif.color}44`, borderRadius: "10px", padding: "14px 24px", animation: "slideDown 0.3s ease", backdropFilter: "blur(12px)" }}><span style={{ fontSize: "13px", fontWeight: 600, color: notif.color, fontFamily: "var(--mono)" }}>{notif.msg}</span></div>}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={createProduct} />}

      {/* Header */}
      <div style={{ padding: "18px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.01)", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }} onClick={() => { setView("home"); setSelId(null); setSub("products"); }}>
          <div style={{ width: 34, height: 34, borderRadius: "8px", background: "linear-gradient(135deg, #00f0ff, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 900, color: "#0a0a0f", fontFamily: "'Space Mono', monospace" }}>V</div>
          <div><div style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>VybeCod<span style={{ color: "#00f0ff" }}>.</span>ing</div><div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Launch Operations</div></div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[["home", "Command Center"], ["settings", "⚙ Settings"]].map(([id, label]) => <button key={id} onClick={() => { setView(id); setSelId(null); }} style={{ padding: "7px 16px", borderRadius: "6px", border: "none", background: view === id && !selId ? "rgba(255,255,255,0.08)" : "transparent", color: view === id && !selId ? "#f0f0f0" : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>)}
          <button onClick={onLogout} style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "rgba(239,68,68,0.6)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
        {view === "home" && !selId && <Home products={products} captures={captures} templates={templates} calEvents={calEvents} products_loading={productsLoading} onAddCalEvent={addCalEvent} onRemoveCalEvent={removeCalEvent} onSelect={id => { setSelId(id); setView("product"); }} onCreate={() => setShowCreate(true)} onCapture={addCapture} onDeleteTemplate={deleteTemplate} sub={sub} setSub={setSub} notify={notify} />}
        {selId && selProduct && <ProductDash product={selProduct} reloadProduct={reloadProduct} onBack={() => { setSelId(null); setView("home"); }} notify={notify} templates={templates} />}
        {view === "settings" && !selId && <Settings settings={settings} onSave={saveSettings} onBack={() => setView("home")} />}
      </div>
    </div>
  );
}
