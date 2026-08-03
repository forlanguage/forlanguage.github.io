# Aptis v6 — Phase A

## Objective

Refactor the existing Aptis v5.3 single page into module-based entry points without changing the published question bank, Question IDs or local history keys.

## Delivered in this batch

- `/aptis/` — Aptis dashboard for the five exam modules.
- `/aptis/core/` — Grammar & Vocabulary module.
- `/aptis/reading/` — Reading module.
- `/aptis/runtime-v6-module.js` — shared loader for the existing v5.3 engine and v5 bank.
- `/aptis/module-registry-v6.json` — module status and route registry.
- GitHub Pages workflow changed from migration mode to repository deployment mode.

## Compatibility contract

- Grammar IDs remain unchanged.
- Vocabulary IDs remain unchanged.
- Reading IDs remain unchanged.
- The bank remains at version `5.0.0` during Phase A.
- Existing localStorage history keys are retained.
- JSON export schema remains readable by the v5.3 history module.
- Core and Reading pages are served from the same origin, so existing browser history remains available.

## Current bank baseline

- Grammar: 1,000
- Vocabulary: 1,000
- Reading: 696
- Reading tests: 24
- Total items: 2,696

## Acceptance checks

1. `/aptis/` displays five exam modules.
2. `/aptis/core/` loads the current Grammar and Vocabulary bank.
3. `/aptis/reading/` loads all 24 Reading tests.
4. Submit, review, wrong-only review, retry and JSON export continue to work.
5. Question IDs remain visible.
6. Existing local history is visible from both live modules.
7. Deployment validates the bank manifest before publishing.
8. The deploy workflow no longer downloads and overwrites the Aptis application from the former personal website.

## Next batch

Phase A2 will extract common attempt and history services from the legacy runtime into `/aptis/shared/`. Phase B will introduce the Listening Google Sheet schema and one complete Listening MVP test.
