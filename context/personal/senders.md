---
domains:
  - quickbooks.com
---

Email domains whose messages should always elevate in the triage scoring pass.
An email from any of these domains gets a +60 "key sender" boost, which is
usually enough to push it into the daily triage output even without other
positive signals.

Add new entries when a vendor or partner relationship becomes important enough
that you want every message from them flagged. Remove entries (or move them
into a separate block below) when they become noisy enough that the +60 boost
is creating false positives.

The `CC_IMPORTANT_SENDERS` env var (comma-separated domains) is merged on top
of this list at request time, so you can still hotfix without a deploy. The
file is the source of truth; the env var is the override.
