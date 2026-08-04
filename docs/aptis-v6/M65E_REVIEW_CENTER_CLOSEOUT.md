# M6.5E Unified Review Center closeout

This document defines the closeout scope for the local-first Aptis Review Center.

## Delivered closeout capabilities

- Unified filtering by module, attempt status and favourite state.
- Sorting by newest, oldest, module, test and completion.
- Multi-select attempt workflow.
- Export selected attempts as a structured JSON package.
- Delete selected attempts and their linked assets after explicit confirmation.
- Review Center summary cards by module and status.
- Local data health check for attempts, drafts and recording assets.
- Clear status and empty-state feedback.
- Existing module-specific review actions remain available for Core, Reading, Listening, Speaking and Writing.

## Data boundary

The Review Center remains local-first. Attempts, drafts and recordings are read from IndexedDB. Exported packages are created in the browser. No Google OAuth, Drive synchronisation or server upload is introduced by M6.5E.

## Compatibility

M6.5E keeps attempt contract `2.0.0`, IndexedDB version 2 and all existing attempt IDs, draft IDs and recording asset references. It layers closeout controls over the existing Review Center instead of migrating stored user data.

## Limitations

- Health checking reports orphan recording assets only when they can be associated with loaded attempts; it does not repair them automatically.
- Selected export contains attempt metadata but does not embed binary recordings. Speaking recordings continue to use the dedicated ZIP package action.
- Cross-device history and synchronisation remain deferred.
