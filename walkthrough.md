# Walkthrough - Website Audit Pipeline

The Website Audit Pipeline is now fully implemented with a Python/FastAPI backend and a React/Vite/Tailwind frontend.

## Key Features

1. **Multi-domain Audit CSV Upload**:
   - Accepts CSV files containing website domains.
   - Creates asynchronous background jobs, preventing frontend blocking.

2. **Modular Audit Heuristics**:
   - **SEO**: Validates title, meta descriptions, canonical structures, H1/H2 configurations, alt tags, and Open Graph tags.
   - **Performance**: Estimates metrics derived from actual page loading performance (FCP, LCP, CLS, DOM size).
   - **Accessibility**: Audits landmarks, ARIA labeling, heading structure hierarchy, and viewport zoom-legibility.
   - **Security**: Analyzes HTTP headers (CSP, HSTS, XSS, Frame Options, nosniff, Referrer Policy) and SSL configurations.
   - **Design Score**: Assesses hero headers, readability parameters, modern elements (cards, spacing), and deprecated HTML tags.

3. **Premium UI Dashboard**:
   - Sidebar matching Vercel/Linear style aesthetics.
   - Recharts graphs visualizing average scores and score distributions.
   - Interactive detailed results table with domain searching and scores.
   - Radar charts detailing specific metrics per audited site.

---

## Technical Details

- **Backend**: FastAPI, SQLAlchemy (SQLite), Playwright Chromium, BeautifulSoup, and pandas.
- Backend: FastAPI, SQLAlchemy (SQLite), Playwright Chromium, BeautifulSoup, and pandas.
- **Frontend**: Vite + React, Tailwind CSS (v4), Lucide Icons, Recharts.
- **Server Ports**:
  - Backend: `http://localhost:8000`
  - Frontend: Running locally on Vite's default dev port (typically `http://localhost:5173`)

## Recent Fixes

- **SQLite Job Creation Race Condition Fix**: Resolved a critical race condition where the background worker scanned a new job and immediately marked it as `finished` because the job record was committed to the database before its corresponding audit results were created. Now, both the `Job` and all `AuditResult` items are committed atomically in a single SQLite transaction.
- **Clickable Domain Links**: Wrapped the domain names in the results list table with anchor tags, allowing users to directly click a domain to open it in a new browser tab.
- **Design Score Sorting**: Added "Highest Design Score" and "Lowest Design Score" options to the results sort dropdown filter, allowing users to arrange audits based on design compliance scores.
- **Job History Dropdown Filter**: Added a dropdown select filter to the "Results" tab that allows users to easily filter audit results to show only those belonging to a specific selected audit job.
- **Robust Screenshot Captures**: Modified the Playwright worker logic to catch page navigation errors or timeouts and still trigger screenshot capture for whatever has finished loading. Set Playwright's `wait_until` to `domcontentloaded` for fast and reliable captures.



- **SQLAlchemy DetachedInstanceError Fix**: Fixed a critical background worker crash where the worker failed with `DetachedInstanceError` when attempting to access the `Settings` object in the async task after its parent session had closed. The worker now safely queries settings within its own active database session.
- **Worker Loop Closure Binding Fix**: Fixed a bug where background worker tasks all audited the last domain in the queued list. Evaluated the domain at definition time by binding `res.domain` as a default parameter (`domain=res.domain`) in the worker's asynchronous task dispatching.
- **Playwright Sync Thread Pool Refactor**: Bypassed a Windows-specific Uvicorn/asyncio limitation where executing Playwright asynchronously would raise `NotImplementedError` when attempting to create subprocesses. The browser audits are now offloaded to a background thread pool executor using Playwright's `sync_api`, which runs flawlessly on Windows.


- **BeautifulSoup TypeError Fix**: Fixed a TypeError crash in the SEO auditor (`Tag.find() got multiple values for argument 'name'`) when looking up the `twitter:card` meta tag. Refactored the finder method to search via the `attrs` dictionary parameter (`attrs={'name': 'twitter:card'}`) rather than the overloaded `name` keyword argument.
- **Tailwind CSS v4 Configuration**: Fixed compilation issues with `@tailwindcss/postcss` and Tailwind v4. Changed the deprecated `@tailwind base; @tailwind components; @tailwind utilities;` directives in [index.css](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Leads%20Qualifier/frontend/src/index.css) to the standard `@import "tailwindcss";` syntax, resolving the `Cannot apply unknown utility class 'bg-neutral-950'` compilation error.





