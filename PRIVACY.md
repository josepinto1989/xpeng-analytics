# Privacy

## Design promise

The web application processes XPENG Data Act exports in the browser.
The project does not require an application account, an application backend,
or mandatory remote storage for vehicle data.

Persistent local history is disabled by default. If the user explicitly
enables **Remember this history on this device**, the application stores one
processed `.xpeng` history in that browser's IndexedDB storage. It is restored
only on the same browser profile and is never uploaded by XPENG Analytics.
The **Data** page shows its size and dates and provides a permanent delete
action. Browser or operating-system cleanup may also remove it, so a separately
exported `.xpeng` file remains the recommended backup.

Google Drive backup is a separate, optional action. When the user connects
Google Drive and chooses to save or enables session auto-update, the browser
sends the generated `.xpeng` file directly to Google's Drive API and stores it
in a visible **XPENG Analytics** folder in that user's account. XPENG Analytics
does not receive the file through an application server. The app requests only
the `drive.file` scope, which is limited to files it creates or files explicitly
opened with it. Google access tokens remain in tab memory and are not stored;
the user may need to authorise again after closing the tab or when the token
expires. Disconnecting does not delete the Drive copy.

The application keeps only the latest processed `.xpeng` Drive backup. Older
app-created recovery copies from previous versions are moved to Drive trash
after the next successful save. Backup coverage, size, format version, and
timestamps are stored as Drive file metadata. The connected Google email
address is read only to identify the active account in the interface and is
not saved to local storage or included in a portable history.

The separate **Archive original XPENG ZIPs** option is disabled by default.
When explicitly enabled, each successfully recognised XPENG ZIP is uploaded
unchanged to a **Raw Files** subfolder in the user's Drive. A SHA-256 digest
already calculated during local import avoids duplicates. The app records the
source coverage and retention state in `.xpeng`, then keeps the smallest
practical set of originals spanning the observed period, preferring one day
of overlap. Redundant files are moved to Drive trash and remain recoverable;
exports without trustworthy coverage are always retained. These originals may
contain the VIN, complete raw telemetry, and other information omitted from the
processed `.xpeng` history. They are not encrypted and use the user's quota.

GPX source archiving has its own disabled-by-default option. When enabled,
successfully parsed `.gpx` files and ZIPs containing GPX are copied unchanged to
an **Original GPX files** subfolder and deduplicated by SHA-256. These files may
contain precise locations outside matched XPENG journeys, including walks,
parked periods, and complete all-day recordings. Enabling XPENG ZIP archiving
does not enable GPX archiving. GPX originals are also unencrypted, use the
user's Drive quota, and remain until explicitly deleted.

Static hosting still receives ordinary web requests for the application files
and therefore may receive standard connection metadata such as an IP address
and user agent. No vehicle export or processed vehicle history is intentionally
included in those requests.

## Sensitive information

Vehicle exports and portable histories may reveal travel times, driving
patterns, charging behaviour, and other personal information. Users should
store exported histories as sensitive files and should not attach them to bug
reports or commit them to Git.

Version 6 portable histories contain normalised telemetry, model information
when available, import provenance such as source filenames and archive hashes,
and validated personal-chart definitions. If the user imports GPX data, the
same history also contains precise timestamps and coordinates for route slices
automatically matched to XPENG trips. Complete unmatched recordings are also
retained while they end within five days of the latest imported vehicle
telemetry, or are newer than it, so delayed XPENG data can be matched after a
later import. Older unmatched recordings and rejected duplicates are not
exported. Histories do not contain the original VIN and are not encrypted;
possession of the file grants access to its processed data. The
`.xpeng` extension and compression reduce size but do not provide encryption or
access control. Manual journey groups add only a user-provided group name and
references to existing journey and trip identifiers; they do not duplicate
telemetry or create new location samples.

The application must never add telemetry, advertising, remote fonts, crash
uploads, or analytics without a separate public design review and an explicit
user-facing consent decision. Google Identity Services and Google Drive are
contacted only for the optional backup feature. When the user opens a journey with an associated
GPS route, the tile provider receives the ordinary web requests needed for the
viewed area, including standard connection metadata. The GPX file is not
uploaded. Route matching, storage, chart synchronisation, and PDF composition
remain local.

The optional 7-, 15-, 25-, or 30-day import reminder is also stored locally. It only compares
the latest import time when the application is opened; it does not sign in to
XPENG, scrape the data portal, send notifications from a server, or download
vehicle data automatically.

## Repository policy

Only synthetic fixtures may be committed. Pull requests containing real
vehicle data, persistent identifiers, access tokens, credentials, or private
keys must be rejected and removed from history before publication.

