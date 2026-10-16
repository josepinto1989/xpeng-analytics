# Security policy

## Reporting a vulnerability

Do not include a real vehicle export, portable history, GPX route, VIN, credential, or
precise personal information in a public issue. Open a minimal report using
synthetic data and ask the maintainers for a private reporting channel if the
problem cannot be demonstrated safely.

## Security boundaries

The version 4 portable-history importer enforces manifest and block-size
limits, strict format and schema versions, per-block bounds and SHA-256 checks,
decompressed-size checks, and required-stream validation before replacing the
active session. GPS blocks additionally require aligned array lengths, strictly
increasing timestamps, and finite coordinates inside valid latitude and
longitude ranges. The native reader also accepts version 3, while compatibility
readers apply their own limits and integrity checks to versions 1 and 2. ZIP
importers read members without extracting filesystem paths and validate the
expected source schemas.

The checksum detects accidental corruption; it is not a digital signature and
does not prove who created a history file. Only import histories from sources
you trust.

A portable history remains sensitive even though version 4 does not retain the
original vehicle identifier. It contains timestamped vehicle telemetry and
import provenance that may reveal personal routines. When GPX has been added,
it also contains precise location history. Future exports are merged by
timestamp and archive content, not by treating the history as anonymous.

The optional OpenStreetMap background is disabled until requested by the user.
Loading it discloses the viewed map area through ordinary tile requests; the
application does not upload the GPX file or bulk-download the standard tile
service.

