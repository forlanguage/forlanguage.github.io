# Aptis Writing Authoring Guide v2

## Purpose

This guide defines the M6.3A authoring contract for original ForLanguage Writing practice. It does not claim to reproduce official Aptis test content or official scoring.

## Source files

- `aptis/data/writing/schema-v2.json` — machine-readable contract.
- `aptis/data/writing/bank-v2.json` — published bank consumed by the application.
- `aptis/data/writing/manifest-v2.json` — release counts and compatibility metadata.
- `tools/writing/validate_bank.py` — structural and reference validator.

## Stable IDs

Existing IDs `WT01`, `WT02`, `WT03` and their task IDs remain unchanged to preserve compatibility with attempts and drafts already stored in browsers.

New IDs use:

- Test: `WT04`, `WT05`, …; three digits may be used after `WT99`.
- Task: `<test_id>-P1`, `<test_id>-P2`, `<test_id>-P3`, `<test_id>-P4A`, `<test_id>-P4B`.
- Topic: `WR-TOP-<UPPERCASE-SLUG>`.
- Rubric: `WR-RUB-<LEVEL>-<NAME>`.
- Release: `WR-YYYY.MM-RN`.

IDs are immutable after a test has been published. Retired content keeps its ID and receives status `RETIRED` outside the public bank.

## Required test structure

Each full test contains exactly five task records:

1. Part 1 — `short_answers`, five questions, short responses.
2. Part 2 — `short_message`.
3. Part 3 — `social_responses`, three questions.
4. Part 4A — `informal_email`.
5. Part 4B — `formal_email`.

All five records share one coherent topic. Part 4A and Part 4B should describe the same change or problem from informal and formal perspectives.

## Status lifecycle

`DRAFT → IN_REVIEW → PUBLISHED_DEMO → PUBLISHED_FINAL → RETIRED`

Only `PUBLISHED_DEMO` and `PUBLISHED_FINAL` records may appear in `bank-v2.json`. Draft and review rows belong in the authoring source, not the published bank.

## Content requirements

- Content must be original or clearly licensed.
- Do not copy remembered or leaked exam prompts.
- Avoid personal data and real candidate identities.
- Use clear B2-level situations and natural English.
- Keep the topic consistent across Parts 1–4.
- Record reviewer notes before changing status to `PUBLISHED_FINAL`.
- Preserve British or international English consistently within a test.

## Review checklist

Before publishing a test, verify:

- Test ID and task IDs are unique.
- Topic and rubric references exist.
- Part/type mapping is correct.
- Part 1 contains five questions.
- Part 3 contains three questions.
- Part 4 includes one informal and one formal email.
- Minimum words do not exceed maximum words.
- Prompts do not materially duplicate another test.
- The full test can be completed within `duration_seconds`.
- `source_note` states the content origin.

## Release workflow

1. Author and review content in the authoring source.
2. Export only public statuses.
3. Update `bank-v2.json`.
4. Update counts and release metadata in `manifest-v2.json`.
5. Run:

   ```bash
   python tools/writing/validate_bank.py
   ```

6. Open a pull request and require CI success.
7. Merge without changing previously published IDs.

## Compatibility policy

The editor may add new fields, but it must continue reading the fields used by v1 drafts and attempts: `test_id`, `title`, `topic`, `duration_seconds`, `tasks`, `task_id`, `part`, `type`, `prompt`, `questions`, `min_words`, and `max_words`.
