# Responsive roadmap — PSM

Foundation (Phase 0) defines shared breakpoints for SCSS and TypeScript.

**Phase 1 (done):** mobile drawer for sidebar + primary nav, burger in Navbar, Redux `ui.sidebarOpen`, tablet/desktop keep inline sidebar and top nav.

**Phase 2 (done):** Stock pilot — card rows on phone, compact header/search, hidden table header, FIFO panel + modals as bottom sheets, `e2e/mobile/stock.spec.ts`.

**Phase 3 (done):** Field flows — login touch targets, journal shell/toolbar, counter reading form, journal list cards (parts/toner/lists), bottom-sheet modals (`AddReplacedPart`, `NotificationModal`), parts inventorization cards, `e2e/mobile/journal.spec.ts`.

**Phase 4 (done):** Tablet parity for toners / paper / lamination — list cards ≤1024px, responsive toner grid, narrow sidebar 769–1024px, Playwright tablet viewport 834px, `e2e/tablet/stock.spec.ts`.

**Phase 5 (done):** Analytics / Rotation / Admin — phone KPI-only analytics + stubs for heavy admin/rotation editors; tablet layouts for charts and rotation; `e2e/mobile/analytics.spec.ts`, `e2e/tablet/analytics.spec.ts`.

**Phase 6 (done):** Hardening — global `prefers-reduced-motion` (`_accessibility.scss`), Playwright `reducedMotion: 'reduce'` + CI retries (2), light responsive for Calculator / Manuals / Holders stock, route layout E2E (`e2e/mobile/routes.spec.ts`, `e2e/tablet/routes.spec.ts`), `npm run test:e2e:responsive` / `test:e2e:routes`. PWA/offline — out of v1 scope.

## Breakpoints

| Token | Max width | Typical device |
|-------|-----------|----------------|
| `xs`  | 480px     | Phone portrait |
| `sm`  | 768px     | Phone landscape / small tablet |
| `md`  | 1024px    | Tablet |
| `lg`  | >1024px   | Desktop (current baseline) |

CSS variables on `:root`: `--bp-xs-max`, `--bp-sm-max`, `--bp-md-max`, `--touch-target-min`.

## SCSS

File: `src/app/styles/breakpoints/_breakpoints.scss` (imported from `index.scss`).

Re-export for widgets: `@import '../../../shared/styles/breakpoints';` or relative path to `app/styles/breakpoints/breakpoints`.

```scss
@include down(sm) {
  .toolbar { flex-direction: column; }
}
```

Mixins: `down(xs|sm|md)`, `up(xs|sm|md|lg)`, `between(from, to)`.

## TypeScript

- Constants: `src/shared/lib/breakpoints.ts`
- Hooks: `useMediaQuery`, `useIsDown`, `useIsMobile`, `useIsTabletOnly`, `useIsDesktop` in `src/shared/lib/hooks/`

## Screen support matrix (product)

| Area | Phone | Tablet | Desktop |
|------|-------|--------|---------|
| Login | Full | Full | Full |
| Stock (parts) | P2 | P0 | Full |
| Stock (toners / paper / lamination) | P4 | P4 | Full |
| Journal / counter / inventorization | P3 | P0 | Full |
| Analytics / Admin / Rotation | P5 stub (phone) | P5 layout | Full |
| Calculator / Manuals / Holders | P6 layout | P6 layout | Full |

See chat roadmap for phase order.

## Release checklist (responsive / Pages)

1. `npm test` — unit tests green.
2. `npm run test:e2e:smoke` — desktop + public mobile/tablet smoke (CI gate).
3. With `E2E_EMAIL` / `E2E_PASSWORD`: `npm run test:e2e:responsive` or targeted `test:e2e:shell`, `stock`, `journal`, `routes`, `analytics`.
4. Manual spot-check: phone drawer, stock FIFO bottom sheet, journal counter form, tablet sidebar + toners list.
5. `npm run build:prod` then `npm run deploy` when ready; Firebase Auth authorized domain includes `batteryxv88.github.io`.
6. Optional: enable `E2E_EMAIL` / `E2E_PASSWORD` in GitHub Actions secrets for authenticated responsive runs (not required for deploy today).

## PR checklist (responsive changes)

1. Desktop smoke E2E still passes.
2. If shell / modals / navigation changed: add or update mobile/tablet E2E.
3. Avoid `min-width` on modals without `min(..., 100vw)`.
4. Touch targets ≥ `--touch-target-min` on `< sm`.
5. `npm test` green.

## Tests

- Unit: `breakpoints.test.ts`, `useMediaQuery.test.tsx`
- RTL helper: `src/test/viewports.ts` (`mockMatchMedia`, `renderAtWidth`)
- E2E: `e2e/mobile/smoke.spec.ts` (`mobile-chrome`), `e2e/tablet/smoke.spec.ts` (`tablet-chrome`)

```bash
npm test
npm run test:e2e:smoke
npm run test:e2e:responsive   # all @mobile / @tablet (auth projects if env set)
npm run test:e2e:routes       # layout checks for primary routes
```
