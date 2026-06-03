# Layout components

Cross-screen layout helpers (optional grouping).

**Planned contents:**

- Shared screen wrappers beyond what already exists in `components/ui/`
- Grouped re-exports of background + scroll patterns where it reduces duplication

**Current location:** `components/ui/screen-back-button.tsx`, `hooks/use-screen-scroll-insets.ts`, per-activity `*-screen-background.tsx` files.

Moves are optional and low priority; avoid breaking safe-area or scroll behaviour on results screens.
