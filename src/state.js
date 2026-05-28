(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});
  const constants = Reframe.constants;

  function storageKeyForOrigin(origin) {
    return `${constants.STORAGE_PREFIX}${origin}`;
  }

  async function getMode(origin) {
    const key = storageKeyForOrigin(origin);
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  }

  async function setMode(origin, enabled) {
    const key = storageKeyForOrigin(origin);
    await chrome.storage.local.set({
      [key]: {
        origin,
        enabled,
        lastUpdatedAt: new Date().toISOString()
      }
    });
  }

  Reframe.state = {
    getMode,
    setMode
  };
})();
