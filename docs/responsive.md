# Responsive roadmap — PSM

Foundation (Phase 0) defines shared breakpoints for SCSS and TypeScript.

**Phase 1 (done):** mobile drawer for sidebar + primary nav, burger in Navbar, Redux `ui.sidebarOpen`, tablet/desktop keep inline sidebar and top nav.

**Phase 2 (done):** Stock pilot — card rows on phone, compact header/search, hidden table header, FIFO panel + modals as bottom sheets, `e2e/mobile/stock.spec.ts`.

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
| Stock | P1 → P0 | P0 | Full |
| Journal / counter / inventorization | P0 | P0 | Full |
| Analytics / Admin | Stub or read-only | P1 | Full |

See chat roadmap for phase order.

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
npm run test:e2e -- --project=chromium-smoke
npm run test:e2e -- --project=mobile-chrome
npm run test:e2e -- --project=tablet-chrome
```
