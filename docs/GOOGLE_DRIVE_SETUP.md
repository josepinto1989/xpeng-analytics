# Google Drive backup setup

XPENG Analytics can optionally save the latest portable `.xpeng` history in a
visible **XPENG Analytics** folder in the user's own Google Drive. The static
site uses Google Identity Services
directly; there is no XPENG Analytics backend and no client secret.

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
  storage or included in `.xpeng` files. The account name and email are read
  into tab memory only so the interface can identify the connected account.
- The app creates/updates one current `xpeng-analytics-history.xpeng` file.
  It exposes coverage, size, save time, and history-format metadata in the
  restore interface. Recovery files created by older versions are cleaned up
  after the next successful save.
- If the user separately enables original-export archiving, the app creates a
  `Raw Files` subfolder and uploads only successfully recognised XPENG ZIPs.
  Each retained file is preserved byte for byte and marked with its SHA-256
  digest so duplicates can be skipped. Redundant originals are moved to Drive
  trash only after a replacement has uploaded successfully; their registry
  entries remain inside the `.xpeng` history.
- Original ZIP archiving is disabled by default and independent of automatic
  `.xpeng` updates. Originals may contain VIN and complete raw telemetry and use
  the user's Google Drive quota.
- GPX source archiving is a second disabled-by-default preference. Recognised
  `.gpx` files and GPX ZIPs are preserved in `Original GPX files`, deduplicated
  by SHA-256, and never enabled automatically with XPENG ZIP archiving.
- Uploads use a resumable session. After a recoverable interruption, the app
  asks Google how many bytes were accepted and continues from that position.
- The current copy can be restored on another computer after a fresh Google
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
3. verify account, size, coverage, last-save, and format metadata;
4. update the backup several times and confirm that only the current file
   remains (older app-created recovery files should be moved to trash);
5. restore the current copy in a fresh private window or another computer;
7. verify automatic updates after ZIP, GPX, and `.xpeng` imports while connected;
8. interrupt an upload and confirm that it resumes or reports a clear error;
9. disconnect, refresh, and confirm that a new authorisation is required;
10. inspect Drive and confirm that every managed file is inside one visible
    folder and was created by the application.
11. enable original ZIP archiving, import the same valid ZIP twice, and confirm
    that only one unchanged file appears in `Raw Files`;
12. download that original and compare its SHA-256 digest with the selected
    source, then delete it from the app and confirm that the `.xpeng` backup is
    unaffected.
13. enable GPX source archiving, import the same GPX twice, and confirm that one
    unchanged file appears in `Original GPX files` and that disabling XPENG ZIP
    archiving does not alter the separate GPX preference.
14. import overlapping XPENG ZIPs and confirm that the app retains a continuous
    source set with approximately one day of preferred overlap, while
    redundant files appear in Drive trash and remain recoverable.
15. export and restore `.xpeng`, then confirm its raw-file registry still lists
    retained and retired source digests without containing the ZIP payloads.
