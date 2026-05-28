(function () {
  if (window.__REFRAME_RUNTIME__) {
    return;
  }
  window.__REFRAME_RUNTIME__ = true;

  const ATTR_ID = "data-reframe-id";
  const OVERLAY_ROOT_ID = "reframe-overlay-root";
  const TOGGLE_ID = "reframe-toggle-root";
  const STORAGE_PREFIX = "reframe:origin:";
  const REBUILD_DEBOUNCE_MS = 200;
  const INTERACTION_REBUILD_MS = 150;
  const MAX_TEXT_LENGTH = 400;
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "META",
    "LINK",
    "SVG",
    "PATH",
    "IFRAME",
    "CANVAS",
    "TEMPLATE"
  ]);
  const TEXT_TAGS = new Set([
    "P",
    "SPAN",
    "DIV",
    "LI",
    "ARTICLE",
    "SECTION",
    "LABEL",
    "TD",
    "TH",
    "BLOCKQUOTE",
    "FIGCAPTION"
  ]);
  const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

  const runtimeState = {
    enabled: false,
    currentPage: null,
    overlayRoot: null,
    overlayScrollTop: 0,
    isApplyingState: false,
    lastUrl: location.href,
    lastStructureKey: "",
    refreshTimer: null,
    syncObserver: null
  };

  function nextId() {
    nextId.value += 1;
    return `rf-${nextId.value}`;
  }
  nextId.value = 0;

  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function storageKeyForOrigin(origin) {
    return `${STORAGE_PREFIX}${origin}`;
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      element.hidden ||
      element.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isOverlayElement(element) {
    return Boolean(element.closest(`#${OVERLAY_ROOT_ID}, #${TOGGLE_ID}`));
  }

  function mutationTouchesOnlyExtensionDom(mutation) {
    if (mutation.type === "childList") {
      const childNodes = [
        ...Array.from(mutation.addedNodes || []),
        ...Array.from(mutation.removedNodes || [])
      ];
      if (childNodes.length === 0) {
        return false;
      }
      return childNodes.every((node) => {
        if (!(node instanceof HTMLElement)) {
          return true;
        }
        if (node.id === OVERLAY_ROOT_ID || node.id === TOGGLE_ID) {
          return true;
        }
        return isOverlayElement(node);
      });
    }

    const nodes = [mutation.target];

    return nodes.every((node) => {
      if (!(node instanceof HTMLElement)) {
        return true;
      }
      if (node.id === OVERLAY_ROOT_ID || node.id === TOGGLE_ID) {
        return true;
      }
      return isOverlayElement(node);
    });
  }

  function ensureElementRef(element) {
    let refId = element.getAttribute(ATTR_ID);
    if (!refId) {
      refId = nextId();
      element.setAttribute(ATTR_ID, refId);
    }
    return {
      refId,
      tagName: element.tagName.toLowerCase(),
      name: element.getAttribute("name") || "",
      href: element instanceof HTMLAnchorElement ? element.href : ""
    };
  }

  function getLabelText(element) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "button" || element.type === "submit" || element.type === "reset") {
        return normalizeText(element.value || element.getAttribute("aria-label") || element.name);
      }
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) {
          return normalizeText(label.innerText || label.textContent);
        }
      }
      const parentLabel = element.closest("label");
      if (parentLabel) {
        return normalizeText(parentLabel.innerText || parentLabel.textContent);
      }
      return normalizeText(
        element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          element.name ||
          element.id
      );
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) {
          return normalizeText(label.innerText || label.textContent);
        }
      }
      return normalizeText(
        element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          element.name ||
          element.id
      );
    }

    return normalizeText(
      element.getAttribute("aria-label") ||
        element.innerText ||
        element.textContent ||
        element.getAttribute("title")
    );
  }

  function getFormId(form) {
    if (!(form instanceof HTMLFormElement)) {
      return null;
    }
    const ref = ensureElementRef(form);
    return ref.refId;
  }

  const capture = {
    capturePage() {
      const nodes = [];
      const seen = new Set();
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);

      while (walker.nextNode()) {
        const element = walker.currentNode;
        if (!(element instanceof HTMLElement)) {
          continue;
        }
        if (SKIP_TAGS.has(element.tagName) || isOverlayElement(element) || !isVisible(element)) {
          continue;
        }
        const node = this.captureNode(element);
        if (!node) {
          continue;
        }
        if (seen.has(node.targetRef.refId)) {
          continue;
        }
        seen.add(node.targetRef.refId);
        nodes.push(node);
      }

      return {
        origin: location.origin,
        url: location.href,
        title: document.title,
        nodes
      };
    },

    captureNode(element) {
      if (element instanceof HTMLAnchorElement) {
        const text = getLabelText(element);
        if (!text && !element.href) {
          return null;
        }
        return {
          id: nextId(),
          kind: "link",
          text: text || element.href,
          action: "navigate",
          href: element.href,
          targetRef: ensureElementRef(element)
        };
      }

      if (element instanceof HTMLButtonElement) {
        const text = getLabelText(element);
        if (!text) {
          return null;
        }
        return {
          id: nextId(),
          kind: "button",
          text,
          action: "click",
          formRefId: getFormId(element.form),
          targetRef: ensureElementRef(element)
        };
      }

      if (element instanceof HTMLInputElement) {
        const inputType = (element.type || "text").toLowerCase();
        if (["hidden", "file", "image", "range", "color"].includes(inputType)) {
          return null;
        }
        if (inputType === "checkbox") {
          return {
            id: nextId(),
            kind: "checkbox",
            text: getLabelText(element) || "Checkbox",
            checked: element.checked,
            action: "toggle",
            formRefId: getFormId(element.form),
            targetRef: ensureElementRef(element)
          };
        }
        if (inputType === "radio") {
          return {
            id: nextId(),
            kind: "radio",
            text: getLabelText(element) || "Radio option",
            checked: element.checked,
            value: element.value,
            action: "toggle",
            formRefId: getFormId(element.form),
            targetRef: ensureElementRef(element)
          };
        }
        if (["submit", "button", "reset"].includes(inputType)) {
          const text = getLabelText(element);
          if (!text) {
            return null;
          }
          return {
            id: nextId(),
            kind: "button",
            text,
            action: inputType === "submit" ? "submit" : "click",
            formRefId: getFormId(element.form),
            targetRef: ensureElementRef(element)
          };
        }
        return {
          id: nextId(),
          kind: "input",
          text: getLabelText(element) || "Input",
          value: element.value,
          inputType,
          placeholder: element.placeholder || "",
          action: "input",
          formRefId: getFormId(element.form),
          targetRef: ensureElementRef(element)
        };
      }

      if (element instanceof HTMLTextAreaElement) {
        return {
          id: nextId(),
          kind: "textarea",
          text: getLabelText(element) || "Textarea",
          value: element.value,
          placeholder: element.placeholder || "",
          action: "input",
          formRefId: getFormId(element.form),
          targetRef: ensureElementRef(element)
        };
      }

      if (element instanceof HTMLSelectElement) {
        const options = Array.from(element.options).map((option) => ({
          label: normalizeText(option.textContent),
          value: option.value,
          selected: option.selected
        }));
        return {
          id: nextId(),
          kind: "select",
          text: getLabelText(element) || "Select",
          value: element.value,
          options,
          action: "input",
          formRefId: getFormId(element.form),
          targetRef: ensureElementRef(element)
        };
      }

      if (element instanceof HTMLFormElement) {
        const label = normalizeText(element.getAttribute("aria-label") || element.name || "Form");
        return {
          id: nextId(),
          kind: "form",
          text: label,
          action: "submit",
          targetRef: ensureElementRef(element)
        };
      }

      if (HEADING_TAGS.has(element.tagName)) {
        const text = getLabelText(element);
        if (!text) {
          return null;
        }
        return {
          id: nextId(),
          kind: "heading",
          text,
          level: Number(element.tagName.slice(1)),
          targetRef: ensureElementRef(element)
        };
      }

      if (TEXT_TAGS.has(element.tagName) && !element.children.length) {
        const text = normalizeText(element.innerText || element.textContent);
        if (!text) {
          return null;
        }
        return {
          id: nextId(),
          kind: "text",
          text,
          targetRef: ensureElementRef(element)
        };
      }

      return null;
    }
  };

  const bridge = {
    findLiveElement(targetRef) {
      if (!targetRef || !targetRef.refId) {
        return null;
      }
      return document.querySelector(`[${ATTR_ID}="${CSS.escape(targetRef.refId)}"]`);
    },

    dispatchInputLikeEvents(element) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },

    focusNativeElement(element) {
      if (typeof element.focus === "function") {
        element.focus({ preventScroll: true });
      }
    },

    activate(node, overlayElement) {
      const target = this.findLiveElement(node.targetRef);
      if (!target) {
        scheduleRefresh();
        return;
      }

      switch (node.kind) {
        case "link":
          if (target instanceof HTMLAnchorElement && target.href) {
            target.click();
          }
          break;
        case "button":
          if (target instanceof HTMLElement) {
            target.click();
          }
          break;
        case "input":
          if (target instanceof HTMLInputElement) {
            target.value = overlayElement.value;
            this.dispatchInputLikeEvents(target);
            this.focusNativeElement(target);
          }
          break;
        case "textarea":
          if (target instanceof HTMLTextAreaElement) {
            target.value = overlayElement.value;
            this.dispatchInputLikeEvents(target);
            this.focusNativeElement(target);
          }
          break;
        case "select":
          if (target instanceof HTMLSelectElement) {
            target.value = overlayElement.value;
            this.dispatchInputLikeEvents(target);
          }
          break;
        case "checkbox":
        case "radio":
          if (target instanceof HTMLInputElement) {
            if (node.kind === "radio") {
              if (overlayElement.checked && !target.checked) {
                target.click();
              }
            } else if (target.checked !== overlayElement.checked) {
              target.click();
            }
          }
          break;
        case "form":
          if (target instanceof HTMLFormElement) {
            if (typeof target.requestSubmit === "function") {
              target.requestSubmit();
            } else {
              target.submit();
            }
          }
          break;
        default:
          break;
      }

      scheduleRefresh(INTERACTION_REBUILD_MS);
    },

    submitFromNode(node) {
      const target = this.findLiveElement(node.targetRef);
      if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) {
        target.click();
        scheduleRefresh(INTERACTION_REBUILD_MS);
        return;
      }

      if (node.formRefId) {
        const form = document.querySelector(`[${ATTR_ID}="${CSS.escape(node.formRefId)}"]`);
        if (form instanceof HTMLFormElement) {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
          } else {
            form.submit();
          }
          scheduleRefresh(INTERACTION_REBUILD_MS);
        }
      }
    }
  };

  const render = {
    ensureToggle(enabled) {
      let root = document.getElementById(TOGGLE_ID);
      if (!root) {
        root = document.createElement("div");
        root.id = TOGGLE_ID;
        document.documentElement.appendChild(root);
      }

      const shadow = root.shadowRoot || (root.attachShadow ? root.attachShadow({ mode: "open" }) : root);
      root.innerHTML = "";
      shadow.innerHTML = "";
      const mount = shadow === root ? root : shadow;

      const style = document.createElement("style");
      style.textContent = `
        .reframe-toggle {
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 2147483647;
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px;
          border: 1px solid #000;
          background: #fff;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
          font: 12px/1.2 Arial, sans-serif;
          color: #000;
        }
        .reframe-toggle button {
          border: 1px solid #000;
          background: #fff;
          color: #000;
          padding: 6px 10px;
          cursor: pointer;
          font: inherit;
        }
        .reframe-toggle .status {
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
      `;
      const wrapper = document.createElement("div");
      wrapper.className = "reframe-toggle";
      const status = document.createElement("span");
      status.className = "status";
      status.textContent = enabled ? "Reworked" : "Native";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = enabled ? "Unrework" : "Rework";
      button.addEventListener("click", () => {
        runtime.toggleMode(!runtimeState.enabled);
      });
      wrapper.append(status, button);
      mount.append(style, wrapper);
    },

    mountOverlay(page) {
      this.unmountOverlay(false);
      const root = document.createElement("div");
      root.id = OVERLAY_ROOT_ID;
      root.innerHTML = `
        <div class="reframe-shell">
          <div class="reframe-toolbar">
            <div class="reframe-toolbar-title">Reworked view</div>
            <div class="reframe-toolbar-actions">
              <button type="button" data-command="refresh">Refresh capture</button>
              <button type="button" data-command="disable">Unrework</button>
            </div>
          </div>
          <main class="reframe-content"></main>
        </div>
      `;
      const style = document.createElement("style");
      style.textContent = `
        #${OVERLAY_ROOT_ID} {
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          overflow: auto;
          background: rgba(255, 255, 255, 0.96);
          color: #000;
          font: 16px/1.5 Georgia, "Times New Roman", serif;
        }
        #${OVERLAY_ROOT_ID} * {
          box-sizing: border-box;
        }
        #${OVERLAY_ROOT_ID} .reframe-shell {
          min-height: 100%;
          padding: 72px 24px 48px;
        }
        #${OVERLAY_ROOT_ID} .reframe-toolbar {
          position: sticky;
          top: 0;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          padding: 12px 16px;
          margin: -60px auto 24px;
          max-width: 900px;
          border: 2px solid #000;
          background: #fff;
        }
        #${OVERLAY_ROOT_ID} .reframe-toolbar-title {
          font: 700 14px/1.2 Arial, sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        #${OVERLAY_ROOT_ID} .reframe-toolbar-actions {
          display: flex;
          gap: 8px;
        }
        #${OVERLAY_ROOT_ID} .reframe-toolbar button,
        #${OVERLAY_ROOT_ID} .reframe-content button,
        #${OVERLAY_ROOT_ID} .reframe-content select,
        #${OVERLAY_ROOT_ID} .reframe-content input,
        #${OVERLAY_ROOT_ID} .reframe-content textarea {
          border: 1px solid #000;
          background: #fff;
          color: #000;
          font: 14px/1.4 Arial, sans-serif;
          padding: 10px 12px;
        }
        #${OVERLAY_ROOT_ID} .reframe-toolbar button,
        #${OVERLAY_ROOT_ID} .reframe-content button,
        #${OVERLAY_ROOT_ID} .reframe-content a {
          cursor: pointer;
        }
        #${OVERLAY_ROOT_ID} .reframe-content {
          max-width: 900px;
          margin: 0 auto;
        }
        #${OVERLAY_ROOT_ID} .reframe-node {
          margin: 0 0 18px;
        }
        #${OVERLAY_ROOT_ID} h1,
        #${OVERLAY_ROOT_ID} h2,
        #${OVERLAY_ROOT_ID} h3,
        #${OVERLAY_ROOT_ID} h4,
        #${OVERLAY_ROOT_ID} h5,
        #${OVERLAY_ROOT_ID} h6 {
          margin: 26px 0 10px;
          font-weight: 700;
          line-height: 1.15;
        }
        #${OVERLAY_ROOT_ID} p {
          margin: 0;
        }
        #${OVERLAY_ROOT_ID} .reframe-link {
          display: inline-block;
          border: 1px solid #000;
          padding: 10px 12px;
          color: #000;
          text-decoration: none;
        }
        #${OVERLAY_ROOT_ID} .reframe-control {
          display: grid;
          gap: 8px;
        }
        #${OVERLAY_ROOT_ID} .reframe-choice {
          display: flex;
          align-items: center;
          gap: 10px;
          font: 14px/1.4 Arial, sans-serif;
        }
        #${OVERLAY_ROOT_ID} .reframe-meta {
          margin: 0 0 24px;
          font: 12px/1.4 Arial, sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
      `;
      root.prepend(style);
      const content = root.querySelector(".reframe-content");
      const meta = document.createElement("div");
      meta.className = "reframe-meta";
      meta.textContent = `${page.title || "Untitled"} | ${page.url}`;
      content.appendChild(meta);

      for (const node of page.nodes) {
        const view = this.renderNode(node);
        if (view) {
          content.appendChild(view);
        }
      }

      root.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-command]");
        if (!button) {
          return;
        }
        const command = button.getAttribute("data-command");
        if (command === "disable") {
          runtime.toggleMode(false);
        } else if (command === "refresh") {
          runtime.refreshOverlay(true);
        }
      });
      root.scrollTop = runtimeState.overlayScrollTop;
      root.addEventListener("scroll", () => {
        runtimeState.overlayScrollTop = root.scrollTop;
      });

      document.documentElement.appendChild(root);
      runtimeState.overlayRoot = root;
    },

    renderNode(node) {
      const container = document.createElement("section");
      container.className = "reframe-node";
      container.dataset.nodeId = node.id;

      switch (node.kind) {
        case "heading": {
          const heading = document.createElement(`h${Math.min(Math.max(node.level || 2, 1), 6)}`);
          heading.textContent = node.text;
          container.appendChild(heading);
          return container;
        }
        case "text": {
          const paragraph = document.createElement("p");
          paragraph.textContent = node.text;
          container.appendChild(paragraph);
          return container;
        }
        case "link": {
          const link = document.createElement("a");
          link.href = node.href || "#";
          link.className = "reframe-link";
          link.textContent = node.text || node.href || "Open link";
          link.addEventListener("click", (event) => {
            event.preventDefault();
            bridge.activate(node, link);
          });
          container.appendChild(link);
          return container;
        }
        case "button": {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = node.text || "Button";
          button.addEventListener("click", () => {
            if (node.action === "submit") {
              bridge.submitFromNode(node);
            } else {
              bridge.activate(node, button);
            }
          });
          container.appendChild(button);
          return container;
        }
        case "input": {
          const wrapper = document.createElement("label");
          wrapper.className = "reframe-control";
          const label = document.createElement("span");
          label.textContent = node.text || "Input";
          const input = document.createElement("input");
          input.type = node.inputType === "email" || node.inputType === "number" || node.inputType === "password" ? node.inputType : "text";
          input.value = node.value || "";
          input.placeholder = node.placeholder || "";
          input.addEventListener("input", () => bridge.activate(node, input));
          wrapper.append(label, input);
          container.appendChild(wrapper);
          return container;
        }
        case "textarea": {
          const wrapper = document.createElement("label");
          wrapper.className = "reframe-control";
          const label = document.createElement("span");
          label.textContent = node.text || "Textarea";
          const textarea = document.createElement("textarea");
          textarea.value = node.value || "";
          textarea.placeholder = node.placeholder || "";
          textarea.rows = 4;
          textarea.addEventListener("input", () => bridge.activate(node, textarea));
          wrapper.append(label, textarea);
          container.appendChild(wrapper);
          return container;
        }
        case "select": {
          const wrapper = document.createElement("label");
          wrapper.className = "reframe-control";
          const label = document.createElement("span");
          label.textContent = node.text || "Select";
          const select = document.createElement("select");
          for (const option of node.options || []) {
            const optionElement = document.createElement("option");
            optionElement.value = option.value;
            optionElement.textContent = option.label || option.value;
            optionElement.selected = option.selected;
            select.appendChild(optionElement);
          }
          select.value = node.value || "";
          select.addEventListener("change", () => bridge.activate(node, select));
          wrapper.append(label, select);
          container.appendChild(wrapper);
          return container;
        }
        case "checkbox":
        case "radio": {
          const label = document.createElement("label");
          label.className = "reframe-choice";
          const input = document.createElement("input");
          input.type = node.kind;
          input.checked = Boolean(node.checked);
          input.addEventListener("change", () => bridge.activate(node, input));
          const text = document.createElement("span");
          text.textContent = node.text || node.kind;
          label.append(input, text);
          container.appendChild(label);
          return container;
        }
        case "form": {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = node.text ? `Submit ${node.text}` : "Submit form";
          button.addEventListener("click", () => bridge.activate(node, button));
          container.appendChild(button);
          return container;
        }
        default:
          return null;
      }
    },

    unmountOverlay(resetScroll = true) {
      if (runtimeState.overlayRoot) {
        runtimeState.overlayRoot.remove();
        runtimeState.overlayRoot = null;
      }
      if (resetScroll) {
        runtimeState.overlayScrollTop = 0;
      }
    }
  };

  const state = {
    async getMode(origin) {
      const key = storageKeyForOrigin(origin);
      const result = await chrome.storage.local.get([key]);
      return result[key] || null;
    },

    async setMode(origin, enabled) {
      const key = storageKeyForOrigin(origin);
      await chrome.storage.local.set({
        [key]: {
          origin,
          enabled,
          lastUpdatedAt: new Date().toISOString()
        }
      });
    }
  };

  function buildStructureKey(page) {
    return page.nodes
      .map((node) => `${node.kind}:${node.text || ""}:${node.value || ""}:${node.checked ? "1" : "0"}`)
      .join("|")
      .slice(0, 6000);
  }

  function scheduleRefresh(delay = REBUILD_DEBOUNCE_MS) {
    window.clearTimeout(runtimeState.refreshTimer);
    runtimeState.refreshTimer = window.setTimeout(() => {
      runtime.refreshOverlay(false);
    }, delay);
  }

  function installRouteListeners() {
    const notifyRouteChange = () => {
      if (runtimeState.lastUrl === location.href) {
        return;
      }
      runtimeState.lastUrl = location.href;
      runtime.handleRouteChange();
    };

    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      if (typeof original !== "function") {
        return;
      }
      history[methodName] = function wrappedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.setTimeout(notifyRouteChange, 0);
        return result;
      };
    };

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");
    window.addEventListener("popstate", notifyRouteChange);
    window.addEventListener("hashchange", notifyRouteChange);
  }

  function installMutationSync() {
    const onMutation = debounce(() => {
      if (!runtimeState.enabled || runtimeState.isApplyingState) {
        return;
      }
      runtime.refreshOverlay(false);
    }, REBUILD_DEBOUNCE_MS);

    runtimeState.syncObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutationTouchesOnlyExtensionDom(mutation)) {
          continue;
        }
        onMutation();
        break;
      }
    });

    runtimeState.syncObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  const runtime = {
    async init() {
      render.ensureToggle(false);
      installRouteListeners();
      installMutationSync();
      const persisted = await state.getMode(location.origin);
      if (persisted && persisted.enabled) {
        await this.toggleMode(true, { persist: false });
      }
    },

    async toggleMode(enabled, options = {}) {
      const persist = options.persist !== false;
      runtimeState.enabled = enabled;
      render.ensureToggle(enabled);

      if (persist) {
        await state.setMode(location.origin, enabled);
      }

      if (enabled) {
        this.refreshOverlay(true);
      } else {
        render.unmountOverlay();
      }
    },

    refreshOverlay(force) {
      if (!runtimeState.enabled) {
        return;
      }

      runtimeState.isApplyingState = true;
      const page = capture.capturePage();
      const structureKey = buildStructureKey(page);
      if (!force && structureKey === runtimeState.lastStructureKey && runtimeState.currentPage && page.url === runtimeState.currentPage.url) {
        runtimeState.isApplyingState = false;
        return;
      }
      runtimeState.currentPage = page;
      runtimeState.lastStructureKey = structureKey;
      render.mountOverlay(page);
      runtimeState.isApplyingState = false;
    },

    async handleRouteChange() {
      const persisted = await state.getMode(location.origin);
      const shouldEnable = Boolean(persisted && persisted.enabled);
      runtimeState.lastStructureKey = "";
      if (shouldEnable) {
        if (!runtimeState.enabled) {
          runtimeState.enabled = true;
          render.ensureToggle(true);
        }
        this.refreshOverlay(true);
      } else if (runtimeState.enabled) {
        await this.toggleMode(false, { persist: false });
      } else {
        render.ensureToggle(false);
      }
    }
  };

  runtime.init();
})();
