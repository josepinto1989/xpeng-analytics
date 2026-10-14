# Security policy

## Reporting a vulnerability

Do not include a real vehicle export, portable history, VIN, credential, or
precise personal information in a public issue. Open a minimal report using
synthetic data and ask the maintainers for a private reporting channel if the
problem cannot be demonstrated safely.

## Security boundaries

The version 3 portable-history importer enforces manifest and block-size
limits, strict format and schema versions, per-block bounds and SHA-256 checks,
decompressed-size checks, and required-stream validation before replacing the
active session. Compatibility readers apply their own limits and integrity
checks to version 1 and 2 histories. The ZIP importer reads members without
extracting filesystem paths and validates the expected source schemas.

The checksum detects accidental corruption; it is not a digital signature and
does not prove who created a history file. Only import histories from sources
you trust.

A portable history remains sensitive even though version 3 does not retain the
original vehicle identifier. It contains timestamped vehicle telemetry and
import provenance that may reveal personal routines. Future exports are merged
by timestamp and archive content, not by treating the history as anonymous.

