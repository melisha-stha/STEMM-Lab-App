# Formatter utilities

Shared formatting for display strings (not business rules).

Examples: `formatDuration`, team discriminator labels, saved-at timestamps for lab journal.

**Implemented (Stage 2A):** `lab-journal.ts` — loads/normalises/filters local reflection history via `hooks/storage` getters.

`hooks/lab-journal.ts` re-exports from here for compatibility.
