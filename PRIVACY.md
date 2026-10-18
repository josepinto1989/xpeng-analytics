# Privacy

## Design promise

The web application processes XPENG Data Act exports in the browser.
The project does not require an application account, an application backend,
or remote storage for vehicle data.

Persistent local history is disabled by default. If the user explicitly
enables **Remember this history on this device**, the application stores one
processed `.xpeng` history in that browser's IndexedDB storage. It is restored
only on the same browser profile and is never uploaded by XPENG Analytics.
The **Data** page shows its size and dates and provides a permanent delete
action. Browser or operating-system cleanup may also remove it, so a separately
exported `.xpeng` file remains the recommended backup.

Static hosting still receives ordinary web requests for the application files
and therefore may receive standard connection metadata such as an IP address
and user agent. No vehicle export or processed vehicle history is intentionally
included in those requests.

## Sensitive information

Vehicle exports and portable histories may reveal travel times, driving
patterns, charging behaviour, and other personal information. Users should
store exported histories as sensitive files and should not attach them to bug
reports or commit them to Git.

Version 5 portable histories contain normalised telemetry, model information
when available, import provenance such as source filenames and archive hashes,
and validated personal-chart definitions. If the user imports GPX data, the
same history also contains precise timestamps and coordinates for the route
slices automatically matched to XPENG trips; unmatched recordings and rejected
duplicates are not exported. Histories do not contain the original VIN and are
not encrypted; possession of the file grants access to its processed data. The
`.xpeng` extension and compression reduce size but do not provide encryption or
access control.

The application must never add telemetry, advertising, remote fonts, crash
uploads, or analytics without a separate public design review and an explicit
user-facing consent decision. OpenStreetMap background tiles are the only
current remote map resource. When the user opens a journey with an associated
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

