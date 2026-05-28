(function () {
  if (globalThis.__REFRAME_RUNTIME__) {
    return;
  }
  globalThis.__REFRAME_RUNTIME__ = true;
  globalThis.Reframe.runtime.init();
})();
