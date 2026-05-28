(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const constants = Reframe.constants;

  let nextRuntimeIdValue = 0;

  function nextId(prefix) {
    nextRuntimeIdValue += 1;
    return `${prefix || "rf"}-${nextRuntimeIdValue}`;
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function normalizeText(text, maxLength) {
    return (text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || constants.MAX_TEXT_LENGTH);
  }

  function isExtensionElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    return Boolean(element.closest(`#${constants.OVERLAY_HOST_ID}, #${constants.TOGGLE_HOST_ID}`));
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (isExtensionElement(element) || element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.contentVisibility === "hidden"
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function directText(element) {
    const chunks = [];
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        chunks.push(child.textContent || "");
      }
    }
    return normalizeText(chunks.join(" "));
  }

  function elementText(element) {
    return normalizeText(element.innerText || element.textContent || "");
  }

  function accessibleName(element) {
    if (!(element instanceof HTMLElement)) {
      return "";
    }
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelText = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => elementText(node))
        .join(" ");
      if (labelText) {
        return normalizeText(labelText);
      }
    }

    const ariaLabel = normalizeText(element.getAttribute("aria-label"));
    if (ariaLabel) {
      return ariaLabel;
    }

    if (element instanceof HTMLImageElement) {
      return normalizeText(element.alt || element.title);
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) {
          const text = elementText(label);
          if (text) {
            return text;
          }
        }
      }
      const parentLabel = element.closest("label");
      if (parentLabel) {
        const text = elementText(parentLabel);
        if (text) {
          return text;
        }
      }
      return normalizeText(element.getAttribute("placeholder") || element.name || element.id || element.title);
    }

    const descendantImageText = Array.from(element.querySelectorAll("img"))
      .map((image) => image.alt || image.title || "")
      .filter(Boolean)
      .join(" ");

    return normalizeText(element.getAttribute("title") || directText(element) || elementText(element) || descendantImageText);
  }

  function mutationTouchesOnlyExtensionDom(mutation) {
    const isExtensionNode = (node) => {
      if (!(node instanceof Element)) {
        return true;
      }
      return (
        node.id === constants.OVERLAY_HOST_ID ||
        node.id === constants.TOGGLE_HOST_ID ||
        isExtensionElement(node)
      );
    };

    if (mutation.type === "childList") {
      const changedNodes = [
        ...Array.from(mutation.addedNodes || []),
        ...Array.from(mutation.removedNodes || [])
      ];
      return changedNodes.length > 0 && changedNodes.every(isExtensionNode);
    }

    return isExtensionNode(mutation.target);
  }

  function elementRole(element) {
    return normalizeText(element.getAttribute("role")) || "";
  }

  function clampNumber(value, fallback, min, max) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(parsed, min), max);
  }

  Reframe.utils = {
    nextId,
    debounce,
    normalizeText,
    isExtensionElement,
    isVisible,
    directText,
    elementText,
    accessibleName,
    mutationTouchesOnlyExtensionDom,
    elementRole,
    clampNumber
  };
})();
