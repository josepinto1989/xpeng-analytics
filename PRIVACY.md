# Privacy

## Design promise

The planned web application processes XPENG Data Act exports in the browser.
The project does not require an application account, an application backend,
or remote storage for vehicle data.

Static hosting still receives ordinary web requests for the application files
and therefore may receive standard connection metadata such as an IP address
and user agent. No vehicle export or processed vehicle history is intentionally
included in those requests.

## Sensitive information

Vehicle exports and portable histories may reveal travel times, driving
patterns, charging behaviour, and other personal information. Users should
store exported histories as sensitive files and should not attach them to bug
reports or commit them to Git.

Portable histories also contain the random pseudonymisation key needed to merge
future exports from the same vehicle. They do not contain the original VIN and
are not encrypted; possession of the file grants access to its processed data.
The `.xpeng` extension and compression reduce size but do not provide
encryption or access control.

The application must never add telemetry, advertising, remote fonts, remote
map tiles, crash uploads, or analytics without a separate public design review
and an explicit user-facing consent decision.

## Repository policy

Only synthetic fixtures may be committed. Pull requests containing real
vehicle data, persistent identifiers, access tokens, credentials, or private
keys must be rejected and removed from history before publication.

