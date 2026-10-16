# XPENG Analytics 1.6.0-beta.2

This private-staging beta completes roadmap Phase 8.

## Persistent local history

The Data page offers **Remember this history on this device**. It is off by
default. After explicit consent, XPENG Analytics stores one processed `.xpeng`
history in the current browser's IndexedDB storage and reopens it automatically
on the next visit.

Successful additions of newer XPENG ZIPs update the stored history only after
normal validation, consolidation, and deduplication finish. The interface shows
the saved size, last save, and last import.

## Configurable local reminder

Users can enable a local reminder and choose 7, 15, 25, or 30 days. The Data
page shows the calculated next reminder date. The reminder is evaluated only
when the application is opened. It does not sign in to XPENG, scrape the data
portal, run a server task, or download data automatically.

The first-beta default of 30 days is retained until the user chooses another
interval.

## Privacy and recovery

- No application server, user account, or cloud vehicle-data storage was added.
- The saved history is unencrypted and remains in the selected browser profile.
- **Delete saved history** removes the IndexedDB copy while leaving the current
  in-memory session open.
- An exported `.xpeng` file remains the recommended portable backup because the
  browser or operating system may clear local storage.
- Phase 8 supports one remembered vehicle history per browser profile.

## Staging safety

The GitHub Pages workflow deploys only from the public
`josepinto1989/xpeng-analytics` repository. Pushing this beta to the private
staging repository runs quality checks without creating a public staging site.
