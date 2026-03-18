# SETUP_PROMPT.md — Starting Prompt for Claude Code

Copy and paste the block below into Claude Code to initiate the project setup.

---

```
Read CLAUDE.md and SOURCE_MAP.md thoroughly before doing anything.

This is the VybeCod.ing Launch Ops project — a multi-product launch operations platform with a FastAPI backend and React frontend. The codebase is scaffolded and the architecture is complete. Your job is to make it production-ready.

## Important notes about my environment:
- Always use `python -m pip` instead of `pip` (I can't set pip in my system PATH)
- Always use `python -m uvicorn` instead of `uvicorn`
- I'm on Windows 11

## Phase 1: Environment Setup
1. Set up the backend virtual environment and install dependencies
2. Verify the backend starts cleanly with `python -m uvicorn main:app --reload --port 8000`
3. Set up the frontend with `npm install` and verify `npm run dev` works
4. Confirm both run simultaneously (backend on :8000, frontend on :5173 with /api proxy)

## Phase 2: Database
1. Read the SETUP_SQL from backend/database.py
2. Guide me through running it in Supabase SQL editor (I'll paste it)
3. Verify connectivity once I provide my Supabase URL and key in .env

## Phase 3: Wire Frontend to Backend
This is the main integration task. The React app (frontend/src/App.jsx) currently uses local mock state. The API helper (frontend/src/api.js) is ready with all endpoint functions. Wire them together:

1. **Products**: Replace SAMPLE_PRODUCTS with live data from api.products.list(). Add useEffect to load on mount. Wire create/update/delete.
2. **Queue**: Replace MOCK_QUEUE with api.queue.list({product_id}). Wire approve/reject to api.queue.update().
3. **Workflows**: Wire the "Launch" button to api.workflows.launch(). Show running state, poll for completion.
4. **Press Kit**: Wire "Generate" button to api.pressKit.generate(). Show loading state during generation.
5. **SEO**: Wire "Analyze" button to api.seo.analyze(). Display real results.
6. **Repurposer**: Wire to api.repurpose.create(). Display platform-adapted results.
7. **Pricing**: Wire to api.pricing.analyze(). Display tier recommendations.
8. **Templates**: Load from api.templates.list(). Wire copy buttons. Wire the for-workflow matching via api.templates.forWorkflow(). Wire "Save as Template" from queue items.
9. **Calendar**: Load from api.calendar.list(). Wire add/delete events.
10. **Quick Captures**: Wire to api.captures.create(). Load list from api.captures.list().
11. **Settings**: Load from api.settings.get(). Wire save to api.settings.update().

For each integration:
- Add loading states
- Add error handling with user-visible notifications
- Preserve the existing UI/UX exactly — only replace data sources

## Phase 4: Testing
1. Create a test product via the UI
2. Launch a workflow and verify it appears in the queue
3. Test the press kit generator with a real URL
4. Test the SEO analyzer
5. Test the repurposer
6. Test the approval queue flow
7. Verify settings persist across page reloads

## Phase 5: Deployment Prep
1. Verify the Dockerfile builds correctly
2. Guide me through Railway deployment
3. Update CORS_ORIGINS for the production frontend URL
4. Set SANDBOX_MODE = False in services/claude.py
5. Final smoke test on Railway

Work through each phase sequentially. Ask me for credentials/URLs when you need them. Don't skip ahead — verify each phase works before moving to the next.
```
