# Dev Knowledge repository instructions

## Canonical editorial policy

- Treat `src/content/docs/writing-guide.md` as the detailed source of truth for capture, information architecture, frontmatter, verification, privacy, and handoff.
- Preserve existing verified conclusions when reorganizing. Do not shorten a page by silently deleting useful knowledge.

## Information architecture

- Classify each conclusion by the primary object it explains before editing:
  - CSS: styling, typography, layout, sizing, painting, scrolling, and CSS interaction properties.
  - Frontend: frameworks, components, browser runtime, requests, resource loading, and UI performance.
  - Backend and data: APIs, databases, collection pipelines, server-side processing, and long-running data tasks.
  - Tooling and systems: package managers, build scripts, processes, local services, command-line tools, and operating-system automation.
  - Git and Codex: keep their product-specific concepts in their existing categories.
- Do not choose a destination based on the repository or incident where the knowledge was discovered.
- Keep one canonical full explanation. Other pages may include only the context-specific takeaway and a link.
- A category `index.md` is a problem-oriented reading map, not a flat file list. Update it whenever pages are added, moved, renamed, or promoted.
- In `quick-notes.md`, use second-level headings for problem domains and third-level headings for individual notes. Insert into the relevant group; never append chronologically to a mixed list.
- Promote a note to a focused article when it needs a shared mental model, several related concepts, a comparison table, a multi-step workflow, or multiple sections. Leave a short link behind only when it helps discovery.
- Create a new top-level category only for a stable domain that cannot fit an existing category cleanly and is expected to contain more than a one-off page.

## Completion checks

- Search the whole knowledge directory for duplicates, stale paths, and related pages before and after structural edits.
- After content or frontmatter changes, run `pnpm check`.
- After navigation, links, routes, or document structure changes, also run `pnpm build` and verify affected internal links resolve.
- Keep every change unstaged for review. Never stage, commit, push, or deploy unless the user explicitly requests that exact action.
