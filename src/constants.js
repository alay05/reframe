(function () {
  const Reframe = (globalThis.Reframe = globalThis.Reframe || {});

  Reframe.constants = {
    ATTR_ID: "data-reframe-id",
    OVERLAY_HOST_ID: "reframe-overlay-root",
    TOGGLE_HOST_ID: "reframe-toggle-root",
    STORAGE_PREFIX: "reframe:origin:",
    REBUILD_DEBOUNCE_MS: 250,
    INTERACTION_REBUILD_MS: 180,
    INPUT_REBUILD_MS: 450,
    MAX_TEXT_LENGTH: 800,
    MAX_TREE_DEPTH: 30,
    MAX_CHILDREN_PER_NODE: 250,
    SKIP_TAGS: new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "META",
      "LINK",
      "TEMPLATE",
      "SOURCE",
      "TRACK"
    ]),
    SEMANTIC_CONTAINER_TAGS: new Set([
      "MAIN",
      "HEADER",
      "FOOTER",
      "NAV",
      "ASIDE",
      "SECTION",
      "ARTICLE",
      "FORM",
      "UL",
      "OL",
      "LI",
      "TABLE",
      "THEAD",
      "TBODY",
      "TFOOT",
      "TR",
      "TH",
      "TD",
      "FIELDSET",
      "DETAILS",
      "SUMMARY",
      "DIALOG"
    ]),
    HEADING_TAGS: new Set(["H1", "H2", "H3", "H4", "H5", "H6"]),
    INLINE_TEXT_TAGS: new Set([
      "A",
      "ABBR",
      "B",
      "CODE",
      "EM",
      "I",
      "MARK",
      "SMALL",
      "SPAN",
      "STRONG",
      "SUB",
      "SUP",
      "TIME"
    ])
  };
})();
