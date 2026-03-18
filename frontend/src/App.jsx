import { useState } from "react";

/* ═══════════════════════════════════════
   DATA & CONSTANTS
   ═══════════════════════════════════════ */

let _id = 1;
const uid = () => `_${_id++}`;

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

const SAMPLE_PRODUCTS = [{
  id: "vybecode-dsp", name: "VybeCode DSP", tagline: "Audio plugin development without code",
  url: "https://vybecod.ing/dsp", status: "pre_launch", color: "#00f0ff",
  pressKit: null, checklist: {},
  queue: [
    { id: uid(), workflow: "press_targets", status: "pending", preview: "Found 12 music production blogs accepting press kits...", time: "2m ago" },
    { id: uid(), workflow: "social_posts", status: "pending", preview: "5 Twitter/X posts for pre-launch campaign...", time: "8m ago" },
  ],
  keywords: ["audio plugins", "no-code", "music production", "DSP", "VST"], description: "",
}];

const SAMPLE_TEMPLATES = [
  { id: uid(), name: "Cold Outreach — Product Launch", type: "email", tags: ["outreach", "email"], content: "Hi {name},\n\nI'm reaching out because I think {publication} readers would love to know about {product} — {tagline}.\n\nWe're launching soon and I'd love to share a press kit with you. Would you be interested in taking a look?\n\nBest,\n{sender}", source: "VybeCode DSP", date: "Mar 15" },
  { id: uid(), name: "Twitter Launch Thread", type: "social", tags: ["social", "content"], content: "🚀 Introducing {product} — {tagline}\n\n🧵 Thread on why we built this and what makes it different:\n\n1/ The problem: {pain_point}\n2/ Our approach: {solution}\n3/ Key features: {features}\n4/ Try it today: {url}", source: "VybeCode DSP", date: "Mar 14" },
  { id: uid(), name: "Reddit Community Post", type: "social", tags: ["social", "community"], content: "Hey {subreddit} — I've been working on {product}, which {tagline}.\n\nI know self-promo can be annoying, so I genuinely want feedback from this community. Here's what it does:\n\n{features}\n\nWould love honest thoughts. Link in comments if allowed by rules.", source: "VybeCode DSP", date: "Mar 13" },
  { id: uid(), name: "Blog Announcement Draft", type: "blog", tags: ["content", "blog"], content: "# Introducing {product}\n\n{elevator_pitch}\n\n## The Problem\n{pain_point}\n\n## Our Solution\n{solution}\n\n## Key Features\n{features}\n\n## Get Started\n{cta}", source: "VybeCode DSP", date: "Mar 12" },
];

