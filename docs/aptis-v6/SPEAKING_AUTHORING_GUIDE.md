# Aptis Speaking Authoring Guide v2

## Scope

M6.4A defines the ForLanguage authoring contract for original Speaking practice. It does not reproduce official Aptis content or claim official scoring equivalence.

## Files

- `aptis/data/speaking/schema-v2.json`
- `aptis/data/speaking/bank-v2.json`
- `aptis/data/speaking/manifest-v2.json`
- `tools/speaking/validate_bank.py`

## Stable IDs

- Test: `ST01`, `ST02`, …
- Task: `<test_id>-P<part>-Q<number>`
- Topic: `SPK-TOP-<UPPERCASE-SLUG>`
- Rubric: `SPK-RUB-<LEVEL>-<NAME>`
- Image: `SPK-IMG-<UPPERCASE-SLUG>`
- Release: `SPK-YYYY.MM-RN`

Published IDs are immutable. Existing `ST01` task IDs are preserved for attempt and recording compatibility.

## Required test structure

Each full test must cover Parts 1–4. Every task records:

- prompt
- preparation time
- response time
- topic reference
- image references
- publication status
- review note when promoted to a final release

## Image registry

Any task that uses an image must reference an entry in `images`. Each image entry requires:

- stable image ID
- repository path
- descriptive alt text
- source
- licence
- attribution when required
- checksum
- publication status

Do not publish an image task with a missing registry entry, unclear licence or missing attribution. ST01 currently uses no images.

## Rubric

The B2 practice rubric uses:

- task fulfilment
- fluency
- grammar accuracy
- vocabulary range
- pronunciation
- coherence

This rubric supports learner self-review and structured feedback; it is not an official Aptis score.

## Status lifecycle

`DRAFT → IN_REVIEW → PUBLISHED_DEMO → PUBLISHED_FINAL → RETIRED`

Only public statuses may appear in the published bank.

## Validation

Run:

```bash
python tools/speaking/validate_bank.py
```

The validator checks IDs, references, Parts 1–4, timing values, image references, counts and compatibility metadata.
