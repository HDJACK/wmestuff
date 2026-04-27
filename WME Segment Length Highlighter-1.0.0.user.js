// ==UserScript==
// @name         WME Segment Length Highlighter
// @namespace    ogkm01
// @version      1.0.0
// @description  Highlight short WME segments with configurable thresholds.
// @author       kev (ogkm01)
// @match        https://www.waze.com/*editor*
// @match        https://www.waze.com/*/editor*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  // Config
  const SCRIPT_ID = "jack-wme-segment-length-highlighter";
  const SCRIPT_NAME = "Segment Length Highlighter";
  const LAYER_NAME = `${SCRIPT_ID}-layer`;
  const STORAGE_KEY = `${SCRIPT_ID}-settings`;

  const DEFAULTS = Object.freeze({
    enabled: true,
    thresholdMeters: 7,
    opacity: 0.75,
    thickness: 8,
    offsetPx: 0,
    color: "#ff0000",
    minZoom: 16,
  });

  const REFRESH_DELAY = Object.freeze({
    mapDataLoaded: 100,
    zoomChanged: 80,
    moveEnd: 80,
    saveFinished: 120,
    input: 120,
  });

  // Runtime state
  let sdk = null;
  let settings = loadSettings();
  let layerCreated = false;
  let refreshTimer = null;
  let tabPane = null;
  let statusEl = null;

  // Persistence
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  // helpers
  function formatMeters(value) {
    return Number(value).toFixed(2);
  }

  function updateStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function scheduleRefresh(delay = REFRESH_DELAY.input) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshLayer().catch((err) => {
        console.error(`[${SCRIPT_NAME}] refresh failed`, err);
        updateStatus("Refresh failed - check console");
      });
    }, delay);
  }

  function createElement(tag, styles = {}) {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  // Map layer
  function ensureLayer() {
    if (layerCreated) return;

    sdk.Map.addLayer({
      layerName: LAYER_NAME,
      styleContext: {
        getStrokeColor: ({ feature }) => feature?.properties?.color ?? "#ff0000",
        getStrokeWidth: ({ feature }) => feature?.properties?.thickness ?? 8,
      },
      styleRules: [{
        style: {
          strokeColor: "${getStrokeColor}",
          strokeWidth: "${getStrokeWidth}",
        },
      }],
    });

    sdk.Map.setLayerOpacity({
      layerName: LAYER_NAME,
      opacity: settings.opacity,
    });

    layerCreated = true;
  }

  function clearLayer() {
    if (!layerCreated) return;
    try {
      sdk.Map.removeAllFeaturesFromLayer({ layerName: LAYER_NAME });
    } catch (err) {
      console.warn(`[${SCRIPT_NAME}] could not clear layer`, err);
    }
  }

  function applyOffsetToLineString(lineString, offsetPx) {
    if (!offsetPx) return lineString;
    if (!lineString?.coordinates || lineString.coordinates.length < 2) return lineString;

    // px space offset stuff
    const pxPoints = lineString.coordinates.map(([lon, lat]) =>
      sdk.Map.getMapPixelFromLonLat({ lonLat: { lon, lat } })
    );

    const shiftedCoords = pxPoints.map((pt, i) => {
      const prev = pxPoints[Math.max(0, i - 1)];
      const next = pxPoints[Math.min(pxPoints.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const shiftedPx = { x: pt.x + nx * offsetPx, y: pt.y + ny * offsetPx };
      const lonLat = sdk.Map.getLonLatFromMapPixel(shiftedPx);
      return [lonLat.lon, lonLat.lat];
    });

    return { type: "LineString", coordinates: shiftedCoords };
  }

  function buildFeatureFromSegment(segment) {
    if (!Number.isFinite(segment?.length)) return null;
    if (segment.length >= settings.thresholdMeters) return null;
    if (segment?.geometry?.type !== "LineString") return null;

    return {
      id: String(segment.id),
      type: "Feature",
      geometry: applyOffsetToLineString(segment.geometry, settings.offsetPx),
      properties: {
        segmentId: segment.id,
        segmentLengthMeters: segment.length,
        color: settings.color,
        thickness: settings.thickness,
      },
    };
  }

  async function refreshLayer() {
    if (!sdk) return;

    ensureLayer();
    sdk.Map.setLayerOpacity({ layerName: LAYER_NAME, opacity: settings.opacity });

    if (!settings.enabled) {
      clearLayer();
      updateStatus("Disabled");
      return;
    }

    const zoom = sdk.Map.getZoomLevel();
    if (zoom < settings.minZoom) {
      clearLayer();
      updateStatus(`Zoom in to at least ${settings.minZoom}`);
      return;
    }

    const segments = sdk.DataModel.Segments.getAll();
    const features = [];

    for (const segment of segments) {
      const feature = buildFeatureFromSegment(segment);
      if (feature) features.push(feature);
    }

    clearLayer();

    if (features.length) {
      sdk.Map.addFeaturesToLayer({ layerName: LAYER_NAME, features });
    }

    updateStatus(`${features.length} highlighted | length < ${formatMeters(settings.thresholdMeters)} m`);
  }

  // Sidebar UI
  function makeLabel(text) {
    const el = createElement("div", {
      fontSize: "12px",
      fontWeight: "600",
      marginBottom: "4px",
    });
    el.textContent = text;
    return el;
  }

  function makeNumberInput(label, key, { min = "", max = "", step = "1" } = {}) {
    const wrap = createElement("div", { marginBottom: "10px" });
    const title = makeLabel(label);
    const input = createElement("input", {
      width: "100%",
      boxSizing: "border-box",
    });

    input.type = "number";
    input.value = String(settings[key]);
    input.step = String(step);
    if (min !== "") input.min = String(min);
    if (max !== "") input.max = String(max);

    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      settings[key] = value;
      saveSettings();
      scheduleRefresh();
    });

    wrap.append(title, input);
    return wrap;
  }

  function makeColorInput(label, key) {
    const wrap = createElement("div", { marginBottom: "10px" });
    const title = makeLabel(label);
    const input = createElement("input", {
      width: "100%",
      height: "34px",
      boxSizing: "border-box",
    });

    input.type = "color";
    input.value = settings[key];
    input.addEventListener("input", () => {
      settings[key] = input.value;
      saveSettings();
      scheduleRefresh();
    });

    wrap.append(title, input);
    return wrap;
  }

  function makeCheckbox(label, key) {
    const wrap = createElement("label", {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "10px",
      fontSize: "12px",
    });

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(settings[key]);
    input.addEventListener("change", () => {
      settings[key] = input.checked;
      saveSettings();
      scheduleRefresh();
    });

    const span = document.createElement("span");
    span.textContent = label;
    wrap.append(input, span);
    return wrap;
  }

  function makeButton(text, onClick) {
    const btn = createElement("button", {
      padding: "6px 8px",
      cursor: "pointer",
    });
    btn.type = "button";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function buildSidebarUi() {
    tabPane.innerHTML = "";
    tabPane.style.padding = "10px";

    const title = createElement("h3", { margin: "0 0 10px 0" });
    title.textContent = "Segment Length";

    const note = createElement("div", {
      fontSize: "12px",
      marginBottom: "10px",
    });
    note.textContent = "Highlights loaded segments shorter than the configured threshold.";

    statusEl = createElement("div", {
      fontSize: "12px",
      opacity: "0.85",
      marginBottom: "12px",
    });
    statusEl.textContent = "Idle";

    const controls = document.createElement("div");
    controls.append(
      makeCheckbox("Enabled", "enabled"),
      makeNumberInput("Threshold (meters)", "thresholdMeters", { min: 0, step: 0.1 }),
      makeNumberInput("Opacity (0.0 - 1.0)", "opacity", { min: 0, max: 1, step: 0.05 }),
      makeNumberInput("Thickness (px)", "thickness", { min: 1, step: 1 }),
      makeNumberInput("Offset (px)", "offsetPx", { step: 1 }),
      makeColorInput("Color", "color"),
      makeNumberInput("Minimum zoom", "minZoom", { min: 1, step: 1 }),
    );

    const actions = createElement("div", {
      display: "flex",
      gap: "8px",
      marginTop: "10px",
    });

    const refreshBtn = makeButton("Refresh", () => {
      refreshLayer().catch((err) => {
        console.error(`[${SCRIPT_NAME}] refresh failed`, err);
        updateStatus("Refresh failed - check console");
      });
    });

    const resetBtn = makeButton("Reset", () => {
      settings = { ...DEFAULTS };
      saveSettings();
      buildSidebarUi();
      scheduleRefresh(0);
    });

    actions.append(refreshBtn, resetBtn);
    tabPane.append(title, note, statusEl, controls, actions);
  }

  // Init / lifecycle
  function registerEvents() {
    sdk.Events.on({
      eventName: "wme-map-data-loaded",
      eventHandler: () => scheduleRefresh(REFRESH_DELAY.mapDataLoaded),
    });

    sdk.Events.on({
      eventName: "wme-map-zoom-changed",
      eventHandler: () => scheduleRefresh(REFRESH_DELAY.zoomChanged),
    });

    sdk.Events.on({
      eventName: "wme-map-move-end",
      eventHandler: () => scheduleRefresh(REFRESH_DELAY.moveEnd),
    });

    sdk.Events.on({
      eventName: "wme-save-finished",
      eventHandler: () => scheduleRefresh(REFRESH_DELAY.saveFinished),
    });
  }

  async function initScript() {
    if (typeof window.getWmeSdk !== "function") {
      console.error(`[${SCRIPT_NAME}] SDK not available`);
      return;
    }

    sdk = window.getWmeSdk({
      scriptId: SCRIPT_ID,
      scriptName: SCRIPT_NAME,
    });

    ensureLayer();

    const sidebar = await sdk.Sidebar.registerScriptTab();
    sidebar.tabLabel.textContent = "LEN";
    sidebar.tabLabel.title = "Segment Length Highlighter";

    tabPane = sidebar.tabPane;
    buildSidebarUi();
    registerEvents();
    await refreshLayer();
  }

  function boot() {
    if (!window.SDK_INITIALIZED?.then) {
      console.error(`[${SCRIPT_NAME}] window.SDK_INITIALIZED missing`);
      return;
    }

    window.SDK_INITIALIZED
      .then(initScript)
      .catch((err) => console.error(`[${SCRIPT_NAME}] init failed`, err));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();