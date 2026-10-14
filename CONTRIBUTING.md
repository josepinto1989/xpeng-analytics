# Contributing

Thank you for helping improve XPENG Analytics.

## Privacy first

Never commit, paste, or attach a real XPENG export, portable history, VIN,
location, credential, browser-storage dump, or screenshot containing personal
data. Bug reports and tests must use synthetic or fully redacted examples.

## Before opening a pull request

Run the same checks used by continuous integration:

```shell
python scripts/audit_public_tree.py
python -m unittest discover -s tests -v
cd web
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Keep European Portuguese and English translation keys in sync. Changes to
calculated battery metrics must state clearly that they are observational
estimates and not official BMS values.

User-facing workflow changes should update the English README and both user
guides when relevant:

- `docs/USER_GUIDE.md`
- `docs/USER_GUIDE.pt-PT.md`

Security-sensitive reports should follow [SECURITY.md](SECURITY.md) instead of
being posted with private data in a public issue.
