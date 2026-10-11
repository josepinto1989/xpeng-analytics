# Publication checklist

Completed for the v1.0.0 public release on 2026-10-11.

- [x] `python scripts/audit_public_tree.py` passes.
- [x] `python -m unittest discover -s tests -v` passes.
- [x] `git status --short` contains only intentional source files.
- [x] `git log --all --stat` contains no imported private history.
- [x] No real archive, database, snapshot, key, environment file, or report is tracked.
- [x] No email address, account name, private hostname, token, or credential is tracked.
- [x] Tests use only generated synthetic data.
- [x] PT-PT and English contain the same translation keys and complete flows.
- [x] The privacy promise matches actual browser network behaviour.
- [x] Browser developer tools show no vehicle-data request during import.
- [x] The release clearly states that the project is independent and unofficial.
- [x] GitHub Pages uses GitHub Actions as its deployment source.
- [x] The deployed URL opens in Firefox, Chrome, and Edge.
- [x] The public issue form rejects reports that include real vehicle data.

