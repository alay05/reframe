(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const constants = Reframe.constants;
  const utils = Reframe.utils;
  const locator = Reframe.locator;

  function captureLayout(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      alignItems: style.alignItems,
      justifyContent: style.justifyContent,
      gap: style.gap,
      gridTemplateColumns: style.gridTemplateColumns,
      textAlign: style.textAlign,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      marginTop: style.marginTop,
      marginBottom: style.marginBottom,
      marginLeft: style.marginLeft,
      marginRight: style.marginRight,
      borderWidth: style.borderTopWidth,
      borderStyle: style.borderTopStyle,
      borderRadius: style.borderRadius,
      boxSizing: style.boxSizing,
      overflow: style.overflow,
      overflowX: style.overflowX,
      overflowY: style.overflowY
    };
  }

  function captureStyle(element) {
    const style = window.getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      backgroundImage: safeBackgroundImage(style.backgroundImage),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      textDecorationLine: style.textDecorationLine,
      textDecorationStyle: style.textDecorationStyle,
      textDecorationColor: style.textDecorationColor,
      borderTopColor: style.borderTopColor,
      borderRightColor: style.borderRightColor,
      borderBottomColor: style.borderBottomColor,
      borderLeftColor: style.borderLeftColor,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      borderTopStyle: style.borderTopStyle,
      borderRightStyle: style.borderRightStyle,
      borderBottomStyle: style.borderBottomStyle,
      borderLeftStyle: style.borderLeftStyle,
      borderRadius: style.borderRadius,
      boxShadow: safeShadow(style.boxShadow),
      opacity: style.opacity,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      listStyleType: style.listStyleType,
      textAlign: style.textAlign,
      cursor: style.cursor
    };
  }

  function captureStyleTokens(element, layout, style) {
    const rect = element.getBoundingClientRect();
    const area = Math.round(rect.width * rect.height);
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    return {
      hasSurface: hasNonTransparentPaint(style.backgroundColor) || Boolean(style.backgroundImage),
      hasBorder: hasVisibleBorder(style),
      hasShadow: Boolean(style.boxShadow),
      isLargeText: fontSize >= 24,
      isBoldText: fontWeight >= 600,
      isScrollable: layout.overflow === "auto" || layout.overflow === "scroll" || layout.overflowY === "auto" || layout.overflowY === "scroll",
      area,
      size: area > 240000 ? "large" : area > 60000 ? "medium" : "small"
    };
  }

  function safeBackgroundImage(backgroundImage) {
    if (!backgroundImage || backgroundImage === "none") {
      return "";
    }
    if (backgroundImage.includes("url(")) {
      return "";
    }
    return backgroundImage;
  }

  function safeShadow(boxShadow) {
    if (!boxShadow || boxShadow === "none") {
      return "";
    }
    return boxShadow.length > 240 ? "" : boxShadow;
  }

  function hasNonTransparentPaint(value) {
    return Boolean(value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)");
  }

  function hasVisibleBorder(style) {
    return ["Top", "Right", "Bottom", "Left"].some((side) => {
      const width = style[`border${side}Width`];
      const borderStyle = style[`border${side}Style`];
      return width && width !== "0px" && borderStyle && borderStyle !== "none";
    });
  }

  function elementState(element) {
    return {
      ariaExpanded: element.getAttribute("aria-expanded") || "",
      ariaSelected: element.getAttribute("aria-selected") || "",
      ariaCurrent: element.getAttribute("aria-current") || "",
      open: Boolean(element.open),
      disabled: Boolean(element.disabled),
      hidden: Boolean(element.hidden)
    };
  }

  function inputState(element) {
    if (element instanceof HTMLInputElement) {
      return {
        value: element.value,
        checked: element.checked,
        type: (element.type || "text").toLowerCase(),
        placeholder: element.placeholder || "",
        disabled: element.disabled,
        required: element.required
      };
    }
    if (element instanceof HTMLTextAreaElement) {
      return {
        value: element.value,
        placeholder: element.placeholder || "",
        disabled: element.disabled,
        required: element.required
      };
    }
    if (element instanceof HTMLSelectElement) {
      return {
        value: element.value,
        disabled: element.disabled,
        required: element.required,
        multiple: element.multiple,
        options: Array.from(element.options).map((option) => ({
          label: utils.normalizeText(option.textContent),
          value: option.value,
          selected: option.selected,
          disabled: option.disabled
        }))
      };
    }
    return {};
  }

  function classifyElement(element) {
    const tagName = element.tagName;
    const role = utils.elementRole(element);

    if (constants.HEADING_TAGS.has(tagName)) {
      return "heading";
    }
    if (element instanceof HTMLAnchorElement) {
      return "link";
    }
    if (element instanceof HTMLButtonElement) {
      return "button";
    }
    if (tagName === "SUMMARY") {
      return "summary";
    }
    if (element instanceof HTMLInputElement) {
      const type = (element.type || "text").toLowerCase();
      if (["hidden", "file", "image", "range", "color"].includes(type)) {
        return "unsupported";
      }
      if (type === "checkbox") {
        return "checkbox";
      }
      if (type === "radio") {
        return "radio";
      }
      if (["button", "submit", "reset"].includes(type)) {
        return "button";
      }
      return "input";
    }
    if (element instanceof HTMLTextAreaElement) {
      return "textarea";
    }
    if (element instanceof HTMLSelectElement) {
      return "select";
    }
    if (element instanceof HTMLImageElement) {
      return "image";
    }
    if (element instanceof HTMLCanvasElement || element instanceof HTMLVideoElement || element instanceof HTMLIFrameElement) {
      return "placeholder";
    }
    if (role === "img" || hasVisualSurface(element)) {
      return "visual";
    }
    if (tagName === "UL" || tagName === "OL") {
      return "list";
    }
    if (tagName === "LI") {
      return "listitem";
    }
    if (tagName === "TABLE") {
      return "table";
    }
    if (tagName === "THEAD" || tagName === "TBODY" || tagName === "TFOOT") {
      return "tableSection";
    }
    if (tagName === "TR") {
      return "row";
    }
    if (tagName === "TD" || tagName === "TH") {
      return "cell";
    }
    if (tagName === "FORM") {
      return "form";
    }
    if (role === "button") {
      return "button";
    }
    if (role === "link") {
      return "link";
    }
    return "container";
  }

  function hasVisualSurface(element) {
    if (element.children.length || utils.directText(element)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const hasBackground =
      style.backgroundImage !== "none" ||
      (style.backgroundColor &&
        style.backgroundColor !== "transparent" &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)");
    const hasBorder =
      style.borderTopStyle !== "none" &&
      style.borderTopWidth !== "0px";
    return rect.width >= 8 && rect.height >= 8 && (hasBackground || hasBorder);
  }

  function actionFor(kind, element) {
    if (kind === "link") {
      return "navigate";
    }
    if (kind === "button") {
      const type = element instanceof HTMLInputElement ? (element.type || "").toLowerCase() : "";
      return type === "submit" ? "submit" : "click";
    }
    if (kind === "summary") {
      return "click";
    }
    if (kind === "input" || kind === "textarea" || kind === "select") {
      return "input";
    }
    if (kind === "checkbox" || kind === "radio") {
      return "toggle";
    }
    if (kind === "form") {
      return "submit";
    }
    return "";
  }

  function captureSemantic(element, kind) {
    const tagName = element.tagName.toLowerCase();
    const role = utils.elementRole(element);
    return {
      kind,
      tagName,
      role,
      landmark: landmarkFor(tagName, role),
      designRole: designRoleFor(element, kind, tagName, role),
      headingLevel: constants.HEADING_TAGS.has(element.tagName) ? Number(element.tagName.slice(1)) : null,
      listType: tagName === "ol" ? "ordered" : tagName === "ul" ? "unordered" : "",
      tableRole: tableRoleFor(kind),
      isComposite: element.children.length > 0
    };
  }

  function landmarkFor(tagName, role) {
    if (role) {
      return role;
    }
    if (["main", "nav", "header", "footer", "aside", "section", "article", "form"].includes(tagName)) {
      return tagName;
    }
    return "";
  }

  function designRoleFor(element, kind, tagName, role) {
    if (kind === "link" || kind === "button" || kind === "summary") {
      return element.children.length ? "interactiveGroup" : "action";
    }
    if (["input", "textarea", "select", "checkbox", "radio"].includes(kind)) {
      return "control";
    }
    if (kind === "image" || kind === "visual" || kind === "placeholder") {
      return "media";
    }
    if (kind === "heading") {
      return "heading";
    }
    if (kind === "table" || kind === "tableSection" || kind === "row" || kind === "cell") {
      return "data";
    }
    if (tagName === "nav" || role === "navigation") {
      return "navigation";
    }
    if (tagName === "form") {
      return "form";
    }
    if (["article", "section", "aside", "li"].includes(tagName)) {
      return "group";
    }
    return kind === "text" ? "text" : "container";
  }

  function tableRoleFor(kind) {
    if (kind === "table") {
      return "table";
    }
    if (kind === "tableSection") {
      return "section";
    }
    if (kind === "row") {
      return "row";
    }
    if (kind === "cell") {
      return "cell";
    }
    return "";
  }

  function captureContent(element, kind, text) {
    return {
      text,
      directText: utils.directText(element),
      accessibleName: utils.accessibleName(element),
      title: utils.normalizeText(element.getAttribute("title")),
      alt: element instanceof HTMLImageElement ? utils.normalizeText(element.alt) : "",
      href: element instanceof HTMLAnchorElement ? element.href : "",
      source: element instanceof HTMLImageElement ? element.currentSrc || element.src : "",
      textSignature: utils.normalizeText(text || utils.accessibleName(element), 180),
      hasText: Boolean(text),
      hasMedia: kind === "image" || kind === "visual" || kind === "placeholder"
    };
  }

  function captureInteraction(element, kind, action) {
    const isControl = ["input", "textarea", "select", "checkbox", "radio"].includes(kind);
    return {
      action,
      interactive: Boolean(action || element instanceof HTMLAnchorElement || element instanceof HTMLButtonElement || isControl),
      controlType: element instanceof HTMLInputElement ? (element.type || "text").toLowerCase() : kind,
      disabled: Boolean(element.disabled),
      required: Boolean(element.required),
      href: element instanceof HTMLAnchorElement ? element.href : "",
      target: element instanceof HTMLAnchorElement ? element.target : "",
      keyboardActivates: ["link", "button", "summary", "checkbox", "radio"].includes(kind),
      valueMutable: ["input", "textarea", "select", "checkbox", "radio"].includes(kind)
    };
  }

  function directTextNode(text) {
    const normalized = utils.normalizeText(text);
    if (!normalized) {
      return null;
    }
    return {
      id: utils.nextId("node"),
      kind: "text",
      text: normalized,
      tagName: "#text",
      role: "",
      semantic: {
        kind: "text",
        tagName: "#text",
        role: "",
        landmark: "",
        designRole: "text",
        headingLevel: null,
        listType: "",
        tableRole: "",
        isComposite: false
      },
      content: {
        text: normalized,
        directText: normalized,
        accessibleName: normalized,
        title: "",
        alt: "",
        href: "",
        source: "",
        textSignature: utils.normalizeText(normalized, 180),
        hasText: true,
        hasMedia: false
      },
      interaction: {
        action: "",
        interactive: false,
        controlType: "",
        disabled: false,
        required: false,
        href: "",
        target: "",
        keyboardActivates: false,
        valueMutable: false
      },
      appearance: {
        bounds: null,
        layout: null,
        style: null,
        tokens: {
          hasSurface: false,
          hasBorder: false,
          hasShadow: false,
          isLargeText: false,
          isBoldText: false,
          isScrollable: false,
          area: 0,
          size: "small"
        }
      },
      children: []
    };
  }

  function capturesOwnText(kind) {
    return new Set([
      "heading",
      "link",
      "button",
      "summary",
      "input",
      "textarea",
      "select",
      "checkbox",
      "radio",
      "image",
      "visual",
      "placeholder"
    ]).has(kind);
  }

  function capturesChildren(element, kind) {
    if (kind === "link" && element.children.length) {
      return true;
    }
    return !capturesOwnText(kind);
  }

  function ownTextForElement(element, kind, hasChildren) {
    if (kind === "form") {
      return explicitElementLabel(element);
    }
    if (kind === "link" && hasChildren) {
      return utils.directText(element);
    }
    if (capturesOwnText(kind)) {
      return utils.accessibleName(element);
    }
    return utils.directText(element);
  }

  function explicitElementLabel(element) {
    return utils.normalizeText(
      element.getAttribute("aria-label") ||
        element.getAttribute("name") ||
        element.getAttribute("title")
    );
  }

  function isLowSignalContainer(element, children, directText) {
    if (directText) {
      return false;
    }
    if (constants.SEMANTIC_CONTAINER_TAGS.has(element.tagName)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "flex" || style.display === "grid") {
      return false;
    }
    return children.length <= 1;
  }

  function captureElement(element, depth) {
    if (depth > constants.MAX_TREE_DEPTH || !(element instanceof HTMLElement)) {
      return null;
    }
    if (
      constants.SKIP_TAGS.has(element.tagName) ||
      utils.isExtensionElement(element) ||
      !utils.isVisible(element)
    ) {
      return null;
    }

    const kind = classifyElement(element);
    if (kind === "unsupported") {
      return null;
    }

    const shouldCaptureChildren = capturesChildren(element, kind);
    const children = shouldCaptureChildren ? captureChildren(element, depth) : [];

    const directText = shouldCaptureChildren ? utils.directText(element) : "";
    if (kind === "container" && isLowSignalContainer(element, children, directText)) {
      return children.length ? { kind: "fragment", children } : null;
    }

    const text = ownTextForElement(element, kind, shouldCaptureChildren);
    if (!text && !children.length && !["image", "visual", "placeholder", "input", "textarea", "select", "checkbox", "radio"].includes(kind)) {
      return null;
    }

    const node = {
      id: utils.nextId("node"),
      kind,
      tagName: element.tagName.toLowerCase(),
      role: utils.elementRole(element),
      text,
      attributes: captureAttributes(element),
      semantic: captureSemantic(element, kind),
      content: captureContent(element, kind, text),
      layout: captureLayout(element),
      style: captureStyle(element),
      state: {
        ...elementState(element),
        ...inputState(element)
      },
      action: actionFor(kind, element),
      targetRef: locator.createElementRef(element),
      children
    };
    node.interaction = captureInteraction(element, kind, node.action);
    node.appearance = {
      bounds: {
        x: node.layout.x,
        y: node.layout.y,
        width: node.layout.width,
        height: node.layout.height
      },
      layout: node.layout,
      style: node.style,
      tokens: captureStyleTokens(element, node.layout, node.style)
    };

    if (kind === "heading") {
      node.level = Number(element.tagName.slice(1));
    }

    return node;
  }

  function captureChildren(element, depth) {
    const children = [];
    let childCount = 0;
    for (const child of element.childNodes) {
      if (childCount >= constants.MAX_CHILDREN_PER_NODE) {
        break;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const textNode = directTextNode(child.textContent || "");
        if (textNode) {
          children.push(textNode);
          childCount += 1;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const capturedChild = captureElement(child, depth + 1);
        if (capturedChild) {
          if (capturedChild.kind === "fragment") {
            children.push(...capturedChild.children);
            childCount += capturedChild.children.length;
          } else {
            children.push(capturedChild);
            childCount += 1;
          }
        }
      }
    }
    return children;
  }

  function captureAttributes(element) {
    const attrs = {};
    for (const name of [
      "href",
      "src",
      "alt",
      "title",
      "target",
      "type",
      "name",
      "placeholder",
      "aria-expanded",
      "aria-current",
      "min",
      "max",
      "step",
      "minlength",
      "maxlength",
      "pattern",
      "autocomplete"
    ]) {
      const value = element.getAttribute(name);
      if (value) {
        attrs[name] = value;
      }
    }
    if (element instanceof HTMLFormElement && element.method) {
      attrs.method = element.method;
    }
    return attrs;
  }

  function flattenForFingerprint(node, out) {
    const layout = node.layout || {};
    const style = node.style || {};
    const state = node.state || {};
    out.push([
      node.kind,
      node.text || "",
      state.value || "",
      state.checked ? "1" : "0",
      state.open ? "open" : "",
      state.ariaExpanded || "",
      layout.width || "",
      layout.height || "",
      layout.display || "",
      style.backgroundColor || "",
      style.color || ""
    ].join(":"));
    for (const child of node.children || []) {
      flattenForFingerprint(child, out);
    }
  }

  function capturePage() {
    const body = document.body || document.documentElement;
    const rootChildren = [];
    for (const child of body.children) {
      const captured = captureElement(child, 0);
      if (!captured) {
        continue;
      }
      if (captured.kind === "fragment") {
        rootChildren.push(...captured.children);
      } else {
        rootChildren.push(captured);
      }
    }

    const root = {
      id: "root",
      kind: "root",
      tagName: "body",
      text: "",
      layout: captureLayout(body),
      style: captureStyle(body),
      semantic: {
        kind: "root",
        tagName: "body",
        role: "",
        landmark: "document",
        designRole: "page",
        headingLevel: null,
        listType: "",
        tableRole: "",
        isComposite: true
      },
      content: {
        text: "",
        directText: "",
        accessibleName: document.title,
        title: document.title,
        alt: "",
        href: "",
        source: "",
        textSignature: utils.normalizeText(document.title, 180),
        hasText: Boolean(document.title),
        hasMedia: false
      },
      state: {},
      children: rootChildren
    };
    root.interaction = {
      action: "",
      interactive: false,
      controlType: "",
      disabled: false,
      required: false,
      href: "",
      target: "",
      keyboardActivates: false,
      valueMutable: false
    };
    root.appearance = {
      bounds: {
        x: root.layout.x,
        y: root.layout.y,
        width: root.layout.width,
        height: root.layout.height
      },
      layout: root.layout,
      style: root.style,
      tokens: captureStyleTokens(body, root.layout, root.style)
    };
    const fingerprintParts = [];
    flattenForFingerprint(root, fingerprintParts);

    return {
      modelVersion: 1,
      origin: location.origin,
      url: location.href,
      title: document.title,
      capturedAt: Date.now(),
      fingerprint: fingerprintParts.join("|").slice(0, 12000),
      root
    };
  }

  Reframe.capture = {
    capturePage
  };
})();
