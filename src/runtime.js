(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const constants = Reframe.constants;
  const utils = Reframe.utils;
  const capture = Reframe.capture;
  const render = Reframe.render;
  const bridge = Reframe.bridge;
  const state = Reframe.state;

  const runtimeState = {
    enabled: false,
    currentPage: null,
    lastUrl: location.href,
    lastFingerprint: "",
    refreshTimer: null,
    observer: null,
    applyingOverlay: false
  };

  function scheduleRefresh(delay, force) {
    window.clearTimeout(runtimeState.refreshTimer);
    runtimeState.refreshTimer = window.setTimeout(() => {
      refreshOverlay(Boolean(force));
    }, delay);
  }

  function handleOverlayAction(node, overlayElement, eventType) {
    const result = bridge.activate(node, overlayElement, eventType);
    if (!result.refresh) {
      return;
    }
    const delay = result.input ? constants.INPUT_REBUILD_MS : constants.INTERACTION_REBUILD_MS;
    scheduleRefresh(delay, false);
  }

  async function setEnabled(enabled, options) {
    const persist = !options || options.persist !== false;
    runtimeState.enabled = enabled;
    render.renderToggle(enabled, setEnabled);

    if (persist) {
      await state.setMode(location.origin, enabled);
    }

    if (enabled) {
      refreshOverlay(true);
    } else {
      render.unmountOverlay();
      runtimeState.currentPage = null;
      runtimeState.lastFingerprint = "";
    }
  }

  function refreshOverlay(force) {
    if (!runtimeState.enabled) {
      return;
    }
    runtimeState.applyingOverlay = true;
    const page = capture.capturePage();
    const fingerprint = `${page.url}:${page.title}:${page.fingerprint}`;
    if (!force && fingerprint === runtimeState.lastFingerprint) {
      runtimeState.applyingOverlay = false;
      return;
    }
    runtimeState.currentPage = page;
    runtimeState.lastFingerprint = fingerprint;
    render.mountOverlay(page, handleOverlayAction);
    runtimeState.applyingOverlay = false;
  }

  async function handleRouteChange() {
    if (runtimeState.lastUrl === location.href) {
      return;
    }
    runtimeState.lastUrl = location.href;
    runtimeState.lastFingerprint = "";
    const persisted = await state.getMode(location.origin);
    if (persisted && persisted.enabled) {
      runtimeState.enabled = true;
      render.renderToggle(true, setEnabled);
      scheduleRefresh(constants.INTERACTION_REBUILD_MS, true);
    } else if (runtimeState.enabled) {
      await setEnabled(false, { persist: false });
    }
  }

  function installRouteListeners() {
    const notifyRouteChange = () => {
      window.setTimeout(handleRouteChange, 0);
    };
    for (const methodName of ["pushState", "replaceState"]) {
      const original = history[methodName];
      if (typeof original !== "function") {
        continue;
      }
      history[methodName] = function wrappedHistoryMethod(...args) {
        const result = original.apply(this, args);
        notifyRouteChange();
        return result;
      };
    }
    window.addEventListener("popstate", notifyRouteChange);
    window.addEventListener("hashchange", notifyRouteChange);
  }

  function installMutationObserver() {
    const onMutation = utils.debounce(() => {
      if (!runtimeState.enabled || runtimeState.applyingOverlay) {
        return;
      }
      if (runtimeState.lastUrl !== location.href) {
        handleRouteChange();
        return;
      }
      scheduleRefresh(constants.REBUILD_DEBOUNCE_MS, false);
    }, constants.REBUILD_DEBOUNCE_MS);

    runtimeState.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (utils.mutationTouchesOnlyExtensionDom(mutation)) {
          continue;
        }
        onMutation();
        break;
      }
    });

    runtimeState.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  async function init() {
    render.renderToggle(false, setEnabled);
    installRouteListeners();
    installMutationObserver();
    const persisted = await state.getMode(location.origin);
    if (persisted && persisted.enabled) {
      await setEnabled(true, { persist: false });
    }
  }

  Reframe.runtime = {
    init,
    setEnabled,
    refreshOverlay
  };
})();
