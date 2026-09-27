import { defineConfig } from '@playwright/test'

// Live smoke test: real FastAPI backend (dev auth, in-memory store) + UI in live mode.
export default defineConfig({
  testDir: './e2e-live',
  timeout: 30_000,
  reporter: 'list',
  workers: 1,
  // Dedicated, uncommon ports for both servers, always freshly started (reuseExistingServer:
  // false) — never attach to a server this suite didn't start itself. See playwright.config.ts
  // for why this matters (a stranger's app was once found listening on a "standard" port).
  use: { baseURL: 'http://localhost:5194', viewport: { width: 1440, height: 900 } },
  webServer: [
    {
      command: '.venv\\Scripts\\python -m uvicorn api.main:app --port 8010',
      cwd: '..',
      url: 'http://localhost:8010/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { AUTH_MODE: 'dev', DEV_ROLE: 'clinician', CORS_ORIGINS: 'http://localhost:5194', RATE_LIMIT_PER_MIN: '600' },
    },
    {
      command: 'npm run dev -- --port 5194 --strictPort',
      url: 'http://localhost:5194',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_MODE: 'live', VITE_API_URL: 'http://localhost:8010' },
    },
  ],
})
