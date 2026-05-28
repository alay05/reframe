# Reframe MVP

Chrome Extension MV3 prototype for turning a basic website into a plain black-and-white overlay while preserving the original page's functionality underneath.

## What it does

- Injects a persistent `Rework` / `Unrework` toggle on every page.
- Stores mode state per origin in `chrome.storage.local`.
- Captures visible headings, text, links, buttons, and basic form controls in DOM order.
- Renders a simplified overlay above the page.
- Routes overlay interactions back to the native DOM.
- Rebuilds the overlay after navigation and DOM changes to stay in sync.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Choose `Load unpacked`.
4. Select this repository directory.

## Notes

- This MVP targets ordinary DOM-heavy sites, not canvas-driven or highly virtualized apps.
- The overlay is intentionally generic and linear; it does not preserve layout fidelity.
- Unsupported or unreliable elements are omitted instead of forcing broken interactions.
