# Reframe MVP

Reframe is an experiment in separating a website's underlying functionality from its visual presentation.

Most websites already expose a live structure through the DOM: links, buttons, forms, text, images, navigation, and stateful controls. The larger idea behind Reframe is that a browser-side tool could read that structure, understand what the page can do, and present the same website through a different interface while still delegating behavior back to the original page.

In the long term, this could make it possible to rework complex sites into simpler, more focused, or radically different layouts without rebuilding the underlying application. A user's preferred version of a site could eventually be remembered and restored automatically when they return.

This repository is the first technical proof of that process. It is not trying to personalize layouts yet, use AI, or create polished redesigns. The current MVP is a Chrome Extension MV3 prototype that turns a basic website into a plain black-and-white overlay while preserving the original page's functionality underneath.

## What it does

- Injects a persistent `Rework` / `Unrework` toggle on every page.
- Stores mode state per origin in `chrome.storage.local`.
- Captures a tree-shaped representation of visible page structure, controls, images, tables, lists, and semantic containers.
- Renders a simplified black-and-white overlay that preserves recognizable page grouping and layout.
- Routes overlay interactions back to the native DOM.
- Rebuilds the overlay after navigation and DOM changes to stay in sync.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Choose `Load unpacked`.
4. Select this repository directory.

## Local test fixture

Run a local static server from the repository root:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/fixtures/manual-test.html` and test `Rework` / `Unrework` against the fixture content, form, table, buttons, and hash navigation.

## Notes

- This MVP targets ordinary DOM-heavy sites, not canvas-driven or highly virtualized apps.
- The overlay is intentionally black-and-white and non-personalized; it approximates structure rather than cloning exact CSS.
- Unsupported or unreliable elements are omitted instead of forcing broken interactions.
