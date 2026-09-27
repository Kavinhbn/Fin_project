import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  // Dedicated, uncommon port + reuseExistingServer:false: this suite must never silently attach
  // to someone else's server on a common port like 5173 and test the wrong app (see incident
  // 2026-09-27 — a stranger's app was listening on 5173 and this suite happily ran against it).
  use: { baseURL: 'http://localhost:5183', viewport: { width: 1440, height: 900 } },
  // env overrides force mock mode regardless of a local .env.local (Vite lets real process.env
  // win over .env files) — this suite must never accidentally inherit live mode from a
  // developer's local override and silently fail every test on a missing backend.
  webServer: { command: 'npm run dev -- --port 5183 --strictPort', url: 'http://localhost:5183', reuseExistingServer: false, timeout: 60_000, env: { VITE_API_MODE: 'mock', VITE_API_URL: '' } },
})
