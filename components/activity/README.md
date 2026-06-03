# Activity components

Shared presentational UI for lab activity screens.

## Stage 3A

| Component | Purpose |
|-----------|---------|
| `ActivityStepPanel.tsx` | Coloured step panel (`stacked` or `inline` layout) |
| `EquipmentChecklist.tsx` | Interactive equipment checklist (`standard`, `performance`, `compact`) |
| `ResultMetricCard.tsx` | Sound measurement result row (metric + risk badge) |

Used from `app/parachute.tsx`, `sound.tsx`, `earthquake.tsx`, `reaction.tsx`, `breathing.tsx`, `handfan.tsx`, `performance.tsx`.

Overview heroes, tab bars, and experiment state remain in each activity screen.
