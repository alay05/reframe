(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const constants = Reframe.constants;
  const utils = Reframe.utils;

  function ensureRuntimeId(element) {
    let runtimeId = element.getAttribute(constants.ATTR_ID);
    if (!runtimeId) {
      runtimeId = utils.nextId("rfe");
      element.setAttribute(constants.ATTR_ID, runtimeId);
    }
    return runtimeId;
  }

  function cssPath(element) {
    const path = [];
    let current = element;
    while (current && current instanceof Element && current !== document.documentElement) {
      const parent = current.parentElement;
      if (!parent) {
        break;
      }
      const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = sameTagSiblings.indexOf(current) + 1;
      path.unshift({
        tagName: current.tagName.toLowerCase(),
        index
      });
      current = parent;
    }
    return path;
  }

  function stableAttributes(element) {
    const attrs = {};
    for (const name of ["id", "name", "type", "href", "src", "action", "alt", "title", "aria-label", "data-testid", "data-test"]) {
      const value = element.getAttribute(name);
      if (value) {
        attrs[name] = value;
      }
    }
    return attrs;
  }

  function createElementRef(element) {
    return {
      runtimeId: ensureRuntimeId(element),
      tagName: element.tagName.toLowerCase(),
      stableAttributes: stableAttributes(element),
      domPath: cssPath(element),
      role: utils.elementRole(element),
      textSignature: utils.normalizeText(utils.accessibleName(element), 160)
    };
  }

  function selectorFromStableAttributes(ref) {
    const attrs = ref.stableAttributes || {};
    if (attrs.id) {
      return `#${CSS.escape(attrs.id)}`;
    }
    if (attrs["data-testid"]) {
      return `[data-testid="${CSS.escape(attrs["data-testid"])}"]`;
    }
    if (attrs["data-test"]) {
      return `[data-test="${CSS.escape(attrs["data-test"])}"]`;
    }
    if (attrs.name) {
      return `${ref.tagName}[name="${CSS.escape(attrs.name)}"]`;
    }
    if (attrs.href && ref.tagName === "a") {
      return `a[href="${CSS.escape(attrs.href)}"]`;
    }
    return "";
  }

  function resolveByPath(ref) {
    let current = document.documentElement;
    for (const step of ref.domPath || []) {
      const candidates = Array.from(current.children).filter(
        (child) => child.tagName.toLowerCase() === step.tagName
      );
      current = candidates[step.index - 1];
      if (!current) {
        return null;
      }
    }
    return current && current.tagName.toLowerCase() === ref.tagName ? current : null;
  }

  function resolve(ref) {
    if (!ref) {
      return null;
    }

    if (ref.runtimeId) {
      const runtimeMatch = document.querySelector(`[${constants.ATTR_ID}="${CSS.escape(ref.runtimeId)}"]`);
      if (runtimeMatch) {
        return runtimeMatch;
      }
    }

    const selector = selectorFromStableAttributes(ref);
    if (selector) {
      const stableMatch = document.querySelector(selector);
      if (stableMatch) {
        return stableMatch;
      }
    }

    const pathMatch = resolveByPath(ref);
    if (pathMatch) {
      return pathMatch;
    }

    return null;
  }

  Reframe.locator = {
    createElementRef,
    resolve
  };
})();
