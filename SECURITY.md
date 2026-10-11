# Security policy

## Reporting a vulnerability

Do not include a real vehicle export, portable history, VIN, credential, or
precise personal information in a public issue. Open a minimal report using
synthetic data and ask the maintainers for a private reporting channel if the
problem cannot be demonstrated safely.

## Security boundaries

The portable-history importer enforces compressed and uncompressed size limits,
a compression-ratio limit, a content hash, a strict format/schema version, and
database integrity/source checks before replacing the active session. The
existing ZIP importer reads members directly without extracting paths and
validates the required schemas.

The checksum detects accidental corruption; it is not a digital signature and
does not prove who created a history file. Only import histories from sources
you trust.

Pseudonymisation is not anonymisation. A portable history remains sensitive
even when it does not contain the original vehicle identifier. It contains the
local pseudonymisation key so later exports from the same vehicle can be merged.

