# Personal Context

Editable memory for Chris's personal OS. Everything in this folder is loaded at
request time by `lib/personalContext.ts` and merged into AI prompts.

**Edit these files instead of touching `route.ts`** when you want to change:

- Your identity / company / title (`identity.md`)
- Your drafting voice and reply rules (`voice.md`)
- The list of project categories the AI uses when classifying tasks (`projects.md`)
- The list of email domains that should always elevate in triage (`senders.md`)

## File format

Each file uses YAML frontmatter for structured data, followed by free-form
markdown for narrative context. The loader parses both:

- Frontmatter keys become structured fields (typed in `lib/personalContext.ts`).
- The markdown body is passed to the AI as additional context on the topic.

Example:

```markdown
---
name: Chris Lloyd
role: Owner
---

Free-form narrative the AI reads for extra context.
```

## Supported frontmatter shapes

- `key: value` — a single string.
- `key:` followed by indented `- item` lines — a list of strings.

No other YAML features are supported (keep it simple on purpose).

## Caching

Files are cached for 60 seconds in-process. In dev, hot-reload is instant if you
restart; in prod, edits take effect within a minute of deploy.

## Safety

Never paste secrets here. This folder is committed to git.