const copyToClipboard = (text, notify) => {
  navigator.clipboard.writeText(text).then(() => notify("Copied to clipboard ✓", "#22c55e")).catch(() => notify("Copy failed", "#ef4444"));
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
  const go = () => { if (text.trim()) { onCapture({ id: uid(), text, productId: pid, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }); setText(""); } };
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

const Calendar = ({ events, setEvents, products }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [newTask, setNewTask] = useState("");
  const [newProduct, setNewProduct] = useState(products[0]?.id || "");
  const [newPlatform, setNewPlatform] = useState("twitter");

  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - today.getDay() + 1);
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const todayStr = today.toISOString().split("T")[0];

  const addEvent = () => {
    if (!newTask.trim() || !selectedDate) return;
    const prod = products.find(p => p.id === newProduct);
    setEvents(ev => [...ev, { id: uid(), date: selectedDate, product: prod?.name || "—", platform: newPlatform, title: newTask, color: prod?.color || "#00f0ff" }]);
    setNewTask("");
  };

  const removeEvent = (id) => setEvents(ev => ev.filter(e => e.id !== id));

  const selectedEvents = events.filter(e => e.date === selectedDate);

  return (
    <div>
      <SL>Content Calendar</SL>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: selectedDate ? "16px" : 0 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", padding: "6px 0" }}>{d}</div>)}
        {days.map((day, i) => {
          const ds = day.toISOString().split("T")[0];
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          const dayEvts = events.filter(e => e.date === ds);
          return (
            <div key={i} onClick={() => setSelectedDate(isSelected ? null : ds)}
              style={{ background: isSelected ? "rgba(0,240,255,0.08)" : isToday ? "rgba(0,240,255,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${isSelected ? "rgba(0,240,255,0.3)" : isToday ? "rgba(0,240,255,0.12)" : "rgba(255,255,255,0.04)"}`, borderRadius: "8px", padding: "8px", minHeight: "78px", cursor: "pointer", transition: "all 0.15s ease" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: isToday ? "#00f0ff" : "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", marginBottom: "4px" }}>{day.getDate()}</div>
              {dayEvts.map(ev => (
                <div key={ev.id} style={{ padding: "3px 5px", borderRadius: "3px", marginBottom: "3px", background: `${ev.color}15`, borderLeft: `2px solid ${ev.color}`, fontSize: "9px", color: "#e0e0e0", fontFamily: "var(--mono)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <Card style={{ animation: "fadeIn 0.2s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <SL style={{ marginBottom: 0 }}>{new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</SL>
            <button onClick={() => setSelectedDate(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px" }}>×</button>
          </div>

          {/* Existing events */}
          {selectedEvents.length > 0 ? selectedEvents.map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "13px", color: "#e0e0e0", fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", marginTop: "2px" }}>{ev.product} · {ev.platform}</div>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeEvent(ev.id); }} style={{ background: "none", border: "none", color: "rgba(239,68,68,0.5)", cursor: "pointer", fontSize: "14px", padding: "4px" }}>×</button>
            </div>
          )) : <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", padding: "12px 0", fontFamily: "var(--mono)" }}>No content scheduled. Add something below.</div>}

          {/* Add new */}
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

const Home = ({ products, captures, templates, calEvents, setCalEvents, setTemplates, onSelect, onCreate, onCapture, sub, setSub, notify }) => {
  const totalPending = products.reduce((s, p) => s + (p.queue?.filter(q => q.status === "pending").length || 0), 0);

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px", marginBottom: "28px" }}>
          {products.map(p => {
            const pend = p.queue?.filter(q => q.status === "pending").length || 0;
            const total = LAUNCH_CHECKLIST.reduce((s, ph) => s + ph.items.length, 0);
            const done = Object.values(p.checklist || {}).filter(Boolean).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: "pointer", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent, ${p.color}, transparent)`, opacity: 0.6 }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0f0", fontFamily: "'Space Mono', monospace" }}>{p.name}</div>
                  <Badge color={p.status === "pre_launch" ? "#ffaa00" : "#22c55e"}>{p.status.replace("_", "-").toUpperCase()}</Badge>
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>{p.tagline}</div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", marginBottom: "8px" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, #22c55e, ${p.color})`, borderRadius: "2px", transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "flex", gap: "10px", fontSize: "10px", fontFamily: "var(--mono)" }}>
                  <span style={{ color: "#22c55e" }}>{pct}%</span>
                  {pend > 0 && <span style={{ color: "#ffaa00" }}>{pend} pending</span>}
                  {p.pressKit && <span style={{ color: "#a855f7" }}>Press kit ✓</span>}
                </div>
              </Card>
            );
          })}
          <Card onClick={onCreate} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "110px", borderStyle: "dashed" }}>
            <div style={{ fontSize: "28px", opacity: 0.3 }}>+</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)" }}>Add Product</div>
          </Card>
        </div>

        {captures.length > 0 && <>
          <SL>Quick Captures</SL>
          {captures.map(c => (
            <Card key={c.id} style={{ marginBottom: "6px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "#e0e0e0" }}>{c.text}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)", marginTop: "3px" }}>{products.find(p => p.id === c.productId)?.name} · {c.time}</div>
              </div>
              <Btn outline small>Expand →</Btn>
            </Card>
          ))}
        </>}
      </>}

      {sub === "calendar" && <Calendar events={calEvents} setEvents={setCalEvents} products={products} />}

      {sub === "templates" && <>
        <SL>Template Library</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>Reusable content patterns. Copy and customize, or load directly into a workflow.</div>
        {templates.map(t => (
          <Card key={t.id} style={{ marginBottom: "8px", padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#e0e0e0" }}>{t.name}</span>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Badge color="#a855f7">{t.type}</Badge>
                <Badge color="rgba(255,255,255,0.3)">{t.source}</Badge>
                <Btn onClick={() => copyToClipboard(t.content, notify)} outline small color="#22c55e" style={{ padding: "4px 10px", fontSize: "10px" }}>📋 Copy</Btn>
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

const ProductDash = ({ product: p, setProduct: setP, onBack, notify, templates = [] }) => {
  const [tab, setTab] = useState("overview");
  const [selWf, setSelWf] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [repInput, setRepInput] = useState("");
  const [repResults, setRepResults] = useState(null);
  const [pressUrl, setPressUrl] = useState(p.url || "");
  const [genStep, setGenStep] = useState("");
  const [generating, setGenerating] = useState(false);
  const [priceResult, setPriceResult] = useState(null);
  const [seoUrl, setSeoUrl] = useState(p.url || "");
  const [seoResult, setSeoResult] = useState(null);
  const [seoMethod, setSeoMethod] = useState("manual");

  const pending = p.queue?.filter(q => q.status === "pending").length || 0;
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

  const simulate = (steps, cb) => { setGenerating(true); let i = 0; const iv = setInterval(() => { if (i < steps.length) { setGenStep(steps[i]); i++; } else { clearInterval(iv); setGenerating(false); setGenStep(""); cb(); } }, 700); };

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
          {[{ l: "Pending", v: pending, c: "#ffaa00" }, { l: "Progress", v: `${pct}%`, c: "#22c55e" }, { l: "Press Kit", v: p.pressKit ? "Ready" : "—", c: p.pressKit ? "#22c55e" : "rgba(255,255,255,0.25)" }].map((s, i) => (
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

      {/* WORKFLOWS (flat) */}
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
          {/* Relevant templates for this workflow */}
          {(() => { const matching = templates.filter(t => t.tags?.some(tag => selWf.tags?.includes(tag))); return matching.length > 0 ? (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--mono)", marginBottom: "8px" }}>📄 Templates for this workflow</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                {matching.map(tmpl => (
                  <div key={tmpl.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)", borderRadius: "6px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#e0e0e0" }}>{tmpl.name}</div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", marginTop: "2px" }}>{tmpl.source}</div>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <Btn onClick={() => setTaskInput(tmpl.content)} outline small color="#a855f7" style={{ padding: "4px 10px", fontSize: "9px" }}>Load</Btn>
                      <Btn onClick={() => copyToClipboard(tmpl.content, notify)} outline small color="#22c55e" style={{ padding: "4px 10px", fontSize: "9px" }}>📋</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null; })()}
          <TA label="Instructions (optional)" value={taskInput} onChange={setTaskInput} placeholder="Add context or load a template above..." rows={2} />
          <Btn onClick={() => { setLaunching(true); setTimeout(() => { setLaunching(false); setSelWf(null); setTaskInput(""); notify(`Launched: ${selWf.name}`, selWf.color); }, 1200); }} disabled={launching} color={selWf.color}>
            {launching ? "⏳ Launching..." : `Launch: ${selWf.name}`}
          </Btn>
        </Card>}
      </div>}

      {/* PRESS KIT */}
      {tab === "press_kit" && <div>
        {!p.pressKit && !generating && <Card style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.6 }}>📦</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0", marginBottom: "16px" }}>Generate Press Kit from URL</div>
          <div style={{ display: "flex", gap: "8px", maxWidth: "460px", margin: "0 auto" }}>
            <input value={pressUrl} onChange={e => setPressUrl(e.target.value)} placeholder="https://..." style={{ flex: 1, padding: "10px 14px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e0e0e0", fontSize: "13px", fontFamily: "var(--mono)", outline: "none" }} />
            <Btn onClick={() => simulate(["Scraping page...", "Analyzing positioning...", "Extracting features...", "Generating copy...", "Compiling..."], () => { setP(pr => ({ ...pr, pressKit: { boilerplate: `${p.name} — ${p.tagline}. Built by VybeCod.ing. No code required.`, features: ["No-code interface", "Pro-grade output", "Cross-platform", "Built for creators"], audience: "Creators who want pro tools without coding.", assets: ["Logo (SVG/PNG)", "Screenshots (5)", "Headshot", "Brand PDF"] } })); notify("Press kit ready ✓", "#22c55e"); })} disabled={!pressUrl}>Generate</Btn>
          </div>
        </Card>}
        {generating && <Card style={{ textAlign: "center", padding: "50px" }}><div style={{ fontSize: "28px", marginBottom: "14px", animation: "pulse 1.5s infinite" }}>🔄</div><div style={{ fontSize: "13px", color: "#00f0ff", fontFamily: "var(--mono)" }}>{genStep}</div></Card>}
        {p.pressKit && !generating && <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><Badge color="#22c55e">READY</Badge><Btn onClick={() => setP(pr => ({ ...pr, pressKit: null }))} color="#ef4444" outline small>Regenerate</Btn></div>
          <Card><SL>Boilerplate</SL><p style={{ margin: 0, fontSize: "13px", color: "#e0e0e0", lineHeight: 1.7 }}>{p.pressKit.boilerplate}</p></Card>
          <Card><SL>Key Features</SL>{p.pressKit.features.map((f, i) => <div key={i} style={{ padding: "5px 0", fontSize: "12px", color: "#e0e0e0" }}>• {f}</div>)}</Card>
          <Card><SL>Media Assets</SL>{p.pressKit.assets.map((a, i) => <div key={i} style={{ padding: "5px 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>☐ {a}</div>)}</Card>
        </div>}
      </div>}

      {/* REPURPOSER */}
      {tab === "repurpose" && <div>
        <SL>Cross-Platform Repurposer</SL>
        {!repResults ? <Card>
          <TA label="Write your content once" value={repInput} onChange={setRepInput} placeholder="Paste any announcement, update, or idea..." rows={4} />
          <Btn onClick={() => { if (!repInput) return; setRepResults(PLATFORMS.slice(0, 6).map(pl => ({ ...pl, content: pl.id === "twitter" ? `🚀 ${repInput.substring(0, 220)}...\n\n#nocode #musicproduction` : pl.id === "reddit" ? `Hey everyone — ${repInput}\n\nWould love feedback from this community.` : pl.id === "linkedin" ? `Excited to share:\n\n${repInput}\n\nThoughts?` : `${repInput}\n\n${pl.id === "instagram" ? "#nocode #musicproduction #vst" : ""}` }))); notify("Repurposed for 6 platforms ✓", "#a855f7"); }}>Repurpose for All Platforms</Btn>
        </Card> : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Btn onClick={() => setRepResults(null)} color="#ef4444" outline small style={{ alignSelf: "flex-end" }}>Start Over</Btn>
          {repResults.map((r, i) => <Card key={i} style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}><span>{r.icon}</span><span style={{ fontSize: "12px", fontWeight: 700, color: r.color }}>{r.name}</span></div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.content}</div>
          </Card>)}
        </div>}
      </div>}

      {/* PRICING */}
      {tab === "pricing" && <div>
        <SL>Pricing Strategy Advisor</SL>
        {!priceResult ? <Card>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "14px" }}>Claude analyzes competitors, market positioning, and your product to suggest pricing tiers.</div>
          <Btn onClick={() => { setPriceResult({ tiers: [{ name: "Free", price: "$0", features: ["1 export/mo", "Basic blocks", "Community support"], rec: false }, { name: "Creator", price: "$19/mo", features: ["Unlimited exports", "Full library", "Preset sharing", "Email support"], rec: true }, { name: "Studio", price: "$49/mo", features: ["Everything in Creator", "Commercial license", "Priority support", "Custom blocks", "Team collab"], rec: false }], insights: ["Competitors charge $99-999 for similar capability", "Freemium→paid conversion: 5-8% typical in creative tools", "20% annual discount is standard for this market", "Consider launch pricing at 40% off for first 500 users"] }); notify("Pricing analysis ready ✓", "#22c55e"); }}>Analyze & Suggest Pricing</Btn>
        </Card> : <div>
          <Btn onClick={() => setPriceResult(null)} color="#ef4444" outline small style={{ marginBottom: "12px" }}>Re-analyze</Btn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
            {priceResult.tiers.map((t, i) => <Card key={i} style={{ textAlign: "center", border: t.rec ? `1px solid ${p.color}44` : undefined, background: t.rec ? `${p.color}06` : undefined, padding: "18px" }}>
              {t.rec && <Badge color={p.color}>RECOMMENDED</Badge>}
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#f0f0f0", fontFamily: "'Space Mono', monospace", margin: "10px 0 4px" }}>{t.name}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: p.color, fontFamily: "'Space Mono', monospace", marginBottom: "10px" }}>{t.price}</div>
              {t.features.map((f, j) => <div key={j} style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", padding: "3px 0" }}>✓ {f}</div>)}
            </Card>)}
          </div>
          <Card><SL>Market Insights</SL>{priceResult.insights.map((ins, i) => <div key={i} style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>→ {ins}</div>)}</Card>
        </div>}
      </div>}

      {/* SEO OPTIMIZER */}
      {tab === "seo" && <div>
        <SL>SEO Optimizer</SL>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "16px" }}>Analyze your site's metadata and get optimized tags, descriptions, and structured data — ready to deploy.</div>
        {!seoResult && !generating ? <Card>
          <Inp label="Product URL to analyze" value={seoUrl} onChange={setSeoUrl} placeholder="https://vybecod.ing/dsp" mono />
          <Btn onClick={() => simulate(
            ["Fetching page...", "Analyzing meta tags...", "Checking Open Graph...", "Evaluating keywords...", "Generating optimized metadata...", "Building structured data..."],
            () => { setSeoResult({
              current: {
                title: p.name || "My Product",
                description: "A cool product",
                ogTitle: "",
                ogDescription: "",
                ogImage: "",
                canonical: "",
                robots: "index, follow",
                keywords: "",
                score: 32,
                issues: ["Missing meta description (using default)", "No Open Graph tags found", "No Twitter Card meta tags", "Missing canonical URL", "No structured data (JSON-LD)", "Title too short — not keyword-rich", "No alt text on hero image"],
              },
              optimized: {
                title: `${p.name} — ${p.tagline} | VybeCod.ing`,
                description: `${p.name} lets ${(p.keywords || []).slice(0, 2).join(" and ")} creators build professional tools without writing code. ${p.tagline}.`,
                ogTitle: `${p.name} — ${p.tagline}`,
                ogDescription: `Build professional audio plugins without code. ${p.name} by VybeCod.ing.`,
                ogImage: `${p.url || "https://vybecod.ing"}/og-image.png`,
                canonical: p.url || "https://vybecod.ing/dsp",
                robots: "index, follow",
                keywords: (p.keywords || []).join(", "),
                twitterCard: "summary_large_image",
                jsonLd: `{\n  "@context": "https://schema.org",\n  "@type": "SoftwareApplication",\n  "name": "${p.name}",\n  "description": "${p.tagline}",\n  "url": "${p.url || "https://vybecod.ing"}",\n  "applicationCategory": "DeveloperApplication",\n  "operatingSystem": "Windows, macOS"\n}`,
                score: 94,
              },
            }); notify("SEO analysis complete ✓", "#22c55e"); }
          )} disabled={!seoUrl}>Analyze & Optimize</Btn>
        </Card> : generating ? <Card style={{ textAlign: "center", padding: "50px" }}><div style={{ fontSize: "28px", marginBottom: "14px", animation: "pulse 1.5s infinite" }}>🔎</div><div style={{ fontSize: "13px", color: "#00f0ff", fontFamily: "var(--mono)" }}>{genStep}</div></Card> : seoResult && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Score comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Card style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", marginBottom: "6px" }}>CURRENT SCORE</div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#ef4444", fontFamily: "'Space Mono', monospace" }}>{seoResult.current.score}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>/ 100</div>
            </Card>
            <Card style={{ textAlign: "center", background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.15)" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)", marginBottom: "6px" }}>OPTIMIZED SCORE</div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#22c55e", fontFamily: "'Space Mono', monospace" }}>{seoResult.optimized.score}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>/ 100</div>
            </Card>
          </div>

          {/* Issues found */}
          <Card>
            <SL>Issues Found ({seoResult.current.issues.length})</SL>
            {seoResult.current.issues.map((issue, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                <span style={{ color: "#ef4444", fontSize: "12px" }}>✗</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{issue}</span>
              </div>
            ))}
          </Card>

          {/* Optimized metadata with copy buttons */}
          <Card>
            <SL>Optimized Metadata</SL>
            {[
              { label: "Title Tag", value: seoResult.optimized.title },
              { label: "Meta Description", value: seoResult.optimized.description },
              { label: "OG Title", value: seoResult.optimized.ogTitle },
              { label: "OG Description", value: seoResult.optimized.ogDescription },
              { label: "OG Image URL", value: seoResult.optimized.ogImage },
              { label: "Canonical URL", value: seoResult.optimized.canonical },
              { label: "Keywords", value: seoResult.optimized.keywords },
              { label: "Twitter Card", value: seoResult.optimized.twitterCard },
            ].map((meta, i) => (
              <div key={i} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: "var(--mono)" }}>{meta.label}</span>
                  <button onClick={() => copyToClipboard(meta.value, notify)} style={{ background: "none", border: "none", color: "rgba(0,240,255,0.5)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--mono)" }}>📋 copy</button>
                </div>
                <div style={{ fontSize: "12px", color: "#e0e0e0", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: "6px", fontFamily: "var(--mono)", lineHeight: 1.5, wordBreak: "break-all" }}>{meta.value}</div>
              </div>
            ))}
          </Card>

          {/* JSON-LD */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <SL style={{ marginBottom: 0 }}>Structured Data (JSON-LD)</SL>
              <Btn onClick={() => copyToClipboard(`<script type="application/ld+json">\n${seoResult.optimized.jsonLd}\n</script>`, notify)} outline small color="#22c55e" style={{ padding: "4px 10px", fontSize: "10px" }}>📋 Copy Full Snippet</Btn>
            </div>
            <div style={{ fontSize: "11px", color: "#22c55e", padding: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {'<script type="application/ld+json">'}{"\n"}{seoResult.optimized.jsonLd}{"\n"}{"</script>"}
            </div>
          </Card>

          {/* Implementation method */}
          <Card>
            <SL>How to Apply</SL>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <Btn onClick={() => setSeoMethod("manual")} color={seoMethod === "manual" ? p.color : "rgba(255,255,255,0.2)"} outline={seoMethod !== "manual"} small>Manual / Header Injection</Btn>
              <Btn onClick={() => setSeoMethod("cms")} color={seoMethod === "cms" ? p.color : "rgba(255,255,255,0.2)"} outline={seoMethod !== "cms"} small>CMS OAuth (Coming Soon)</Btn>
            </div>
            {seoMethod === "manual" && <div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "12px", lineHeight: 1.6 }}>
                Copy the full HTML head block below and paste it into your site's {'<head>'} tag, or use your platform's custom header injection:
              </div>
              {(() => {
                const headBlock = `<!-- SEO Optimized by VybeCod.ing Launch Ops -->
<title>${seoResult.optimized.title}</title>
<meta name="description" content="${seoResult.optimized.description}" />
<meta name="keywords" content="${seoResult.optimized.keywords}" />
<link rel="canonical" href="${seoResult.optimized.canonical}" />
<meta property="og:title" content="${seoResult.optimized.ogTitle}" />
<meta property="og:description" content="${seoResult.optimized.ogDescription}" />
<meta property="og:image" content="${seoResult.optimized.ogImage}" />
<meta property="og:url" content="${seoResult.optimized.canonical}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="${seoResult.optimized.twitterCard}" />
<meta name="twitter:title" content="${seoResult.optimized.ogTitle}" />
<meta name="twitter:description" content="${seoResult.optimized.ogDescription}" />
<meta name="twitter:image" content="${seoResult.optimized.ogImage}" />
<script type="application/ld+json">
${seoResult.optimized.jsonLd}
</script>`;
                return <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
                    <Btn onClick={() => copyToClipboard(headBlock, notify)} color="#22c55e" small>📋 Copy Full Head Block</Btn>
                  </div>
                  <div style={{ fontSize: "10px", color: "#00f0ff", padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", fontFamily: "var(--mono)", whiteSpace: "pre-wrap", lineHeight: 1.7, maxHeight: "250px", overflow: "auto" }}>{headBlock}</div>
                </div>;
              })()}
              <div style={{ marginTop: "14px", fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Platform-specific guides:</div>
                <div>• <span style={{ color: "#e0e0e0" }}>WordPress</span> — Paste in Appearance → Theme Editor → header.php or use Yoast/RankMath</div>
                <div>• <span style={{ color: "#e0e0e0" }}>Webflow</span> — Project Settings → Custom Code → Head Code</div>
                <div>• <span style={{ color: "#e0e0e0" }}>Next.js</span> — Use {'<Head>'} component in pages/_app.js or layout.tsx metadata</div>
                <div>• <span style={{ color: "#e0e0e0" }}>HTML</span> — Paste directly inside {'<head>'} tag</div>
                <div>• <span style={{ color: "#e0e0e0" }}>Squarespace</span> — Settings → Advanced → Code Injection → Header</div>
              </div>
            </div>}
            {seoMethod === "cms" && <div style={{ textAlign: "center", padding: "30px" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.5 }}>🔗</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>CMS OAuth auto-update coming in v2</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "6px" }}>Will support WordPress, Webflow, Shopify, and Ghost</div>
            </div>}
          </Card>

          <Btn onClick={() => setSeoResult(null)} color="#ef4444" outline small style={{ alignSelf: "flex-end" }}>Re-analyze</Btn>
        </div>}
      </div>}

      {/* LAUNCH CHECKLIST (merged) */}
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
                  <input type="checkbox" checked={!!p.checklist?.[key]} onChange={e => setP(pr => ({ ...pr, checklist: { ...pr.checklist, [key]: e.target.checked } }))} style={{ accentColor: phase.color, width: "15px", height: "15px", marginTop: "1px", flexShrink: 0 }} />
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
        {p.queue?.length > 0 ? p.queue.map(q => {
          const wf = WORKFLOWS.find(w => w.id === q.workflow);
          return <Card key={q.id} style={{ marginBottom: "8px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                <span>{wf?.icon || "📋"}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#e0e0e0" }}>{q.workflow}</span>
                <Badge color={q.status === "pending" ? "#ffaa00" : q.status === "approved" ? "#22c55e" : "#ef4444"}>{q.status.toUpperCase()}</Badge>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--mono)" }}>{q.time}</span>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{q.preview}</div>
            </div>
            {q.status === "pending" && <div style={{ display: "flex", gap: "6px" }}>
              <Btn onClick={() => { setP(pr => ({ ...pr, queue: pr.queue.map(qi => qi.id === q.id ? { ...qi, status: "approved" } : qi) })); notify("Approved ✓", "#22c55e"); }} color="#22c55e" outline small>✓</Btn>
              <Btn onClick={() => { setP(pr => ({ ...pr, queue: pr.queue.map(qi => qi.id === q.id ? { ...qi, status: "rejected" } : qi) })); notify("Rejected", "#ef4444"); }} color="#ef4444" outline small>✗</Btn>
            </div>}
          </Card>;
        }) : <div style={{ textAlign: "center", padding: "50px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--mono)", fontSize: "12px" }}>Queue empty. Launch a workflow to populate it.</div>}
      </div>}

      {/* EDIT */}
      {tab === "edit" && <Card>
        <SL>Product Details</SL>
        <Inp label="Name" value={p.name} onChange={v => setP(pr => ({ ...pr, name: v }))} />
        <Inp label="Tagline" value={p.tagline} onChange={v => setP(pr => ({ ...pr, tagline: v }))} />
        <Inp label="URL" value={p.url || ""} onChange={v => setP(pr => ({ ...pr, url: v }))} mono />
        <TA label="Description (context for Claude)" value={p.description || ""} onChange={v => setP(pr => ({ ...pr, description: v }))} placeholder="What does this product do?" />
        <Tags label="Keywords" tags={p.keywords || []} onChange={v => setP(pr => ({ ...pr, keywords: v }))} placeholder="keyword..." />
        <Sel label="Color" value={p.color} onChange={v => setP(pr => ({ ...pr, color: v }))} options={[{ value: "#00f0ff", label: "Cyan" }, { value: "#a855f7", label: "Purple" }, { value: "#ff6b35", label: "Orange" }, { value: "#22c55e", label: "Green" }, { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" }]} />
      </Card>}
    </div>
  );
};

/* ═══════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════ */

const Settings = ({ settings: st, setSettings: setSt, onBack }) => {
  const [tab, setTab] = useState("platforms");
  const [saved, setSaved] = useState(false);

  const d = { platforms: PLATFORMS.reduce((a, p) => ({ ...a, [p.id]: { connected: false, handle: "", mode: "manual" } }), {}), brand: { name: "VybeCod.ing", tagline: "", tone: "creative", keywords: ["no-code", "creative tools"], avoid: ["corporate jargon"], elevator: "" }, prefs: { depth: "thorough", length: "medium", emoji: true, hashtags: "moderate", sources: true, taskNotif: true, approvalNotif: true, weeklyNotif: true, errorNotif: true }, api: { anthropic: "", sbUrl: "", sbKey: "" } };
  const s = { ...d, ...st, platforms: { ...d.platforms, ...st?.platforms }, prefs: { ...d.prefs, ...st?.prefs }, api: { ...d.api, ...st?.api } };
  const up = (k, f, v) => setSt(prev => ({ ...prev, [k]: { ...(prev?.[k] || d[k]), [f]: v } }));
  const upp = (id, f, v) => setSt(prev => ({ ...prev, platforms: { ...(prev?.platforms || d.platforms), [id]: { ...(prev?.platforms || d.platforms)[id], [f]: v } } }));

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px", fontFamily: "var(--mono)", padding: 0 }}>← Back</button><h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f0f0f0" }}>Settings</h2></div>
        <Btn onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} color={saved ? "#22c55e" : "#00f0ff"}>{saved ? "✓ Saved" : "Save"}</Btn>
      </div>

      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px", overflowX: "auto" }}>
        {[["platforms", "📱 Platforms"], ["brand", "🎨 Brand"], ["prefs", "⚙ Preferences"], ["api", "🔑 API Keys"]].map(([id, label]) => <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", whiteSpace: "nowrap", background: tab === id ? "rgba(0,240,255,0.1)" : "transparent", color: tab === id ? "#00f0ff" : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>)}
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

      {tab === "prefs" && <div>
        <Card>
          <SL>Agent Behavior</SL>
          <Sel label="Research Depth" value={s.prefs.depth} onChange={v => up("prefs", "depth", v)} options={[{ value: "quick", label: "Quick (1-3 sources)" }, { value: "thorough", label: "Thorough (5-8)" }, { value: "deep", label: "Deep (10+)" }]} />
          <Sel label="Content Length" value={s.prefs.length} onChange={v => up("prefs", "length", v)} options={[{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "long", label: "Long" }]} />
          <Sel label="Hashtags" value={s.prefs.hashtags} onChange={v => up("prefs", "hashtags", v)} options={[{ value: "none", label: "None" }, { value: "minimal", label: "1-3" }, { value: "moderate", label: "5-8" }, { value: "heavy", label: "10-15" }]} />
          {[{ k: "emoji", l: "Emoji in Posts" }, { k: "sources", l: "Cite Sources" }].map(i => <div key={i.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}><span style={{ fontSize: "13px", color: "#e0e0e0" }}>{i.l}</span><Toggle on={s.prefs[i.k]} onChange={v => up("prefs", i.k, v)} /></div>)}
        </Card>
        <Card style={{ marginTop: "10px" }}>
          <SL>Notifications</SL>
          {[{ k: "taskNotif", l: "Task Complete", c: "#00f0ff" }, { k: "approvalNotif", l: "Approval Reminders", c: "#ffaa00" }, { k: "weeklyNotif", l: "Weekly Digest", c: "#a855f7" }, { k: "errorNotif", l: "Error Alerts", c: "#ef4444" }].map(n => <div key={n.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}><span style={{ fontSize: "13px", color: "#e0e0e0" }}>{n.l}</span><Toggle on={s.prefs[n.k]} onChange={v => up("prefs", n.k, v)} color={n.c} /></div>)}
        </Card>
      </div>}

      {tab === "api" && <Card>
        <SL>API Keys</SL>
        <div style={{ padding: "8px 12px", borderRadius: "6px", marginBottom: "14px", background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.15)", fontSize: "10px", color: "#ffaa00", fontFamily: "var(--mono)" }}>⚠ Stored locally, sent only to your backend</div>
        <Inp label="Anthropic Key" value={s.api.anthropic} onChange={v => up("api", "anthropic", v)} placeholder="sk-ant-..." type="password" mono />
        <Inp label="Supabase URL" value={s.api.sbUrl} onChange={v => up("api", "sbUrl", v)} placeholder="https://xxx.supabase.co" mono />
        <Inp label="Supabase Key" value={s.api.sbKey} onChange={v => up("api", "sbKey", v)} placeholder="eyJ..." type="password" mono />
      </Card>}
    </div>
  );
};

/* ═══════════════════════════════════════
   CREATE PRODUCT MODAL
   ═══════════════════════════════════════ */

const CreateModal = ({ onClose, onCreate }) => {
  const [n, setN] = useState(""); const [t, setT] = useState(""); const [u, setU] = useState(""); const [c, setC] = useState("#00f0ff");
  return <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "440px", animation: "slideIn 0.3s ease" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f0f0f0" }}>New Product</h3>
      <Inp label="Name" value={n} onChange={setN} placeholder="e.g., VybeCode DSP" />
      <Inp label="Tagline" value={t} onChange={setT} placeholder="One-liner" />
      <Inp label="URL (optional)" value={u} onChange={setU} placeholder="https://..." mono />
      <Sel label="Color" value={c} onChange={setC} options={[{ value: "#00f0ff", label: "Cyan" }, { value: "#a855f7", label: "Purple" }, { value: "#ff6b35", label: "Orange" }, { value: "#22c55e", label: "Green" }, { value: "#3b82f6", label: "Blue" }, { value: "#ec4899", label: "Pink" }]} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <Btn onClick={() => n && onCreate({ id: uid(), name: n, tagline: t, url: u, color: c, status: "pre_launch", pressKit: null, checklist: {}, queue: [], keywords: [], description: "" })} disabled={!n} style={{ flex: 1 }}>Create</Btn>
        <Btn onClick={onClose} color="#ef4444" outline>Cancel</Btn>
      </div>
    </div>
  </div>;
};

/* ═══════════════════════════════════════
   APP
   ═══════════════════════════════════════ */

export default function App() {
  const [view, setView] = useState("home");
  const [sub, setSub] = useState("products");
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [selId, setSelId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notif, setNotif] = useState(null);
  const [settings, setSettings] = useState({});
  const [captures, setCaptures] = useState([]);
  const [templates, setTemplates] = useState(SAMPLE_TEMPLATES);
  const [calEvents, setCalEvents] = useState([
    { id: uid(), date: "2026-03-18", product: "VybeCode DSP", platform: "twitter", title: "Teaser post #1", color: "#00f0ff" },
    { id: uid(), date: "2026-03-20", product: "VybeCode DSP", platform: "website", title: "Behind the scenes blog", color: "#00f0ff" },
    { id: uid(), date: "2026-03-22", product: "VybeCode DSP", platform: "instagram", title: "Feature showcase reel", color: "#00f0ff" },
    { id: uid(), date: "2026-03-25", product: "VybeCode DSP", platform: "email", title: "Launch countdown email", color: "#00f0ff" },
  ]);

  const notify = (msg, color) => { setNotif({ msg, color }); setTimeout(() => setNotif(null), 3000); };
  const selProduct = products.find(p => p.id === selId);
  const setSelProduct = fn => setProducts(ps => ps.map(p => p.id === selId ? (typeof fn === "function" ? fn(p) : fn) : p));

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
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={p => { setProducts(ps => [...ps, p]); setShowCreate(false); notify(`${p.name} created ✓`, "#22c55e"); }} />}

      {/* Header */}
      <div style={{ padding: "18px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.01)", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }} onClick={() => { setView("home"); setSelId(null); setSub("products"); }}>
          <div style={{ width: 34, height: 34, borderRadius: "8px", background: "linear-gradient(135deg, #00f0ff, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 900, color: "#0a0a0f", fontFamily: "'Space Mono', monospace" }}>V</div>
          <div><div style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>VybeCod<span style={{ color: "#00f0ff" }}>.</span>ing</div><div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Launch Operations</div></div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[["home", "Command Center"], ["settings", "⚙ Settings"]].map(([id, label]) => <button key={id} onClick={() => { setView(id); setSelId(null); }} style={{ padding: "7px 16px", borderRadius: "6px", border: "none", background: view === id && !selId ? "rgba(255,255,255,0.08)" : "transparent", color: view === id && !selId ? "#f0f0f0" : "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--mono)" }}>{label}</button>)}
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
        {view === "home" && !selId && <Home products={products} captures={captures} templates={templates} calEvents={calEvents} setCalEvents={setCalEvents} setTemplates={setTemplates} onSelect={id => { setSelId(id); setView("product"); }} onCreate={() => setShowCreate(true)} onCapture={c => { setCaptures(cs => [c, ...cs]); notify("Captured ⚡", "#a855f7"); }} sub={sub} setSub={setSub} notify={notify} />}
        {selId && selProduct && <ProductDash product={selProduct} setProduct={setSelProduct} onBack={() => { setSelId(null); setView("home"); }} notify={notify} templates={templates} />}
        {view === "settings" && !selId && <Settings settings={settings} setSettings={setSettings} onBack={() => setView("home")} />}
      </div>
    </div>
  );
}
