# Google Drive backup setup

XPENG Analytics 2.1 can optionally save one portable `.xpeng` history in a
visible **XPENG Analytics** folder in the user's own Google Drive. The static
site uses Google Identity Services directly; there is no XPENG Analytics
backend and no client secret.

## Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable the **Google Drive API**.
3. Configure the OAuth consent screen for an external application. Add the
   public homepage, privacy-policy, and terms/project links.
4. Create an **OAuth client ID** of type **Web application**.
5. Add the development and production JavaScript origins that will actually be
   used, for example:
   - `http://localhost:4174`
   - `http://127.0.0.1:4174`
   - `http://127.0.0.1:4175`
   - `https://josepinto1989.github.io`
6. For a consent screen still in testing, add the owner's Google account under
   **Test users**. Publish the consent configuration before a public release.

Use these public branding URLs:

- homepage: `https://josepinto1989.github.io/xpeng-analytics/`
- privacy policy: `https://josepinto1989.github.io/xpeng-analytics/privacy.html`

The privacy page is shipped from `web/public/privacy.html` and is linked from
both application footers. Keep it aligned with `PRIVACY.md` whenever the data
or network model changes.

The application requests only:

`https://www.googleapis.com/auth/drive.file`

This non-sensitive scope limits the app to files it creates or that the user
explicitly opens with it. Do not request full Drive access.

## Local development

Copy `web/.env.example` to `web/.env.local` and set:

```text
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Run `pnpm dev` from `web` and use an exact origin registered in the OAuth
client. `.env.local` is ignored by Git. A browser OAuth client ID is public
configuration; a client secret must never be added to this repository or to a
Vite environment variable.

## GitHub Pages

Create a repository Actions variable named `GOOGLE_CLIENT_ID` containing the
same browser client ID. The Pages workflow exposes it to Vite as
`VITE_GOOGLE_CLIENT_ID` during the static build.

## Runtime security model

- Access tokens stay in JavaScript memory and disappear when the tab closes.
- Tokens, Google email addresses, and passwords are never written to local
  storage or included in `.xpeng` files.
- The app creates/updates one `xpeng-analytics-history.xpeng` file using a
  resumable upload and can restore it on another computer after a fresh Google
  authorisation.
- Automatic updates operate only while the current tab remains authorised.
  A later visit may require the user to connect again.
- Disconnecting revokes the current token when possible; it does not delete
  the user's Drive file.
- The `.xpeng` file is compressed but not encrypted. Google Drive receives and
  stores it only after the user enables this optional feature.

## Validation before release

Test with an OAuth test user on both a registered local origin and the final
GitHub Pages origin:

1. connect and cancel once;
2. connect and create the first backup;
3. update it after importing another ZIP or GPX;
4. restore it in a fresh private window or another computer;
5. verify automatic updates while connected;
6. disconnect, refresh, and confirm that a new authorisation is required;
7. inspect Drive and confirm there is one visible folder and one backup file.
