# DESIGN_PATTERNS.md

Rules applied in this UI. Copy these patterns; do not invent new ones. Product working name is the constant `PRODUCT_NAME` in `src/app/context.tsx`.

## Governing rule: restraint
- Colour marks state only (risk level, verifier result, AI tag, real warnings). No tinted headers, chips or decorative icons. Icons identify actions or navigation only.
- Hierarchy comes from type weight and size, uppercase `.eyebrow` labels, 1px rules and near-white fills.
- Buttons: `primary` (brand) or `secondary` (outlined); `danger` only for destructive confirms. Labels carry meaning.
- Figures use `.font-mono-fig` (monospace, tabular). They are never coloured.

## Tokens (`src/index.css`, `:root`)
- All colours, spacing, radii, shadows, easing, fonts come from tokens. Never write a new hex. Charts use `var(--…)` in SVG/recharts props.
- Brand (medical navy-teal): `--color-brand #0B4F6C`, light `#E6F0F4`, dark `#083A50`.
- **Deliberate deviation:** `--color-text-secondary` is `#5B6779` (template `#64748B` failed WCAG AA on `--color-bg`, caught by the axe scan). `--color-text-tertiary` (`#94A3B8`, ~2.6:1 on white) is never used for text.
- Neutral surfaces/overlays: `--color-bg-subtle #FBFBFB` (tab panel body), `--color-scrim rgba(15,23,42,.4)` (modal/drawer backdrop). Defined once in `index.css`.
- Fonts: DM Sans (`.font-display`) for headings and big numbers only; Inter for everything else; JetBrains Mono for IDs and figures.

## Status colour lives in one map
- `src/ui/StatusBadge.tsx` `STATUS` maps status key -> label + tone. Never hardcode a status colour elsewhere.
- **Deliberate deviation:** badge label text stays `--color-text-primary`; the tone appears as a background tint plus a dot, because green/amber/red text fails AA as small text.
- Risk is never colour alone: every level has a text label (Low, Moderate, High, Uncertain), and each probability is shown as a number and a plain bar.
- Tone meaning: sky = uncertain/abstain (conformal), violet = AI-generated, muted = not assessed / not run.

## Layout
- Shell: white collapsible sidebar (240 → 72px, 400ms, auto-collapses under 1024px), grouped numbered nav, 20px icons stroke 1.75, active item filled brand with white text. Role-gated items (Audit log) are removed from the nav by server-provided role.
- Two persistent strips above content: (1) mock-mode banner "Demo data…", shown only when `VITE_API_MODE` is not `live`; (2) the physician-sign-off disclaimer, text supplied by the API so UI and backend cannot drift. Neither is dismissable.
- **Archetype B** (flat page): `p-6 flex flex-col gap-6 h-full overflow-y-auto min-h-0` — Assess, Evidence, Audit, Assessments list.
- **Archetype A** (card shell with tabs): `TabShell` in `src/ui/Layout.tsx` — sticky header + folder tabs, one scroll container below, `min-h-0` on every flex ancestor. Used inside the detail drawer (`bare`).
- Page header on every page: title + subtitle left; Feature-mode dropdown (Strict/Full), actions slot and identity right. Feature mode is a real switch, not decoration: it changes the model the UI talks to. No search pill (nothing to search yet; add only with a real function).
- Detail views use the wide `Drawer`; master/detail lists use `SplitPane`. Modal, Drawer share one `Layer` implementation. Do not build another overlay.

## Components
- Table (`ui/Table.tsx`): TanStack flex-row divs, sticky `--color-bg` header, 10px uppercase sortable labels with 11px chevrons, 2px brand left accent on row hover/focus, keyboard-activatable rows, `min-w` for horizontal scroll, footer "Showing x–y of n", empty state = bold line + one-line hint. `@tanstack/react-table` is pinned to v8 on purpose.
- Filter bar: labelled controls above the table, shared `Dropdown` (custom listbox, keyboard operable). Never a bare `<select>`.
- `KpiCard`: rounded-2xl, 1px border, 28px display number, CI as sub-line, optional progress bar; hover lift with brand-tinted shadow.
- `Field`: schema-driven (`FieldSchema[]` → number / radio / text), inline errors with role="alert", hint text from the shared ranges.
- Feedback: `FeedbackProvider` gives `toast()` and promise-based `confirm()`. Never `alert()`/`confirm()`.
- Charts: recharts for calibration; hand-built SVG/div for SHAP bars, pathway bar and the cascade graph so direction and labels are stated in text.
- Icons: lucide only, sizes 20 nav / 16 header buttons / 14 inside buttons / 11 sort chevrons.

## Motion
House curve `--ease-out`. Hover/press 100–150ms, content fade 200ms, drawer 350ms, sidebar 400ms, progress fill 700ms, card hover lift 2px. `prefers-reduced-motion` collapses all durations.

## States (every screen)
Loading skeleton (never blank) · empty · error with retry · read-only role (banner explains why, content stays visible) · optimistic save with rollback + toast on failure (Mark reviewed, with 409 version guard) · destructive/irreversible confirm dialog.

## Data and security rules
- All persistence goes through the API (`src/api/client.ts`). `VITE_API_MODE=live` uses fetch with cookies (IAP); default is the in-memory mock (`src/api/mock.ts`). No `localStorage`; only the in-memory stale-while-revalidate cache (`src/api/cache.ts`).
- Role comes from `GET /me` (server claims). The UI hides nav and disables actions for convenience only; the server enforces.
- Clinical ranges in `src/api/ranges.ts` are copied from `common/config.py`; the backend re-validates every request. No clinical thresholds live in the UI: risk levels come from the API.
- Mock data is labelled as such and is never shown as model output.

## Accessibility
Visible brand focus ring, full keyboard operation (tested), `aria-label` on icon-only buttons, dialogs with `role="dialog"` + Esc + focus return, radio groups as fieldsets, tabs with correct roles, tables with ARIA roles and `aria-sort`. axe (wcag2a/aa) reports zero serious/critical violations on all screens in the Playwright suite.

## Engineering
- Named exports only; TypeScript strict, `verbatimModuleSyntax`, no enums; section banners `// ─── Section ───`.
- Every change ends with `npm run build` passing and `npx playwright test` green (13 tests: shell, validation, full flow, filters, mode switch, roles, narrow layout, keyboard path, axe).
- Overlays: `Layer` keeps a stack (only the topmost handles Esc/Tab), traps Tab and restores focus on close; the drawer repeats the sign-off disclaimer because it covers the strips. `invalidate(prefix)` makes mounted `useResource` hooks refetch. Mark reviewed keeps the "Awaiting review" badge and a loading button until the server confirms. Known gaps: Dropdown/Modal are hand-rolled; fonts load from Google Fonts (self-host if the IAP CSP blocks it); bundle is one 700 kB chunk (code-split later); Playwright screenshots in `test-results/` are for review only.
