# Activity components

Shared UI for lab activity screens (not tied to a single experiment).

**Planned contents (Stage 3):**

- Activity step panels (e.g. `ActivityStepPanel`)
- Overview / experiment / write-up / discussion tab bars
- Equipment checklist blocks
- Reusable overview hero and diagram frames

Code will be **extracted gradually** from files under `app/` (e.g. `parachute.tsx`, `sound.tsx`). No behaviour changes during moves—presentation props only.

**Current location:** Most activity UI still lives inside individual `app/*.tsx` files and `components/ui/` (e.g. `activity-color-panel`, `experiment-challenge-timer`).
