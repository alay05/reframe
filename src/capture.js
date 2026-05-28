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
      borderWidth: style.borderTopWidth,
      borderStyle: style.borderTopStyle,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      color: style.color
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

  function actionFor(kind, element) {
    if (kind === "link") {
      return "navigate";
    }
    if (kind === "button") {
      const type = element instanceof HTMLInputElement ? (element.type || "").toLowerCase() : "";
      return type === "submit" ? "submit" : "click";
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

  function directTextNode(text) {
    const normalized = utils.normalizeText(text);
    if (!normalized) {
      return null;
    }
    return {
      id: utils.nextId("node"),
      kind: "text",
      text: normalized,
      children: []
    };
  }

  function capturesOwnText(kind) {
    return new Set([
      "heading",
      "link",
      "button",
      "input",
      "textarea",
      "select",
      "checkbox",
      "radio",
      "image",
      "placeholder"
    ]).has(kind);
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

    const children = capturesOwnText(kind) ? [] : captureChildren(element, depth);

    const directText = capturesOwnText(kind) ? "" : utils.directText(element);
    if (kind === "container" && isLowSignalContainer(element, children, directText)) {
      return children.length ? { kind: "fragment", children } : null;
    }

    const text =
      capturesOwnText(kind) || kind === "form"
        ? utils.accessibleName(element)
        : directText;
    if (!text && !children.length && !["image", "placeholder", "input", "textarea", "select", "checkbox", "radio"].includes(kind)) {
      return null;
    }

    const node = {
      id: utils.nextId("node"),
      kind,
      tagName: element.tagName.toLowerCase(),
      role: utils.elementRole(element),
      text,
      attributes: captureAttributes(element),
      layout: captureLayout(element),
      state: inputState(element),
      action: actionFor(kind, element),
      targetRef: locator.createElementRef(element),
      children
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
    for (const name of ["href", "src", "alt", "title", "target", "type", "name", "placeholder", "aria-expanded", "aria-current"]) {
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
    out.push(`${node.kind}:${node.text || ""}:${node.state ? node.state.value || "" : ""}:${node.state && node.state.checked ? "1" : "0"}`);
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
      children: rootChildren
    };
    const fingerprintParts = [];
    flattenForFingerprint(root, fingerprintParts);

    return {
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
