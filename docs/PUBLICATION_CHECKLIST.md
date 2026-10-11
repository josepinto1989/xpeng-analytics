# Publication checklist

Complete this checklist before creating or pushing a public remote.

- [ ] `python scripts/audit_public_tree.py` passes.
- [ ] `python -m unittest discover -s tests -v` passes.
- [ ] `git status --short` contains only intentional source files.
- [ ] `git log --all --stat` contains no imported private history.
- [ ] No real archive, database, snapshot, key, environment file, or report is tracked.
- [ ] No email address, account name, private hostname, token, or credential is tracked.
- [ ] Tests use only generated synthetic data.
- [ ] PT-PT and English contain the same translation keys and complete flows.
- [ ] The privacy promise matches actual browser network behaviour.
- [ ] Browser developer tools show no vehicle-data request during import.
- [ ] The release clearly states that the project is independent and unofficial.
- [ ] GitHub Pages uses GitHub Actions as its deployment source.
- [ ] The deployed URL opens in Firefox, Chrome, and Edge.
- [ ] The public issue form rejects reports that include real vehicle data.

