# CLAUDE.md — VybeCod.ing Launch Ops

## What This Project Is

VybeCod.ing Launch Ops is a **multi-product launch operations platform** — an internal tool that uses Claude AI to automate marketing, outreach, SEO, content generation, and launch coordination across multiple software products simultaneously.

It is built for **Pimpy**, who runs VybeCod.ing — a brand empowering non-technical creatives to build professional tools (flagship product: VybeCode DSP, a no-code audio plugin builder). Pimpy develops 6-10 software products at once and needs this platform to handle all launch operations without a marketing team.

**This is an internal tool, not a public SaaS (yet).** Build it as a polished, production-grade internal app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, Pydantic v2 |
| **Database** | PostgreSQL (Railway, via asyncpg) |
| **AI Engine** | Anthropic Claude API (claude-sonnet-4-20250514) with web search tool |
| **Frontend** | React 18, Vite, inline styles (no Tailwind/CSS framework) |
| **Deployment** | Railway PRO (Docker) |

---

## Project Structure

```
vybecoding-launchops/
├── CLAUDE.md                          ← You are here
├── SETUP_PROMPT.md                    ← Starting prompt for Claude Code
├── SOURCE_MAP.md                      ← What each file does
├── .gitignore
├── backend/
│   ├── main.py                        # FastAPI app factory, CORS, router registration
│   ├── config.py                      # Pydantic settings from env vars
│   ├── database.py                    # Supabase client + CRUD helpers + SQL schema
│   ├── models.py                      # 25+ Pydantic models for all endpoints
│   ├── requirements.txt               # Python dependencies
│   ├── Dockerfile                     # Railway-ready container
│   ├── railway.toml                   # Railway deploy config
│   ├── .env.example                   # Env var template
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── products.py                # Product CRUD + checklist
│   │   ├── workflows.py              # AI engine: all 13 workflows + press kit + SEO + repurpose + pricing
│   │   ├── queue.py                   # Approval queue management
│   │   └── extras.py                  # Templates, calendar, captures, settings
│   └── services/
│       ├── __init__.py
│       ├── claude.py                  # Claude API wrapper + SANDBOX_MODE toggle + all system prompts
│       └── scraper.py                 # HTML metadata parser for press kit & SEO
├── frontend/
│   ├── package.json                   # Vite + React dependencies
│   ├── vite.config.js                 # Dev server with /api proxy to backend
│   ├── index.html                     # HTML entry
│   └── src/
│       ├── main.jsx                   # React mount
│       ├── App.jsx                    # Full application (~900 lines, single-file MVP)
│       └── api.js                     # Centralized API helper for all backend calls
```

---

## Architecture

```
React Frontend (Vite)
    ↓ fetch via api.js
FastAPI Backend
    ├── CRUD → Supabase (products, queue, templates, calendar, captures, settings)
    ├── AI Workflows → Claude API (with web_search tool)
    │   └── Background tasks: API returns task_id immediately, Claude runs async,
    │       results land in approval queue when done
    └── URL Scraping → httpx + custom HTML parser (for press kit & SEO)
```

**Key pattern:** ALL AI-generated content flows through the **approval queue**. Nothing goes out without human review. Workflows run as FastAPI `BackgroundTasks`.

---

## MVP Features (10)

1. **Product Hub** — Create/manage multiple products, each with its own dashboard
2. **Quick Capture** — One-liner input that gets queued for later expansion
3. **Press Kit Creator** — Feed a URL → scrape → Claude generates complete press kit
4. **AI Workflows** (13) — Flat list: competitor analysis, trend reports, press targets, cold outreach, partnerships, social posts, ad copy, blog drafts, announcements, Reddit communities, directories, launch platforms, podcasts
5. **Cross-Platform Repurposer** — Write once → Claude adapts for Twitter, Instagram, LinkedIn, Reddit, TikTok, Facebook
6. **Approval Queue** — Review/approve/reject all AI outputs before use
7. **Launch Checklist** — Merged pre-launch (15 items) + launch day (11 timed items) + post-launch (7 items)
8. **Pricing Advisor** — Claude analyzes competitors and suggests pricing tiers
9. **Template Library** — Save reusable content patterns with tag-based matching to workflows
10. **Dynamic Content Calendar** — Click any day → editable task list per day
11. **SEO Optimizer** — Analyze URL metadata → generate optimized tags + JSON-LD + full head block with manual injection guide + CMS OAuth placeholder

---

## Critical Implementation Details

### Claude API Integration (`services/claude.py`)

- **SANDBOX_MODE toggle** at the top of the file. When `True`, returns mock data. When `False`, calls the real API.
- Every Claude call gets **brand context injected** via `build_brand_context()` — brand voice, product details, and agent preferences from settings.
- All 13 workflow prompts are stored in the `WORKFLOW_PROMPTS` dict. Each has a system prompt template with `{brand_context}` placeholder and optional tools.
- Specialized prompts exist for press kit, SEO, repurpose, and pricing.
- Claude responses are expected as **structured JSON**. The `_parse_json_response()` helper handles markdown fence stripping.

### Template Matching

Templates have `tags` (e.g., `["outreach", "email"]`). Workflows have matching tags. The `/api/templates/for-workflow/{id}` endpoint returns templates whose tags overlap with the workflow's tags. This powers the contextual template suggestions in the UI.

### URL Scraping (`services/scraper.py`)

Custom `HTMLParser` subclass that extracts: title, meta description, OG tags, Twitter Card tags, canonical URL, JSON-LD, headings (h1-h3), and body text. Used by both press kit generation and SEO analysis.

### Frontend State

The React app currently uses local state (useState). It has mock data for demo purposes. The `api.js` module is ready — all functions match the backend endpoints. **The main task is wiring App.jsx to use api.js instead of local mock state.**

---

## Development Commands

### Backend
```bash
cd backend
python -m pip install -r requirements.txt
cp .env.example .env
# Fill in .env with real keys
python -m uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Dev server: http://localhost:5173 (proxies /api to :8000)
```

### Database Setup
Run the SQL from `database.py` (the `SETUP_SQL` variable) in the Supabase SQL editor to create all tables.

---

## Design System

- **Background:** `#08080d`
- **Card background:** `rgba(255,255,255,0.03)` with `1px solid rgba(255,255,255,0.06)` border
- **Accent colors per module:** Cyan `#00f0ff` (research), Orange `#ff6b35` (outreach), Purple `#a855f7` (content), Green `#22c55e` (opportunity)
- **Fonts:** Space Mono (headings), JetBrains Mono (labels/code), Inter (body)
- **Status colors:** Pending `#ffaa00`, Approved `#22c55e`, Rejected `#ef4444`, Running `#00f0ff`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `CLAUDE_MODEL` | Model ID (default: `claude-sonnet-4-20250514`) |
| `DATABASE_URL` | PostgreSQL connection string (Railway provides this) |
| `SECRET_KEY` | App secret for sessions |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `DEBUG` | `true` / `false` |

---

## PIP Note

The developer cannot configure pip/python in system PATH on Windows. Always use `python -m pip` and `python -m uvicorn` instead of bare `pip` / `uvicorn` commands.

---

## Railway Deployment

The backend deploys via Dockerfile. Set all env vars in Railway dashboard. The frontend builds to static files and can be served from a separate Railway service with nginx/caddy, or combined into the backend service serving static files.

---

## What Needs To Happen Next

See `SETUP_PROMPT.md` for the exact sequence of tasks.
