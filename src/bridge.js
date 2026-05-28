(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const locator = Reframe.locator;

  function dispatchInputEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function focusElement(element) {
    if (typeof element.focus === "function") {
      element.focus({ preventScroll: true });
    }
  }

  function activate(node, overlayElement) {
    const target = locator.resolve(node.targetRef);
    if (!target) {
      return { refresh: true };
    }

    switch (node.kind) {
      case "link":
        if (target instanceof HTMLAnchorElement) {
          target.click();
        } else if (target instanceof HTMLElement) {
          target.click();
        }
        return { refresh: true };
      case "button":
        if (target instanceof HTMLElement) {
          target.click();
        }
        return { refresh: true };
      case "input":
        if (target instanceof HTMLInputElement) {
          target.value = overlayElement.value;
          focusElement(target);
          dispatchInputEvents(target);
        }
        return { refresh: true, input: true };
      case "textarea":
        if (target instanceof HTMLTextAreaElement) {
          target.value = overlayElement.value;
          focusElement(target);
          dispatchInputEvents(target);
        }
        return { refresh: true, input: true };
      case "select":
        if (target instanceof HTMLSelectElement) {
          target.value = overlayElement.value;
          focusElement(target);
          dispatchInputEvents(target);
        }
        return { refresh: true };
      case "checkbox":
        if (target instanceof HTMLInputElement && target.checked !== overlayElement.checked) {
          target.click();
        }
        return { refresh: true };
      case "radio":
        if (target instanceof HTMLInputElement && overlayElement.checked && !target.checked) {
          target.click();
        }
        return { refresh: true };
      case "form":
        if (target instanceof HTMLFormElement) {
          if (typeof target.requestSubmit === "function") {
            target.requestSubmit();
          } else {
            target.submit();
          }
        }
        return { refresh: true };
      default:
        if (node.action === "click" && target instanceof HTMLElement) {
          target.click();
          return { refresh: true };
        }
        return { refresh: false };
    }
  }

  Reframe.bridge = {
    activate
  };
})();
