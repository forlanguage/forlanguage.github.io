# M6.7A — Google Cloud configuration

## Scope

M6.7A prepares the public configuration contract for browser-based manual Google Drive sync. It does not yet implement sign-in or file upload. Those belong to M6.7B and M6.7C.

## Architecture decision

- Frontend: GitHub Pages at `https://forlanguage.github.io`.
- OAuth model: Google Identity Services token model in the browser.
- Drive scope: `https://www.googleapis.com/auth/drive.file` only.
- Sync mode: manual while the page is open.
- Offline access: disabled.
- Refresh token storage: not used.
- Client secret: not required and must never be committed.

## Google Cloud Console steps

1. Create or select a Google Cloud project for ForLanguage.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen.
4. Add application name, support email and developer contact.
5. Add test users while the app remains in testing mode.
6. Create an OAuth client of type **Web application**.
7. Add the authorized JavaScript origin:

   `https://forlanguage.github.io`

8. Do not add a client secret to this repository.
9. Copy the generated Web Client ID.
10. Update `aptis/config/google-drive-oauth-v1.json`:

```json
{
  "status": "CONFIGURED",
  "client_id": "YOUR_ID.apps.googleusercontent.com"
}
```

11. Run:

```bash
python tools/drive/validate_oauth_config.py
```

## Public versus secret values

The OAuth Web Client ID is public browser configuration. It identifies the application but does not authorize Drive access by itself.

The following values must never be committed:

- OAuth client secret;
- access token;
- refresh token;
- user Drive file IDs when they reveal private account data;
- exported user backups or recordings.

## Consent and verification

The first release should stay in testing mode with explicit test users. Before publishing to a wider audience, review the consent-screen requirements, privacy policy, application domain verification and Google verification requirements applicable at that time.

## Acceptance criteria

M6.7A is complete when:

- the Drive API and OAuth Web Client exist in Google Cloud;
- `https://forlanguage.github.io` is registered as an authorized JavaScript origin;
- the public client ID is inserted into the configuration file;
- the validator passes with status `CONFIGURED`;
- no secret or token appears in Git history.

## Current repository state

The repository ships with status `AWAITING_CLIENT_ID`. This is intentional until the Google Cloud Web Client ID is supplied. Therefore, the code-side contract is ready, but the external Google Cloud setup is not yet verified.
