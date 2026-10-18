# Security policy

## Reporting a vulnerability

Do not include a real vehicle export, portable history, GPX route, VIN, credential, or
precise personal information in a public issue. Open a minimal report using
synthetic data and ask the maintainers for a private reporting channel if the
problem cannot be demonstrated safely.

## Security boundaries

The version 5 portable-history importer enforces manifest and block-size
limits, strict format and schema versions, per-block bounds and SHA-256 checks,
decompressed-size checks, and required-stream validation before replacing the
active session. GPS blocks additionally require aligned array lengths, strictly
increasing timestamps, and finite coordinates inside valid latitude and
longitude ranges. Personal-chart definitions are checked against allow-lists
and text, metric, series, and chart-count limits; they are data, never executable
code. The native reader also accepts versions 3 and 4, while compatibility
readers apply their own limits and integrity checks to versions 1 and 2. ZIP
importers read members without extracting filesystem paths and validate the
expected source schemas.

The checksum detects accidental corruption; it is not a digital signature and
does not prove who created a history file. Only import histories from sources
you trust.

A portable history remains sensitive even though version 5 does not retain the
original vehicle identifier. It contains timestamped vehicle telemetry and
import provenance that may reveal personal routines, plus user-authored chart
titles or descriptions. When GPX has been added, it also contains the precise
location history of automatically matched trip slices. Unmatched recordings
and rejected duplicate tracks are not written to the portable history. Future
exports are merged by timestamp and archive content, not by treating the
history as anonymous.

Opening a journey with an associated GPX route loads an OpenStreetMap
background and discloses the viewed map area through ordinary tile requests.
The application does not upload the GPX file, prefetch routes, or bulk-download
the standard tile service.

The optional Google Drive feature uses Google Identity Services in the browser
and requests only `drive.file`. Access tokens are held in memory, never written
to local storage, and never included in histories or logs. The browser client
ID is public configuration; no OAuth client secret belongs in this static
application. A Drive backup is the same unencrypted sensitive `.xpeng` payload,
so users must protect their Google account and should disconnect on shared
computers. Only official Google Identity and Drive API endpoints may be used.

