(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const constants = Reframe.constants;
  const utils = Reframe.utils;

  const renderState = {
    overlayHost: null,
    overlayShadow: null,
    toggleHost: null,
    toggleShadow: null,
    nodeMap: new Map(),
    onAction: null,
    scrollTop: 0
  };

  function ensureShadowHost(id, zIndex) {
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      document.documentElement.appendChild(host);
    }
    host.style.position = "fixed";
    host.style.inset = id === constants.OVERLAY_HOST_ID ? "0" : "auto";
    host.style.zIndex = String(zIndex);
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    return { host, shadow };
  }

  function renderToggle(enabled, onToggle) {
    const { host, shadow } = ensureShadowHost(constants.TOGGLE_HOST_ID, 2147483647);
    renderState.toggleHost = host;
    renderState.toggleShadow = shadow;
    host.style.inset = "auto";
    host.style.top = "12px";
    host.style.right = "12px";
    host.style.left = "auto";
    host.style.bottom = "auto";
    host.style.width = "max-content";
    host.style.height = "auto";
    host.style.pointerEvents = "auto";
    host.style.display = "block";

    shadow.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `
      button {
        border: 1px solid #000;
        background: #fff;
        color: #000;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
        cursor: pointer;
        font: 700 12px/1 Arial, sans-serif;
        letter-spacing: 0;
        padding: 9px 12px;
      }
      button:focus {
        outline: 2px solid #000;
        outline-offset: 2px;
      }
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = enabled ? "Unrework" : "Rework";
    button.addEventListener("click", () => onToggle(!enabled));
    shadow.append(style, button);
  }

  function overlayCss() {
    return `
      :host {
        all: initial;
      }
      .overlay {
        position: fixed;
        inset: 0;
        overflow: auto;
        background: canvas;
        color: canvastext;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 1.45;
      }
      .page {
        min-height: 100%;
        padding: 0;
      }
      .rf-node {
        box-sizing: border-box;
        min-width: 0;
      }
      .rf-layout-flex {
        display: flex;
        flex-wrap: var(--rf-wrap, wrap);
        gap: var(--rf-gap, normal);
        align-items: var(--rf-align, stretch);
        justify-content: var(--rf-justify, flex-start);
      }
      .rf-layout-grid {
        display: grid;
        gap: var(--rf-gap, normal);
        grid-template-columns: var(--rf-grid-columns, none);
      }
      section,
      article,
      aside,
      header,
      footer,
      nav,
      form,
      main,
      div {
        display: block;
      }
      a,
      button,
      input,
      textarea,
      select {
        font: inherit;
      }
      button,
      a,
      input,
      textarea,
      select,
      summary {
        cursor: pointer;
      }
      label {
        display: inline-grid;
        gap: 0.35em;
      }
      input[type="checkbox"],
      input[type="radio"] {
        width: auto;
      }
      textarea {
        min-height: 96px;
        resize: vertical;
      }
      img {
        display: block;
        max-width: 100%;
        height: auto;
      }
      table {
        border-collapse: collapse;
      }
      th, td {
        vertical-align: top;
      }
      .rf-choice {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .rf-placeholder {
        border: 1px dashed currentColor;
        padding: 16px;
        min-height: 80px;
      }
      .rf-disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      @media (max-width: 640px) {
        .page {
          padding: 16px;
        }
        .rf-layout-flex,
        .rf-layout-grid,
        .rf-nav {
          display: block;
        }
      }
    `;
  }

  function applyLayout(element, node) {
    const layout = node.layout || {};
    const tagName = node.tagName || "";
    element.classList.add(`rf-${tagName || node.kind}`);
    applyVisualStyle(element, node);
    applySpacing(element, node);

    if (layout.display === "flex" || layout.display === "inline-flex") {
      element.classList.add("rf-layout-flex");
      element.style.setProperty("--rf-gap", normalizeGap(layout.gap));
      element.style.setProperty("--rf-align", layout.alignItems || "stretch");
      element.style.setProperty("--rf-justify", layout.justifyContent || "flex-start");
      element.style.setProperty("--rf-wrap", layout.flexWrap || "wrap");
      if (layout.flexDirection && layout.flexDirection.includes("column")) {
        element.style.flexDirection = "column";
      }
    } else if (layout.display === "grid" || layout.display === "inline-grid") {
      element.classList.add("rf-layout-grid");
      element.style.setProperty("--rf-gap", normalizeGap(layout.gap));
      if (layout.gridTemplateColumns && layout.gridTemplateColumns !== "none") {
        element.style.setProperty("--rf-grid-columns", safeGridTemplate(layout.gridTemplateColumns));
      }
    } else if (safeDisplayValue(layout.display)) {
      element.style.display = layout.display;
    }

    if (shouldPreserveWidth(node) && layout.width > 0) {
      element.style.width = `${layout.width}px`;
      element.style.maxWidth = "100%";
    }
    if ((node.kind === "image" || node.kind === "visual") && layout.height > 0) {
      element.style.aspectRatio = `${Math.max(layout.width, 1)} / ${Math.max(layout.height, 1)}`;
    }
    if (node.kind === "visual" && layout.height > 0) {
      element.style.minHeight = `${Math.min(Math.max(layout.height, 8), 640)}px`;
    }
  }

  function applyVisualStyle(element, node) {
    const style = node.style || {};
    setIfSafe(element, "color", style.color);
    setIfSafe(element, "backgroundColor", nonTransparent(style.backgroundColor));
    setIfSafe(element, "backgroundImage", style.backgroundImage);
    setIfSafe(element, "fontFamily", style.fontFamily);
    setIfSafe(element, "fontStyle", style.fontStyle);
    setIfSafe(element, "lineHeight", style.lineHeight);
    setIfSafe(element, "letterSpacing", style.letterSpacing);
    setIfSafe(element, "textTransform", style.textTransform);
    setIfSafe(element, "textAlign", style.textAlign);
    setIfSafe(element, "textDecorationLine", style.textDecorationLine);
    setIfSafe(element, "textDecorationStyle", style.textDecorationStyle);
    setIfSafe(element, "textDecorationColor", style.textDecorationColor);
    setIfSafe(element, "boxShadow", style.boxShadow);
    setIfSafe(element, "opacity", style.opacity);
    setIfSafe(element, "borderRadius", style.borderRadius);

    const fontSize = utils.clampNumber(style.fontSize, 16, 9, 72);
    element.style.fontSize = `${fontSize}px`;
    if (style.fontWeight) {
      element.style.fontWeight = style.fontWeight;
    }
    if (style.objectFit) {
      element.style.objectFit = style.objectFit;
    }
    if (style.objectPosition) {
      element.style.objectPosition = style.objectPosition;
    }
    if (style.listStyleType && node.kind === "list") {
      element.style.listStyleType = style.listStyleType;
    }
    applyBorder(element, style);
  }

  function applySpacing(element, node) {
    const layout = node.layout || {};
    if (node.kind === "root") {
      return;
    }

    for (const [property, value] of [
      ["paddingTop", layout.paddingTop],
      ["paddingRight", layout.paddingRight],
      ["paddingBottom", layout.paddingBottom],
      ["paddingLeft", layout.paddingLeft],
      ["marginTop", layout.marginTop],
      ["marginRight", layout.marginRight],
      ["marginBottom", layout.marginBottom],
      ["marginLeft", layout.marginLeft]
    ]) {
      const normalized = safeLength(value, 96);
      if (normalized) {
        element.style[property] = normalized;
      }
    }
  }

  function applyBorder(element, style) {
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const width = style[`border${side}Width`];
      const borderStyle = style[`border${side}Style`];
      const color = style[`border${side}Color`];
      if (!width || width === "0px" || !borderStyle || borderStyle === "none") {
        continue;
      }
      element.style[`border${side}`] = `${safeLength(width, 24) || "1px"} ${borderStyle} ${color || "currentColor"}`;
    }
  }

  function normalizeGap(value) {
    if (!value || value === "normal") {
      return "normal";
    }
    return value
      .split(" ")
      .map((part) => safeLength(part, 120) || "0px")
      .join(" ");
  }

  function safeGridTemplate(value) {
    if (!value || value === "none" || value.length > 400) {
      return "none";
    }
    return value;
  }

  function safeDisplayValue(value) {
    return [
      "block",
      "inline-block",
      "list-item",
      "table",
      "table-row-group",
      "table-header-group",
      "table-footer-group",
      "table-row",
      "table-cell",
      "flow-root"
    ].includes(value);
  }

  function safeLength(value, maxPx) {
    if (!value || value === "auto" || value === "normal") {
      return "";
    }
    if (value.endsWith("px")) {
      const clamped = utils.clampNumber(value, 0, -maxPx, maxPx);
      return `${clamped}px`;
    }
    if (/^-?\d+(\.\d+)?(em|rem|%)$/.test(value)) {
      return value;
    }
    return "";
  }

  function setIfSafe(element, property, value) {
    if (!value || value === "normal" || value === "none") {
      return;
    }
    element.style[property] = value;
  }

  function nonTransparent(value) {
    if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") {
      return "";
    }
    return value;
  }

  function shouldPreserveWidth(node) {
    return ["button", "input", "textarea", "select", "image", "visual", "placeholder"].includes(node.kind);
  }

  function registerNode(node) {
    if (node && node.id) {
      renderState.nodeMap.set(node.id, node);
    }
  }

  function renderChildren(parent, node) {
    for (const child of node.children || []) {
      const childElement = renderNode(child);
      if (childElement) {
        parent.appendChild(childElement);
      }
    }
  }

  function renderNode(node) {
    registerNode(node);

    switch (node.kind) {
      case "root": {
        const root = document.createElement("main");
        root.className = "rf-node rf-root page";
        applyLayout(root, node);
        renderChildren(root, node);
        return root;
      }
      case "heading": {
        const heading = document.createElement(`h${Math.min(Math.max(node.level || 2, 1), 6)}`);
        heading.className = "rf-node";
        heading.textContent = node.text || "";
        heading.dataset.nodeId = node.id;
        applyLayout(heading, node);
        renderChildren(heading, node);
        return heading;
      }
      case "text": {
        const paragraph = document.createElement("p");
        paragraph.className = "rf-node";
        paragraph.textContent = node.text || "";
        paragraph.dataset.nodeId = node.id;
        applyLayout(paragraph, node);
        return paragraph;
      }
      case "link": {
        const link = document.createElement("a");
        link.className = "rf-node";
        link.href = node.attributes && node.attributes.href ? node.attributes.href : "#";
        link.textContent = node.text || link.href || "Link";
        link.dataset.nodeId = node.id;
        link.dataset.action = "activate";
        applyLayout(link, node);
        renderChildren(link, node);
        return link;
      }
      case "button": {
        const button = document.createElement("button");
        button.className = "rf-node rf-button";
        button.type = "button";
        button.textContent = node.text || "Button";
        button.dataset.nodeId = node.id;
        button.dataset.action = "activate";
        applyLayout(button, node);
        renderChildren(button, node);
        return button;
      }
      case "input":
      case "textarea":
      case "select":
      case "checkbox":
      case "radio":
        return renderControl(node);
      case "image":
        return renderImage(node);
      case "visual":
        return renderVisual(node);
      case "placeholder":
        return renderPlaceholder(node);
      case "list": {
        const list = document.createElement(node.tagName === "ol" ? "ol" : "ul");
        list.className = "rf-node";
        list.dataset.nodeId = node.id;
        applyLayout(list, node);
        renderChildren(list, node);
        return list;
      }
      case "listitem": {
        const item = document.createElement("li");
        item.className = "rf-node";
        item.dataset.nodeId = node.id;
        applyLayout(item, node);
        renderChildren(item, node);
        return item;
      }
      case "table":
      case "tableSection":
      case "row":
      case "cell":
        return renderTableNode(node);
      case "form":
      case "container":
      default: {
        const section = document.createElement(node.kind === "form" ? "form" : containerTag(node));
        section.className = `rf-node rf-${node.kind}`;
        section.dataset.nodeId = node.id;
        if (node.kind === "form") {
          section.dataset.action = "submit";
        }
        applyLayout(section, node);
        if (node.text && node.kind === "form") {
          const legend = document.createElement("p");
          legend.textContent = node.text;
          legend.style.fontWeight = "700";
          section.appendChild(legend);
        }
        renderChildren(section, node);
        return section;
      }
    }
  }

  function renderControl(node) {
    const wrapper = document.createElement("label");
    wrapper.className = node.kind === "checkbox" || node.kind === "radio" ? "rf-node rf-choice" : "rf-node";
    wrapper.dataset.nodeId = node.id;
    applyLayout(wrapper, node);

    const labelText = document.createElement("span");
    labelText.textContent = node.text || labelForKind(node.kind);

    let control;
    if (node.kind === "textarea") {
      control = document.createElement("textarea");
      control.value = node.state.value || "";
      control.placeholder = node.state.placeholder || "";
    } else if (node.kind === "select") {
      control = document.createElement("select");
      for (const option of node.state.options || []) {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.label || option.value;
        optionElement.selected = option.selected;
        optionElement.disabled = option.disabled;
        control.appendChild(optionElement);
      }
      control.value = node.state.value || "";
    } else {
      control = document.createElement("input");
      if (node.kind === "checkbox" || node.kind === "radio") {
        control.type = node.kind;
        control.checked = Boolean(node.state.checked);
      } else {
        control.type = safeInputType(node.state.type);
        control.value = node.state.value || "";
        control.placeholder = node.state.placeholder || "";
      }
    }

    control.disabled = Boolean(node.state.disabled);
    control.required = Boolean(node.state.required);
    control.dataset.nodeId = node.id;
    control.dataset.action = "activate";
    applyControlStyle(control, node);
    if (control.disabled) {
      wrapper.classList.add("rf-disabled");
    }

    if (node.kind === "checkbox" || node.kind === "radio") {
      wrapper.append(control, labelText);
    } else {
      wrapper.append(labelText, control);
    }
    return wrapper;
  }

  function containerTag(node) {
    return [
      "header",
      "footer",
      "nav",
      "main",
      "section",
      "article",
      "aside",
      "div",
      "fieldset",
      "legend",
      "details",
      "summary",
      "dialog"
    ].includes(node.tagName)
      ? node.tagName
      : "section";
  }

  function applyControlStyle(control, node) {
    const style = node.style || {};
    setIfSafe(control, "color", style.color);
    setIfSafe(control, "backgroundColor", nonTransparent(style.backgroundColor));
    setIfSafe(control, "fontFamily", style.fontFamily);
    setIfSafe(control, "fontSize", style.fontSize);
    setIfSafe(control, "fontWeight", style.fontWeight);
    setIfSafe(control, "borderRadius", style.borderRadius);
    applyBorder(control, style);
    const layout = node.layout || {};
    for (const [property, value] of [
      ["paddingTop", layout.paddingTop],
      ["paddingRight", layout.paddingRight],
      ["paddingBottom", layout.paddingBottom],
      ["paddingLeft", layout.paddingLeft]
    ]) {
      const normalized = safeLength(value, 96);
      if (normalized) {
        control.style[property] = normalized;
      }
    }
  }

  function safeInputType(type) {
    return ["email", "number", "password", "search", "tel", "url", "date", "time"].includes(type) ? type : "text";
  }

  function labelForKind(kind) {
    if (kind === "textarea") {
      return "Textarea";
    }
    if (kind === "select") {
      return "Select";
    }
    return "Input";
  }

  function renderImage(node) {
    const image = document.createElement("img");
    image.className = "rf-node";
    image.dataset.nodeId = node.id;
    image.src = (node.attributes && node.attributes.src) || "";
    image.alt = node.text || (node.attributes && node.attributes.alt) || "";
    applyLayout(image, node);
    return image;
  }

  function renderVisual(node) {
    const visual = document.createElement("div");
    visual.className = "rf-node rf-visual";
    visual.dataset.nodeId = node.id;
    if (node.text) {
      visual.setAttribute("aria-label", node.text);
      visual.setAttribute("role", "img");
    } else {
      visual.setAttribute("aria-hidden", "true");
    }
    applyLayout(visual, node);
    return visual;
  }

  function renderPlaceholder(node) {
    const placeholder = document.createElement("div");
    placeholder.className = "rf-node rf-placeholder";
    placeholder.dataset.nodeId = node.id;
    placeholder.textContent = node.text || `${node.tagName || "Embedded"} content`;
    applyLayout(placeholder, node);
    return placeholder;
  }

  function renderTableNode(node) {
    const tag =
      node.kind === "table"
        ? "table"
        : node.kind === "tableSection"
          ? node.tagName
          : node.kind === "row"
            ? "tr"
            : node.tagName === "th"
              ? "th"
              : "td";
    const element = document.createElement(tag);
    element.className = "rf-node";
    element.dataset.nodeId = node.id;
    applyLayout(element, node);
    renderChildren(element, node);
    return element;
  }

  function mountOverlay(page, onAction) {
    renderState.onAction = onAction;
    const focusedNodeId = getFocusedNodeId();
    const { host, shadow } = ensureShadowHost(constants.OVERLAY_HOST_ID, 2147483646);
    renderState.overlayHost = host;
    renderState.overlayShadow = shadow;
    renderState.nodeMap = new Map();
    host.style.pointerEvents = "auto";
    host.style.inset = "0";

    shadow.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = overlayCss();
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.appendChild(renderNode(page.root));
    overlay.scrollTop = renderState.scrollTop;
    overlay.addEventListener("scroll", () => {
      renderState.scrollTop = overlay.scrollTop;
    });
    shadow.append(style, overlay);
    installDelegatedEvents(shadow);
    restoreFocus(focusedNodeId);
  }

  function getFocusedNodeId() {
    const active = renderState.overlayShadow && renderState.overlayShadow.activeElement;
    return active ? active.dataset.nodeId || "" : "";
  }

  function restoreFocus(nodeId) {
    if (!nodeId || !renderState.overlayShadow) {
      return;
    }
    const next = renderState.overlayShadow.querySelector(`[data-node-id="${CSS.escape(nodeId)}"][data-action]`);
    if (next && typeof next.focus === "function") {
      next.focus({ preventScroll: true });
    }
  }

  function installDelegatedEvents(shadow) {
    if (shadow.__reframeEventsInstalled) {
      return;
    }
    shadow.__reframeEventsInstalled = true;

    shadow.addEventListener("click", (event) => {
      const target = actionTarget(event);
      if (!target) {
        return;
      }
      const node = renderState.nodeMap.get(target.dataset.nodeId);
      if (!node) {
        return;
      }
      if (!["link", "button", "checkbox", "radio"].includes(node.kind)) {
        return;
      }
      if (node.kind === "link") {
        event.preventDefault();
      }
      renderState.onAction(node, target, "click");
    });

    shadow.addEventListener("keydown", (event) => {
      const target = actionTarget(event);
      if (!target) {
        return;
      }
      const node = renderState.nodeMap.get(target.dataset.nodeId);
      if (!node || !["link", "button"].includes(node.kind)) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      renderState.onAction(node, target, "keydown");
    });

    shadow.addEventListener("input", (event) => {
      const target = actionTarget(event);
      if (!target) {
        return;
      }
      const node = renderState.nodeMap.get(target.dataset.nodeId);
      if (node) {
        renderState.onAction(node, target, "input");
      }
    });

    shadow.addEventListener("change", (event) => {
      const target = actionTarget(event);
      if (!target) {
        return;
      }
      const node = renderState.nodeMap.get(target.dataset.nodeId);
      if (node) {
        renderState.onAction(node, target, "change");
      }
    });

    shadow.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target.closest("form[data-action='submit']");
      if (!form) {
        return;
      }
      const node = renderState.nodeMap.get(form.dataset.nodeId);
      if (node) {
        renderState.onAction(node, form, "submit");
      }
    });
  }

  function actionTarget(event) {
    return event.target instanceof Element ? event.target.closest("[data-action='activate']") : null;
  }

  function unmountOverlay() {
    if (renderState.overlayHost) {
      renderState.overlayHost.remove();
      renderState.overlayHost = null;
      renderState.overlayShadow = null;
      renderState.nodeMap = new Map();
      renderState.scrollTop = 0;
    }
  }

  Reframe.render = {
    renderToggle,
    mountOverlay,
    unmountOverlay
  };
})();
