# SOURCE_MAP.md — File-by-File Reference

## Backend

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | ~60 | FastAPI app factory. Creates app, adds CORS, registers all 7 routers, defines `/` and `/health` endpoints. |
| `config.py` | ~35 | Pydantic `BaseSettings` loading env vars. Cached singleton via `get_settings()`. |
| `database.py` | ~120 | Supabase client singleton + 5 CRUD helpers (`insert`, `select`, `select_one`, `update`, `delete`) + full `SETUP_SQL` schema for 6 tables. |
| `models.py` | ~200 | All Pydantic models: Product, QueueItem, WorkflowRequest/Response, PressKit, SEOResult, RepurposeRequest, PricingResult, Template, CalendarEvent, Capture, GlobalSettings, and supporting enums. |
| `routers/products.py` | ~55 | CRUD for products table + checklist update endpoint. |
| `routers/workflows.py` | ~200 | **Core AI engine.** `POST /api/workflows/launch` runs any of 13 workflows as background tasks. Also handles press kit generation, SEO analysis, content repurposing, and pricing analysis. All results go to the queue. |
| `routers/queue.py` | ~45 | List/get/update/delete queue items. Update accepts approve/reject status. |
| `routers/extras.py` | ~160 | Templates (with tag-based workflow matching), calendar events, quick captures, and global settings. |
| `services/claude.py` | ~300 | **Claude API wrapper.** `SANDBOX_MODE` toggle, `call_claude()` with production/sandbox paths, `build_brand_context()`, 13 workflow system prompts in `WORKFLOW_PROMPTS` dict, plus specialized prompts for press kit, SEO, repurpose, pricing. |
| `services/scraper.py` | ~150 | `MetadataParser(HTMLParser)` extracts all meta tags, OG data, Twitter Cards, canonical, JSON-LD, headings, body text from a URL. `scrape_url()` async function. |

## Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.jsx` | ~900 | **Entire UI.** Command Center (quick capture, product grid, calendar, templates), Product Dashboard (overview, workflows, press kit, repurposer, pricing, SEO, checklist, queue, edit), Settings (platforms, brand, prefs, API keys). Currently uses local state with mock data. |
| `src/api.js` | ~100 | Centralized fetch wrapper. Exports objects matching every backend resource: `products`, `workflows`, `pressKit`, `seo`, `repurpose`, `pricing`, `queue`, `templates`, `calendar`, `captures`, `settings`. Each has methods like `.list()`, `.create(data)`, etc. |
| `src/main.jsx` | ~8 | React mount point. |
| `vite.config.js` | ~15 | Vite config with `/api` proxy to `localhost:8000` for local dev. |

## Config Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Python 3.12 slim, pip install, uvicorn on port 8000 |
| `railway.toml` | Railway deploy config with `/health` healthcheck |
| `.env.example` | Template for all required environment variables |
| `.gitignore` | Python + Node + IDE + OS ignores |
