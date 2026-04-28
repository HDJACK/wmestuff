// ==UserScript==
// @name         UR Decision Assistant
// @namespace    ogkm01
// @version      1.0.0
// @description  WME: UR-Checkliste (DE), Lage-Check, Recherche — nur lesend, keine UR-Aktionen
// @author       kev (ogkm01)
// @match        https://www.waze.com/*editor*
// @match        https://beta.waze.com/*editor*
// @exclude      https://www.waze.com/*/user/*
// @exclude      https://beta.waze.com/*/user/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    if (/\/user\//.test(location.pathname || '')) return;

    var SCRIPT_ID = 'wme-ur-decision-assistant';
    var SCRIPT_NAME = 'UR Decision Assistant';
    var VERSION = '1.0.0';
    var AUTHOR_FOOTER_URL = 'https://github.com/hdjack';
    var LS_PREFIX = 'wme-urica:';

    var DEFAULTS = {
        language: 'de',
        autoOpenOnUr: true,
        compactLayout: false,
        lightTheme: true,
        showRisk: true,
        searchEngine: 'google',
        autoOpenSearch: false,
        reverseGeocode: true,
        includeMonthYear: true,
        searchButtons: {
            fullclosure: true,
            construction: true,
            closure: true,
            traffic: true,
            detour: true,
            gmaps: true,
            osm: true,
            nominatim: true,
            streetview: true,
        },
    };

    var settings = Object.assign({}, DEFAULTS, readJson('settings', {}));
    var checksMap = readJson('checklist', {}) || {};
    var sdk = null;
    var lastUrId = null;
    //eventUr nur frisch nach Panel-Event
    var PANEL_UR_BRIDGE_MS = 3500;
    var lastContext = {
        ur: null,
        details: null,
        detailsError: null,
        selectionSource: 'none',
        eventUrId: null,
        eventUrAt: 0,
    };
    var initStarted = false;
    var scriptSidebarReg = null;
    var refreshDebounceTimer = null;
    var nativeSelectionWired = false;
    function emptyLocContext() {
        return {
            street: null, city: null, region: null, country: null,
            lat: null, lon: null, conf: 'none', osmEnriched: false, textHeuristic: false,
            sdkStreet: null, sdkCity: null,
            osmStreet: null, osmCity: null,
            urAnchor: null, segCenter: null, pinSegmentM: null, addrMismatch: false,
            segFromNearest: false,
        };
    }
    var locContext = emptyLocContext();
    var activeMainTab = 'check';
    var scriptTabPane = null;
    var SUR = { t: { root: null, p: 'T-', refs: null }, f: { root: null, p: 'F-', refs: null } };
    var segPicker = { ids: [], index: 0 };
    var segPickerLabelEl = null, segPickerPrev = null, segPickerNext = null, lastAutoSearchUrId = null;
    var reverseGeoCache = {};
    var geocodeState = { timer: null, seq: 0, lastEnd: 0 };
    var floatEl = null;
    var headerEl = null;
    var bodyEl = null;
    var tipsEl = null;
    var riskBadge = null;
    var titleSub = null;
    var posDrag = { active: false, x: 0, y: 0, ox: 0, oy: 0 };
    var posResize = { active: false, sx: 0, sy: 0, sw: 0, sh: 0 };
    var floatManuallyHidden = false;

    var I18N = {
        de: {
            title: 'UR Decision Assistant',
            urActive: 'UR aktiv',
            noSdkUr: 'UR-ID sichtbar, SDK-Objekt fehlt (getById) — Karte/Panel prüfen.',
            subUnknown: 'Ort / Straße: nicht zuverlässig ausgelesen — bitte in WME prüfen (keine erfundenen Daten).',
            subPartial: 'Kontext (SDK / ggf. Heuristik, unvollständig):',
            heuristicFromText: 'Aus Meldungstext erraten (heuristisch — bitte kartenbasiert prüfen):',
            heuristicLabelShort: 'heuristisch',
            scopeDisclaimer: 'Nur Recherche & Prüf-Hilfe. Keine Kommentare, kein Status, keine Kartenänderungen — Sie entscheidet in WME.',
            checklist: 'Checkliste',
            tips: 'Tipps & Einschätzung (nur Anhaltspunkte)',
            research: 'Recherche & Suche',
            segLabel: 'Segment',
            noSegment: 'kein Karten-Segment (nur Meldung/Ort aus UR)',
            oneSearch: 'Suche: jetzt suchen (Google/Standard)',
            autoSearchUr: 'Bei neuem UR: Suche sofort in neuem Tab öffnen',
            revGeo: 'Fehlende Straße/Ort: per Koordinate bei OpenStreetMap (Nominatim) anfragen',
            osmEnriched: 'Zusatz: Straße bzw. Ort an der Meldeposition aus OSM (Nominatim).',
            searchNoLocation: '(Ort / Straße in WME prüfen)',
            searchPlaceholder: 'Suchanfrage (bearbeitbar)',
            regen: 'Neu füllen',
            copyQ: 'Anfrage kopieren',
            withCity: 'Mit Ort',
            streetOnly: 'Nur Straße',
            noCity: 'Ohne Ort',
            withDate: 'Monat + Jahr hinzufügen',
            resetPos: 'Position zurücksetzen',
            closeFloat: 'Popup schließen',
            resizeFloat: 'Größe ziehen',
            settings: 'Einstellungen',
            autoOpen: 'Bei ausgewählter UR: Popup automatisch einblenden (ohne ausgewählte UR: aus)',
            compact: 'Kompaktes Layout',
            light: 'Helles Design',
            engine: 'Suchmaschine (Standard)',
            se_google: 'Google',
            se_bing: 'Bing',
            se_ddg: 'DuckDuckGo',
            btnSearches: 'Such-Buttons (einzeln):',
            risk: 'Lage-Check (heuristisch):',
            riskWhy: 'Lage-Signale:',
            riskShow: 'Einstufung (sicher / w. / unklar) anzeigen',
            riskH: 'Kein Ersatz für Sichtprüfung. „Sicher“ = stärkere Signale (Text + Lage), kein Beweis.',
            mini: 'Minimieren',
            expand: 'Ausklappen',
            manual: 'manuell prüfen',
            autoHint: 'SDK/Muster:',
            hintClosureKeyword: 'Stichwort Sperrung/Baustelle',
            hintRoutingKeyword: 'Text: Abbiegen/Routing',
            hintSpeedKeyword: 'Text: Tempo/Geschwindigkeit',
            hintCommentTrail: 'Kommentarspur',
            tabCheck: 'Checkliste',
            tabResearch: 'Recherche',
            tabSettings: 'Einstellungen',
            geoPinSep: 'Pin ↔ Mitte',
            geoForSearch: 'Zum Recherchieren (nur Hinweise, keine Garantie):',
            geoCoordsFallback: 'Kein Straßenname in WME — die Web-Suchzeile nutzt keine Koordinaten (Google findet damit wenig). Pin: OSM/Google-Maps unten.',
            geoZoomTip: 'Tipp: weiter in die Karte reinzoomen — oft zeigt WME am Pin dann den Straßennamen.',
            geoNearestSeg: 'Segment: nächstes am Pin (UR hatte keine Segment-IDs).',
            geoMismatch: 'Hinweis: Nominatim/OSM weicht von WME-Adresse ab — Quellen abgleichen.',
            settingsInScriptsTab: 'Alle Optionen findest du im Skripte-Tab (dieses Panel ist nur Zusatz).',
            footerMade: 'Made with ❤️ by Kevin (Ogkm01)',
            ck_spot_exact: 'Ist klar erkennbar, welche Stelle genau gemeint ist?',
            ck_problem_clear: 'Ist aus UR-Text, Route oder Spur ersichtlich, was das eigentliche Problem ist?',
            ck_route_driven_ok: 'Ist die gefahrene Route hilfreich und plausibel?',
            ck_route_suggested_ok: 'Ist die vorgeschlagene Route hilfreich und plausibel?',
            ck_spot_matches_map: 'Passt die gemeldete Stelle zur aktuellen Kartensituation?',
            ck_error_map_visible: 'Ist der Fehler auf der Karte direkt sichtbar?',
            ck_roadtype_plausible: 'Ist der Straßentyp plausibel?',
            ck_geometry_plausible: 'Ist die Geometrie bzw. Straßenführung plausibel?',
            ck_direction_oneway_plausible: 'Ist die Fahrtrichtung bzw. Einbahnregelung plausibel?',
            ck_turns_tr_plausible: 'Sind die Abbiegemöglichkeiten bzw. Turn Restrictions plausibel?',
            ck_speeds_plausible: 'Sind die Geschwindigkeiten plausibel?',
            ck_closure_traffic_signs: 'Gibt es Anzeichen für eine Sperrung, Baustelle oder geänderte Verkehrsführung?',
            ck_imagery_sv_difficult: 'Könnte das Problem wegen veralteter Luftbilder oder fehlender Street-View-Daten schwer prüfbar sein?',
            ck_external_confirms: 'Gibt es aktuelle externe Hinweise, die die Meldung bestätigen?',
            ck_spot_recent_edit: 'Wurde die Stelle kürzlich bearbeitet?',
            ck_cause_pending_livemap: 'Könnte die Ursache ein noch nicht live sichtbares Kartenupdate sein?',
            ck_info_sufficient_decide: 'Reichen die vorhandenen Informationen aus, um den Fall sicher zu entscheiden?',
            ck_need_reporter_question: 'Brauche ich eine konkrete Rückfrage an den Melder?',
            ck_fix_clean_direct: 'Kann ich den Fehler direkt und sauber korrigieren?',
            ck_note_or_bookmark: 'Notiz / Bookmark erstellt/nötig?',
            ck_outcome_resolved_open: 'Ist der Fall nach Prüfung gelöst, offen oder nicht identifizierbar?',
        },
        en: {
            title: 'UR Decision Assistant',
            urActive: 'UR active',
            noSdkUr: 'UR id known but SDK getById returned no object — check WME/panel.',
            subUnknown: 'Street / city: not reliably read — verify in WME (no invented data).',
            subPartial: 'Context (SDK / maybe heuristic, partial):',
            heuristicFromText: 'Inferred from report text (heuristic — verify on map):',
            heuristicLabelShort: 'heuristic',
            scopeDisclaimer: 'Research & checklist only. No comments, no UR actions, no edits — you decide in WME.',
            checklist: 'Checklist',
            tips: 'Tips (suggestions only)',
            research: 'Search & research',
            segLabel: 'Segment',
            noSegment: 'no map segment (UR text / location only)',
            oneSearch: 'Search now (default engine / Google)',
            autoSearchUr: 'On new UR: auto-open search in a new tab',
            revGeo: 'When street/city missing: reverse geocode (OpenStreetMap Nominatim)',
            osmEnriched: 'Also: street/place at pin from OSM (Nominatim).',
            searchNoLocation: '(check place/street in WME)',
            searchPlaceholder: 'Query (editable)',
            regen: 'Refill',
            copyQ: 'Copy query',
            withCity: 'With place',
            streetOnly: 'Street only',
            noCity: 'No place',
            withDate: 'Add month + year',
            resetPos: 'Reset position',
            closeFloat: 'Close popup',
            resizeFloat: 'Drag to resize',
            settings: 'Settings',
            autoOpen: 'When a UR is selected: show popup (hidden when no UR is selected)',
            compact: 'Compact layout',
            light: 'Light theme',
            engine: 'Default search engine',
            se_google: 'Google',
            se_bing: 'Bing',
            se_ddg: 'DuckDuckGo',
            btnSearches: 'Search buttons:',
            risk: 'Heuristic read:',
            riskWhy: 'Signals:',
            riskShow: 'Show level (s / likely / unclear)',
            riskH: 'Not a substitute for map review. “Confident” = stronger cues (text + placement) only.',
            mini: 'Minimize',
            expand: 'Expand',
            manual: 'check manually',
            autoHint: 'SDK/pattern:',
            hintClosureKeyword: 'Closure/work-like wording',
            hintRoutingKeyword: 'Text: turns/routing',
            hintSpeedKeyword: 'Text: speed',
            hintCommentTrail: 'Comment thread',
            tabCheck: 'Checklist',
            tabResearch: 'Research',
            tabSettings: 'Settings',
            geoPinSep: 'Pin ↔ centre',
            geoForSearch: 'For research (hints only):',
            geoCoordsFallback: 'No street name in WME — the web search line does not use coordinates (Google rarely helps). Pin: OSM/Google Maps below.',
            geoZoomTip: 'Tip: zoom in further — WME often shows the street name at the pin.',
            geoNearestSeg: 'Segment: nearest to pin (UR had no segment IDs).',
            geoMismatch: 'OSM/Nominatim address differs from WME segment — cross-check sources.',
            settingsInScriptsTab: 'All options are in the Scripts tab (this panel is an extra).',
            footerMade: 'Made with ❤️ by Kevin (Ogkm01)',
            ck_spot_exact: 'Is it clearly identifiable which exact spot is meant?',
            ck_problem_clear: 'From UR text, route, or trace — is the actual problem clear?',
            ck_route_driven_ok: 'Is the driven route helpful and plausible?',
            ck_route_suggested_ok: 'Is the suggested route helpful and plausible?',
            ck_spot_matches_map: 'Does the reported spot match the current map situation?',
            ck_error_map_visible: 'Is the error directly visible on the map?',
            ck_roadtype_plausible: 'Is the road type plausible?',
            ck_geometry_plausible: 'Is the geometry / road alignment plausible?',
            ck_direction_oneway_plausible: 'Are driving direction and one-way rules plausible?',
            ck_turns_tr_plausible: 'Are turn options / turn restrictions plausible?',
            ck_speeds_plausible: 'Are speeds plausible?',
            ck_closure_traffic_signs: 'Any signs of closure, road work, or changed traffic control?',
            ck_imagery_sv_difficult: 'Could outdated imagery or missing Street View make this hard to verify?',
            ck_external_confirms: 'Are there current external sources that support the report?',
            ck_spot_recent_edit: 'Was this area edited recently?',
            ck_cause_pending_livemap: 'Could the cause be a map change not yet visible live?',
            ck_info_sufficient_decide: 'Is there enough information to decide the case confidently?',
            ck_need_reporter_question: 'Do I need a specific follow-up question for the reporter?',
            ck_fix_clean_direct: 'Can I fix the issue directly and cleanly?',
            ck_note_or_bookmark: 'WME map note or bookmark set / still needed?',
            ck_outcome_resolved_open: 'After review: resolved, open, or not identifiable?',
        },
    };

    function t(k) {
        var L = I18N[settings.language] || I18N.de;
        return (L && L[k]) || I18N.de[k] || k;
    }

    function readJson(key, fallback) {
        try {
            var s = localStorage.getItem(LS_PREFIX + key);
            if (s) return JSON.parse(s);
        } catch (e) {}
        return fallback;
    }

    function writeJson(key, data) {
        try {
            localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
        } catch (e) {}
    }

    function saveSettings() {
        writeJson('settings', settings);
    }

    function saveChecksMap() {
        writeJson('checklist', checksMap);
    }

    function el(tag, className, text) {
        var n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null && text !== '') n.textContent = text;
        return n;
    }

    function qAll(baseId) {
        var out = [];
        var a, b;
        if (SUR.t.root) {
            a = SUR.t.root.querySelector('#' + SUR.t.p + baseId);
            if (a) out.push(a);
        }
        if (SUR.f.root) {
            b = SUR.f.root.querySelector('#' + SUR.f.p + baseId);
            if (b) out.push(b);
        }
        return out;
    }

    function qId(baseId) {
        var x = qAll(baseId);
        return x.length ? x[0] : null;
    }

    function setMainTab(id) {
        activeMainTab = id || 'check';
        [['t', SUR.t], ['f', SUR.f]].forEach(function (pair) {
            var sur = pair[1];
            if (!sur.root) return;
            var P = sur.p;
            var isFloat = pair[0] === 'f';
            var showTab = activeMainTab;
            if (isFloat && showTab === 'settings') showTab = 'check';
            ['check', 'research', 'settings'].forEach(function (tid) {
                var p = sur.root.querySelector('#' + P + 'uria-pane-' + tid);
                if (p) p.style.display = tid === showTab ? 'block' : 'none';
            });
            var bar = sur.root.querySelector('#' + P + 'uria-tabbar');
            if (bar) {
                var btns = bar.querySelectorAll('.uria-tabbtn');
                var bi;
                for (bi = 0; bi < btns.length; bi++) {
                    var b0 = btns[bi];
                    b0.classList.toggle('uria-tabbtn--on', b0.getAttribute('data-tab') === showTab);
                }
            }
        });
    }

    function renderEmptyState() {
        qAll('uria-geo').forEach(function (g) { g.innerHTML = ''; });
        qAll('uria-checks').forEach(function (ch) { ch.innerHTML = ''; });
        qAll('uria-tips').forEach(function (ul) { ul.innerHTML = ''; });
        qAll('uria-rbadge').forEach(function (rb) { rb.textContent = ''; });
        qAll('uria-titleline').forEach(function (tln) { tln.textContent = t('title'); });
        qAll('uria-subline').forEach(function (ts) { ts.textContent = ''; });
    }

    function wireSearchBoxesSync() {
        var boxes = qAll('uria-search');
        if (boxes.length < 2) return;
        boxes.forEach(function (box) {
            box.addEventListener('input', function () {
                var v = box.value;
                boxes.forEach(function (o) { if (o !== box) o.value = v; });
            });
        });
    }

    var UI_STATE_KEY = 'uiFloat';

    function loadUiState() {
        return Object.assign(
            { x: 12, y: 88, w: 300, h: 0, theme: 'light' },
            readJson(UI_STATE_KEY, {})
        );
    }

    function saveUiState(s) {
        writeJson(UI_STATE_KEY, s);
    }

    function normalizeSelectionList(sel) {
        if (sel == null) return [];
        if (Array.isArray(sel)) return sel;
        if (Array.isArray(sel.features)) return sel.features;
        if (Array.isArray(sel.items)) return sel.items;
        if (Array.isArray(sel.selected)) return sel.selected;
        if (sel.length != null && typeof sel.length === 'number' && sel.length > 0 && !sel.nodeType) {
            var a = [];
            for (var j = 0; j < sel.length; j++) a.push(sel[j]);
            if (a.length) return a;
        }
        if (sel.id != null || sel.model != null) return [sel];
        return [];
    }

    function isLikelyUrToken(f) {
        if (!f) return false;
        var t = (f.type != null ? String(f.type) : '') + ' ' + (f.objectType != null ? String(f.objectType) : '')
            + ' ' + (f.featureType != null ? String(f.featureType) : '')
            + ' ' + (f.wazeObjectType != null ? String(f.wazeObjectType) : '')
            + ' ' + (f.modelName != null ? String(f.modelName) : '');
        t = t.toLowerCase();
        if (/mapupdate|updaterequest|map.?update|issue|tracker|wme.?ur|ur\./i.test(t)) return true;
        if (f.modelName && /mapupdate/i.test(String(f.modelName))) return true;
        return false;
    }

    function tryProbeUrId(sdk, rawId) {
        if (rawId == null || rawId === '') return null;
        if (typeof rawId === 'string' && !/^\d+$/.test(String(rawId).replace(/\s/g, ''))) return null;
        var num = Number(rawId);
        if (!isFinite(num)) return null;
        var r = tryGetMapUpdateRequest(sdk, num);
        return r.ur ? num : null;
    }

    function pickUrIdFromSelection(sdk, sel) {
        var list = normalizeSelectionList(sel);
        var i, f, tid, probed;
        for (i = 0; i < list.length; i++) {
            f = list[i];
            if (!f) continue;
            tid = f.id != null ? f.id : (f.mapUpdateRequestId != null ? f.mapUpdateRequestId : f.wazeId);
            if (tid == null) continue;
            if (isLikelyUrToken(f)) return Number(tid) || tid;
        }
        for (i = 0; i < list.length; i++) {
            f = list[i];
            if (!f) continue;
            tid = f.id != null ? f.id : f.mapUpdateRequestId;
            if (tid == null) continue;
            probed = tryProbeUrId(sdk, tid);
            if (probed != null) return probed;
        }
        return null;
    }

    function tryLegacyWmeSelectionUrId() {
        try {
            var Wg = window.W;
            if (!Wg || !Wg.selectionManager) return null;
            var sm = Wg.selectionManager;
            var mlist = sm.getSelectedDataModelObjects && sm.getSelectedDataModelObjects();
            if (mlist && mlist.length) {
                var m, n, tstr;
                for (n = 0; n < mlist.length; n++) {
                    m = mlist[n];
                    if (!m) continue;
                    tstr = (m.typeName != null ? m.typeName : (m.modelType != null ? m.modelType : m.type)) + '';
                    if (/mapupdate|update.?request|map.?update.?request|issue/i.test(tstr) && m.id != null) {
                        return Number(m.id) || m.id;
                    }
                }
            }
            var feats = sm.getSelectedFeatures && sm.getSelectedFeatures();
            if (feats && feats.length) {
                var fi, mod, tstr2;
                for (fi = 0; fi < feats.length; fi++) {
                    mod = feats[fi] && feats[fi].model;
                    if (!mod) continue;
                    tstr2 = (mod.typeName != null ? mod.typeName : mod.type) + '';
                    if (/mapupdate|update.?request|map.?update.?request|issue/i.test(tstr2) && mod.id != null) {
                        return Number(mod.id) || mod.id;
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    function tryGetSelection(sdk) {
        var out = null;
        var ed = sdk.Editing || sdk.editing;
        if (!ed) return null;
        var names = [
            'getSelectedFeatures', 'getSelection', 'getCurrentSelection', 'getSelected',
        ];
        var ni;
        for (ni = 0; ni < names.length; ni++) {
            if (typeof ed[names[ni]] === 'function') {
                try {
                    out = ed[names[ni]]();
                    if (out != null) return out;
                } catch (e) {}
            }
        }
        return null;
    }

    function tryGetMapUpdateRequest(sdk, urId) {
        if (!urId) return { ur: null, err: 'noId' };
        var mur = sdk.DataModel && sdk.DataModel.MapUpdateRequests;
        if (!mur) return { ur: null, err: 'noModel' };
        var tries = [{ mapUpdateRequestId: urId }, { updateRequestId: urId }, { id: urId }];
        var ti, o;
        for (ti = 0; ti < tries.length; ti++) {
            try {
                if (typeof mur.getById === 'function') {
                    o = mur.getById(tries[ti]);
                    if (o) return { ur: o, err: null };
                }
            } catch (e) {
                return { ur: null, err: String((e && e.message) || e) };
            }
        }
        return { ur: null, err: 'getById' };
    }

    function tryGetUpdateRequestDetails(sdk, urId) {
        var mur = sdk.DataModel && sdk.DataModel.MapUpdateRequests;
        if (!mur || typeof mur.getUpdateRequestDetails !== 'function') {
            return Promise.resolve({ details: null, err: 'n/a' });
        }
        return mur.getUpdateRequestDetails({ mapUpdateRequestId: urId }).then(
            function (d) { return { details: d, err: null }; },
            function () {
                return mur.getUpdateRequestDetails({ updateRequestId: urId }).then(
                    function (d2) { return { details: d2, err: null }; },
                    function (e) { return { details: null, err: String((e && e.message) || e) }; }
                );
            }
        );
    }

    function extractUrFields(ur) {
        if (!ur) return { id: null, typeText: null, type: null, desc: null, hasComments: null };
        var a = ur.attributes || ur;
        return {
            id: ur.id != null ? ur.id : a.id,
            typeText: a.typeText || a.subType || a.type,
            type: a.type,
            desc: a.description != null ? a.description : a.text,
            hasComments: a.hasComments,
        };
    }

    function textFromAny(v) {
        if (v == null) return '';
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (typeof v === 'object') {
            var keys = ['name', 'text', 'value', 'label', 'cityName', 'streetName', 'title', 'display_name'];
            var i, k, r;
            for (i = 0; i < keys.length; i++) {
                k = keys[i];
                if (v[k] != null) {
                    r = textFromAny(v[k]);
                    if (r) return r;
                }
            }
            if (Array.isArray(v)) {
                r = v.map(textFromAny).filter(Boolean).join(' ').trim();
                return r;
            }
        }
        return '';
    }

    function pointFromGeometry(geom) {
        if (!geom) return null;
        try {
            if (geom.lat != null && geom.lon != null) return { lat: +geom.lat, lon: +geom.lon };
            if (geom.coordinates) {
                var c = geom.coordinates;
                if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number') {
                    return { lat: c[1], lon: c[0] };
                }
            }
        } catch (e) {}
        return null;
    }

    function pointFromLineGeometry(geom) {
        if (!geom) return null;
        try {
            var c = geom.coordinates;
            if (!Array.isArray(c) || !c.length) return null;
            var mid = c[Math.floor(c.length / 2)];
            if (Array.isArray(mid) && mid.length >= 2 && typeof mid[0] === 'number') {
                return { lat: mid[1], lon: mid[0] };
            }
        } catch (e) {}
        return null;
    }

    function listSegmentIdsFromUr(ur, details) {
        var out = [];
        var seen = {};
        function add(v) {
            var n = Number(v);
            if (!isFinite(n) || n <= 0) return;
            if (seen[n]) return;
            seen[n] = 1;
            out.push(n);
        }
        function fromRaw(raw) {
            if (raw == null) return;
            if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(String(raw).trim()))) {
                add(raw);
                return;
            }
            if (Array.isArray(raw)) {
                var i;
                for (i = 0; i < raw.length; i++) fromRaw(raw[i]);
                return;
            }
            if (typeof raw === 'object') {
                if (raw.id != null) add(raw.id);
                if (raw.segmentId != null) add(raw.segmentId);
            }
        }
        var a = ur && (ur.attributes || ur);
        if (a) {
            fromRaw(a.segmentIds);
            fromRaw(a.segments);
            fromRaw(a.affectedSegmentIds);
            fromRaw(a.affectedBySegmentId);
            fromRaw(a.primarySegmentId);
            fromRaw(a.segmentId);
        }
        if (details) {
            fromRaw(details.segmentIds);
            fromRaw(details.segments);
            fromRaw(details.segmentId);
            var inner = details.mapUpdateRequest || details.result || details.data || details.item;
            if (inner) {
                fromRaw(inner.segmentIds);
                fromRaw(inner.segments);
                fromRaw(inner.segmentId);
                if (inner.attributes) {
                    fromRaw(inner.attributes.segmentIds);
                    fromRaw(inner.attributes.segments);
                    fromRaw(inner.attributes.segmentId);
                }
            }
        }
        return out;
    }

    function getSegObj(sdk, sid) {
        var segApi = sdk.DataModel && sdk.DataModel.Segments;
        if (!segApi || typeof segApi.getById !== 'function' || sid == null) return null;
        var n = Number(sid);
        if (!isFinite(n) || n <= 0) return null;
        try { return segApi.getById({ segmentId: n }) || segApi.getById({ id: n }); } catch (e) { return null; }
    }

    function getSegmentCenterPoint(sdk, s) {
        if (!s) return null;
        var sa = s.attributes || s, sg = sa.geometry || s.geometry;
        var pm = pointFromGeometry(sg) || pointFromLineGeometry(sg);
        if (pm) return pm;
        if (sdk && sdk.Map && typeof sdk.Map.getLonLatFromFeature === 'function') {
            try {
                var ll0 = sdk.Map.getLonLatFromFeature(s);
                if (ll0) return { lat: +ll0.lat, lon: +ll0.lon };
            } catch (e) {}
        }
        return null;
    }

    function getAnchorForUr(ur, sdk) {
        if (!ur) return null;
        var a = ur.attributes || ur;
        var p = pointFromGeometry(a.geometry || ur.geometry);
        if (p) return p;
        if (sdk && sdk.Map && typeof sdk.Map.getMapCenter === 'function') {
            try {
                var mc = sdk.Map.getMapCenter();
                if (mc && mc.lat != null && mc.lon != null) return { lat: +mc.lat, lon: +mc.lon };
            } catch (e) {}
        }
        return null;
    }

    function distSq(anchor, pt) {
        if (!anchor || !pt) return 1e20;
        var dy = anchor.lat - pt.lat, dx = anchor.lon - pt.lon;
        return dy * dy + dx * dx;
    }

    function haversineMeters(p1, p2) {
        if (!p1 || !p2) return null;
        var la1 = +p1.lat, lo1 = +p1.lon, la2 = +p2.lat, lo2 = +p2.lon;
        if (!isFinite(la1) || !isFinite(lo1) || !isFinite(la2) || !isFinite(lo2)) return null;
        var R = 6371000;
        var f1 = la1 * Math.PI / 180, f2 = la2 * Math.PI / 180;
        var df = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
        var a = Math.sin(df / 2) * Math.sin(df / 2)
            + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    function normAddr(s) {
        if (s == null) return '';
        return String(s).toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
            .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function trySdkNodeSegmentIds(sdk, nodeId) {
        var out = [];
        if (nodeId == null) return out;
        var ni = Number(nodeId);
        if (!isFinite(ni)) return out;
        var Nodes = sdk.DataModel && (sdk.DataModel.Nodes || sdk.DataModel.Junctions);
        if (!Nodes || typeof Nodes.getById !== 'function') return out;
        var node, na, m;
        try {
            node = Nodes.getById({ id: ni }) || Nodes.getById({ nodeId: ni }) || Nodes.getById({ junctionId: ni });
        } catch (e) { return out; }
        if (!node) return out;
        na = node.attributes || node;
        function addMany(arr) {
            if (!Array.isArray(arr)) return;
            for (m = 0; m < arr.length; m++) {
                var it = arr[m];
                if (it == null) continue;
                if (typeof it === 'object' && it.id != null) out.push(Number(it.id) || 0);
                else if (typeof it === 'number' || (typeof it === 'string' && /^\d+$/.test(String(it).trim())))
                    out.push(Number(it));
            }
        }
        addMany(na.segments);
        addMany(na.segmentIds);
        addMany(na.attachedSegIDs);
        addMany(na.segIds);
        return out.filter(function (x) { return x > 0; });
    }

    function getAdjacentFromSdkSegment(sdk, seg) {
        var out = [];
        if (!seg) return out;
        var sa = seg.attributes || seg, seen = {};
        var nids = [];
        if (sa.fromNodeId != null) nids.push(sa.fromNodeId);
        if (sa.toNodeId != null) nids.push(sa.toNodeId);
        if (nids.length === 0) {
            if (sa.from && sa.from.id != null) nids.push(sa.from.id);
            if (sa.to && sa.to.id != null) nids.push(sa.to.id);
        }
        var j, nis, n;
        for (j = 0; j < nids.length; j++) {
            nis = trySdkNodeSegmentIds(sdk, nids[j]);
            for (n = 0; n < nis.length; n++) { if (nis[n]) seen[nis[n]] = 1; }
        }
        for (j in seen) { if (Object.prototype.hasOwnProperty.call(seen, j)) out.push(Number(j)); }
        return out;
    }

    function getAdjacentWmeLegacy(sid) {
        var Wg, model, segs, seg, f, t, s2, out, seen;
        out = [];
        seen = {};
        function addId(v) {
            v = Number(v);
            if (!isFinite(v) || v <= 0) return;
            if (v === Number(sid)) return;
            if (seen[v]) return;
            seen[v] = 1;
            out.push(v);
        }
        try {
            Wg = window.W;
            if (!Wg || !Wg.model) return out;
            model = Wg.model;
            if (model.segments && (model.segments.getObjectById || model.segments.get)) {
                segs = model.segments;
                seg = segs.getObjectById && segs.getObjectById(sid);
                if (!seg && segs.get) seg = segs.get(sid);
                if (seg) {
                    f = seg.getFromNode && seg.getFromNode();
                    t = seg.getToNode && seg.getToNode();
                    for (s2 = 0; s2 < 2; s2++) {
                        var jn = s2 ? t : f;
                        if (jn) {
                            if (jn.getConnectedSegmentIds) jn.getConnectedSegmentIds().forEach(addId);
                            else if (jn.getConnectedSegments) {
                                jn.getConnectedSegments().forEach(function (c) {
                                    addId(c && c.getID ? c.getID() : c);
                                });
                            }
                        }
                    }
                }
            }
        } catch (e) {}
        if (out.length) return out;
        try {
            Wg = window.W;
            if (!Wg || !Wg.model || !Wg.model.nodes) return out;
            model = Wg.model;
            segs = model.segments;
            if (segs && segs.getObjectById) {
                seg = segs.getObjectById(sid);
                if (seg) {
                    f = (seg.attributes || {}).fromJunctionId;
                    t = (seg.attributes || {}).toJunctionId;
                    for (s2 = 0; s2 < 2; s2++) {
                        var jid = s2 ? t : f, jn;
                        if (jid == null) continue;
                        jn = model.nodes.getObjectById && model.nodes.getObjectById(jid);
                        if (jn && jn.getConnectedSegmentIds) jn.getConnectedSegmentIds().forEach(addId);
                    }
                }
            }
        } catch (e2) {}
        return out;
    }

    function getAllAdjacentIds(sdk, segId) {
        var s = getSegObj(sdk, segId);
        if (!s) return getAdjacentWmeLegacy(segId);
        var a = getAdjacentFromSdkSegment(sdk, s);
        if (a && a.length) return a;
        return getAdjacentWmeLegacy(segId);
    }

    function sortIdsByDistTo(sdk, ids, anchor) {
        if (!ids || !ids.length) return [];
        return ids.map(function (sid) {
            var s = getSegObj(sdk, sid);
            var c = getSegmentCenterPoint(sdk, s);
            return { id: Number(sid), d: c ? distSq(anchor, c) : 1e15 };
        }).sort(function (a, b) { return a.d - b.d; }).map(function (o) { return o.id; });
    }

    function centerFromLegacySegment(seg) {
        if (!seg) return null;
        try {
            if (seg.geometry && typeof seg.geometry.getBounds === 'function') {
                var b = seg.geometry.getBounds();
                if (b && typeof b.getCenterLonLat === 'function') {
                    var ll = b.getCenterLonLat();
                    if (ll && ll.lat != null && ll.lon != null) return { lat: +ll.lat, lon: +ll.lon };
                }
            }
        } catch (e) {}
        try {
            var a = seg.attributes || seg;
            if (a && a.geometry && Array.isArray(a.geometry.coordinates) && a.geometry.coordinates.length) {
                var mid = a.geometry.coordinates[Math.floor(a.geometry.coordinates.length / 2)];
                if (Array.isArray(mid) && mid.length >= 2) return { lat: +mid[1], lon: +mid[0] };
            }
        } catch (e2) {}
        return null;
    }

    function getNearestSegmentIdByAnchor(sdk, anchor) {
        if (!anchor) return null;
        var bestId = null, bestD = 1e30;
        try {
            var Wg = window.W, segs, k, s, sid, c, d;
            if (!Wg || !Wg.model || !Wg.model.segments) return null;
            segs = Wg.model.segments.objects || Wg.model.segments._objects || null;
            if (!segs) return null;
            for (k in segs) {
                if (!Object.prototype.hasOwnProperty.call(segs, k)) continue;
                s = segs[k];
                sid = null;
                if (s && s.attributes && s.attributes.id != null) sid = Number(s.attributes.id);
                if (sid == null || !isFinite(sid) || sid <= 0) sid = Number(k);
                if (!isFinite(sid) || sid <= 0) continue;
                c = getSegmentCenterPoint(sdk, getSegObj(sdk, sid)) || centerFromLegacySegment(s);
                if (!c) continue;
                d = distSq(anchor, c);
                if (d < bestD) {
                    bestD = d;
                    bestId = sid;
                }
            }
        } catch (e) {}
        return bestId;
    }

    function buildOrderedSegmentIds(sdk, ur, details) {
        if (!ur) return [];
        var base = listSegmentIdsFromUr(ur, details);
        var anchor = getAnchorForUr(ur, sdk);
        if (!base.length) {
            var nearId = getNearestSegmentIdByAnchor(sdk, anchor);
            if (nearId != null) base = [nearId];
        }
        if (!base.length) return [];
        var seen = {};
        var i, sorted, nearest, allAdj, u;
        for (i = 0; i < base.length; i++) { seen[base[i]] = 1; }
        sorted = sortIdsByDistTo(sdk, base, anchor);
        nearest = sorted[0];
        allAdj = getAllAdjacentIds(sdk, nearest);
        allAdj = allAdj.filter(function (x) { return !seen[x]; });
        for (i = 0; i < allAdj.length; i++) { seen[allAdj[i]] = 1; }
        u = sortIdsByDistTo(sdk, allAdj, anchor);
        return sorted.concat(u);
    }

    function reverseGeoCacheKey(lat, lon) {
        return (Math.round(lat * 1e5) / 1e5) + ',' + (Math.round(lon * 1e5) / 1e5);
    }

    function reverseGeoPoint(ctx) {
        if (!ctx) return null;
        if (ctx.urAnchor && ctx.urAnchor.lat != null && ctx.urAnchor.lon != null) {
            return { lat: +ctx.urAnchor.lat, lon: +ctx.urAnchor.lon };
        }
        if (ctx.lat != null && ctx.lon != null) return { lat: +ctx.lat, lon: +ctx.lon };
        return null;
    }

    function pickStreetNominatim(a) {
        if (!a) return null;
        var road = a.road || a.motorway || a.trunk || a.primary || a.secondary || a.tertiary
            || a.pedestrian || a.path || a.footway || a.cycleway || a.residential || a.unclassified;
        var n = a.house_number;
        if (road) return n ? (String(road) + ' ' + String(n)).trim() : String(road);
        if (a.motorway || a.trunk) return textFromAny(a.motorway || a.trunk);
        return textFromAny(a.neighbourhood || a.quarter || a.hamlet) || null;
    }

    function pickPlaceNominatim(a) {
        if (!a) return null;
        var p = a.city || a.town || a.village || a.municipality || a.city_district
            || a.suburb || a.hamlet || a.locality || a.county;
        var t0 = textFromAny(p);
        if (t0) return t0;
        if ((a.motorway || a.trunk || a.road) && a.state) return textFromAny(a.state);
        return null;
    }

    function mergeNominatimIntoLoc(cached) {
        if (!cached) return;
        var touched = false;
        var st = textFromAny(cached.street), ci = textFromAny(cached.city), re = textFromAny(cached.region), co = textFromAny(cached.country);
        if (st) { locContext.osmStreet = st; }
        if (ci) { locContext.osmCity = ci; }
        if (st && !textFromAny(locContext.street)) { locContext.street = st; touched = true; }
        if (ci && !textFromAny(locContext.city)) { locContext.city = ci; touched = true; }
        if (re && !textFromAny(locContext.region)) { locContext.region = re; touched = true; }
        if (co && !textFromAny(locContext.country)) { locContext.country = co; touched = true; }
        if (touched) {
            locContext.osmEnriched = true;
            if (locContext.conf === 'none') locContext.conf = 'low';
        }
        locContext.addrMismatch = false;
        var ws = textFromAny(locContext.sdkStreet), wc = textFromAny(locContext.sdkCity);
        var os = textFromAny(locContext.osmStreet), oc = textFromAny(locContext.osmCity);
        if (ws && os && normAddr(ws) !== normAddr(os) && normAddr(ws).slice(0, 4) !== normAddr(os).slice(0, 4)) {
            locContext.addrMismatch = true;
        }
        if (wc && oc && normAddr(wc) !== normAddr(oc) && normAddr(wc).length > 3 && normAddr(oc).length > 3) {
            if (!locContext.addrMismatch && normAddr(wc).indexOf(normAddr(oc)) < 0 && normAddr(oc).indexOf(normAddr(wc)) < 0) {
                locContext.addrMismatch = true;
            }
        }
    }

    function fetchNominatimReverse(lat, lon) {
        var u = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(String(lat))
            + '&lon=' + encodeURIComponent(String(lon)) + '&addressdetails=1&zoom=18';
        return fetch(u, { method: 'GET', mode: 'cors', headers: { Accept: 'application/json' } })
            .then(function (r) { if (!r.ok) throw new Error('nominatim'); return r.json(); });
    }

    function parseNominatimToCache(data) {
        if (!data || !data.address) return null;
        var a = data.address;
        var o = {
            street: pickStreetNominatim(a) || null,
            city: pickPlaceNominatim(a) || null,
            region: a.state || a.region || a.state_district || null,
            country: a.country || null,
        };
        if (!o.street && !o.city && !o.region) return null;
        return o;
    }

    function pushReverseEnrichUI() {
        updateGeo(lastContext.ur);
        updateSegPickerUI();
        fillDefaultSearchText();
        renderSearchButtons();
        if (lastContext.ur) renderChecklist(lastContext.ur);
    }

    function scheduleReverseEnrich(urId) {
        if (settings.reverseGeocode === false) return;
        if (urId == null || lastUrId !== urId) return;
        if (!lastContext.ur) return;
        var rgPt = reverseGeoPoint(locContext);
        if (!rgPt) return;
        if (locContext.conf === 'high' && locContext.street && locContext.city) return;
        if (locContext.street && locContext.city) return;

        var key = reverseGeoCacheKey(rgPt.lat, rgPt.lon);
        if (reverseGeoCache[key]) {
            mergeNominatimIntoLoc(reverseGeoCache[key]);
            pushReverseEnrichUI();
            return;
        }
        if (geocodeState.timer) {
            try { clearTimeout(geocodeState.timer); } catch (e) { geocodeState.timer = null; }
        }
        geocodeState.seq += 1;
        var mySeq = geocodeState.seq;
        var lat0 = rgPt.lat, lon0 = rgPt.lon;
        var wait = Math.max(0, 1000 - (Date.now() - geocodeState.lastEnd));
        geocodeState.timer = setTimeout(function () {
            geocodeState.timer = null;
            if (mySeq !== geocodeState.seq) return;
            if (lastUrId !== urId) return;
            var ap = reverseGeoPoint(locContext);
            if (!ap) return;
            if (Math.abs(ap.lat - lat0) > 1e-6 || Math.abs(ap.lon - lon0) > 1e-6) return;
            fetchNominatimReverse(ap.lat, ap.lon)
                .then(function (data) {
                    if (mySeq !== geocodeState.seq || lastUrId !== urId) return;
                    var parsed = parseNominatimToCache(data);
                    if (parsed) {
                        reverseGeoCache[key] = parsed;
                        mergeNominatimIntoLoc(parsed);
                    }
                    geocodeState.lastEnd = Date.now();
                    pushReverseEnrichUI();
                })
                .catch(function () {
                    geocodeState.lastEnd = Date.now();
                });
        }, wait);
    }

    function rebuildSegPicker(keepIndex) {
        if (!sdk) return;
        if (!lastContext.ur) {
            locContext = emptyLocContext();
            segPicker.ids = [];
            segPicker.index = 0;
            updateSegPickerUI();
            return;
        }
        var ids = buildOrderedSegmentIds(sdk, lastContext.ur, lastContext.details);
        segPicker.ids = ids;
        if (!keepIndex) segPicker.index = 0;
        if (segPicker.index < 0) segPicker.index = 0;
        if (segPicker.ids.length && segPicker.index >= segPicker.ids.length) segPicker.index = 0;
        var fid = segPicker.ids.length > segPicker.index ? segPicker.ids[segPicker.index] : null;
        locContext = buildLocationContext(sdk, lastContext.ur, lastContext.details, fid);
        applyUrTextHeuristics(lastContext.ur, locContext);
        updateSegPickerUI();
        scheduleReverseEnrich(lastUrId);
    }

    function updateSegPickerUI() {
        var n = segPicker.ids.length;
        var sid, snip, st, ci, text;
        if (n === 0) {
            text = t('noSegment');
        } else {
            sid = segPicker.ids[segPicker.index];
            st = textFromAny(locContext.street);
            ci = textFromAny(locContext.city);
            snip = (st || ci) ?
                (st + (st && ci ? ' · ' : '') + ci) :
                (String(sid) || '—');
            text = t('segLabel') + ' ' + (segPicker.index + 1) + '/' + n + ' — ' + snip;
        }
        qAll('uria-seglab').forEach(function (el) { el.textContent = text; });
        qAll('uria-segprev').forEach(function (el) { el.disabled = n <= 1; });
        qAll('uria-segnext').forEach(function (el) { el.disabled = n <= 1; });
    }

    function doOneClickSearch() {
        var sbin = qId('uria-search');
        var q = (sbin && (sbin.value || '').trim()) ? (sbin.value || '').trim() : '';
        if (!q) q = defaultSearchLine();
        if (q) openUrl(searchUrlForQuery(q));
    }

    function nudgeSegmentPick(delta) {
        var n = segPicker.ids.length;
        if (n < 1) return;
        if (n === 1) return;
        segPicker.index = (segPicker.index + delta + n * 8) % n;
        if (!sdk || !lastContext.ur) return;
        var fid2 = segPicker.ids[segPicker.index];
        locContext = buildLocationContext(sdk, lastContext.ur, lastContext.details, fid2);
        applyUrTextHeuristics(lastContext.ur, locContext);
        updateSegPickerUI();
        fillDefaultSearchText();
        updateGeo(lastContext.ur);
        renderSearchButtons();
        renderChecklist(lastContext.ur);
        scheduleReverseEnrich(lastUrId);
    }

    //Str./Ort/Cords aus UR + Segment oder nächstes Segment am Pin, wenn UR keine IDs hat.
    function buildLocationContext(sdk, ur, details, focusSegId) {
        var out = emptyLocContext();
        if (!ur) return out;
        var a = ur.attributes || ur;
        if (textFromAny(a.cityName)) { out.city = textFromAny(a.cityName); out.conf = 'low'; }
        if (textFromAny(a.streetName)) { out.street = textFromAny(a.streetName); out.conf = 'low'; }
        if (textFromAny(a.street)) out.street = out.street || textFromAny(a.street);
        if (a.address) {
            if (typeof a.address === 'string') {
                if (!out.street) { out.street = a.address; out.conf = 'low'; }
            } else if (a.address.street) {
                out.street = textFromAny(a.address.street);
                out.conf = 'low';
            }
        }
        var g = a.geometry || ur.geometry;
        var pt = pointFromGeometry(g);
        if (pt) {
            out.lat = pt.lat; out.lon = pt.lon; out.urAnchor = pt;
            if (out.conf === 'none') out.conf = 'low';
        }
        if (sdk && sdk.Map && typeof sdk.Map.getMapCenter === 'function' && (out.lat == null)) {
            try {
                var mc = sdk.Map.getMapCenter();
                if (mc && mc.lat != null && mc.lon != null) {
                    out.lat = +mc.lat; out.lon = +mc.lon;
                    if (out.conf === 'none') out.conf = 'low';
                }
            } catch (e) {}
        }
        var idList = listSegmentIdsFromUr(ur, details);
        var useExplicit = (focusSegId != null && focusSegId !== undefined);
        var sid;
        var usedNearestSeg = false;
        if (useExplicit) {
            sid = Number(focusSegId);
            if (!isFinite(sid) || sid <= 0) return out;
        } else if (idList.length) {
            sid = idList[0];
        } else {
            var anchorNear = getAnchorForUr(ur, sdk);
            var nearSid = getNearestSegmentIdByAnchor(sdk, anchorNear);
            if (nearSid == null) return out;
            sid = nearSid;
            usedNearestSeg = true;
        }
        var segApi = sdk.DataModel && sdk.DataModel.Segments;
        if (!segApi || typeof segApi.getById !== 'function') return out;
        var s;
        try {
            s = segApi.getById({ segmentId: sid }) || segApi.getById({ id: sid });
        } catch (e) { return out; }
        if (!s) return out;
        var sa = s.attributes || s;
        if (typeof segApi.getAddress === 'function') {
            try {
                var addr = segApi.getAddress({ segmentId: sid });
                if (addr) {
                    if (textFromAny(addr.street)) out.street = textFromAny(addr.street);
                    if (textFromAny(addr.city)) out.city = textFromAny(addr.city);
                    if (textFromAny(addr.state)) out.region = textFromAny(addr.state);
                    if (textFromAny(addr.country)) out.country = textFromAny(addr.country);
                    if (out.street || out.city) out.conf = 'high';
                }
            } catch (e2) {}
        }
        if (!out.street && textFromAny(sa.primaryStreetName)) out.street = textFromAny(sa.primaryStreetName);
        if (!out.street && textFromAny(sa.street)) out.street = textFromAny(sa.street);
        if (!out.city && textFromAny(sa.city)) out.city = textFromAny(sa.city);
        if (out.street || out.city) out.conf = 'high';
        if (out.lat == null || out.lon == null) {
            var sg = sa.geometry || s.geometry;
            var geoMid = pointFromGeometry(sg) || pointFromLineGeometry(sg);
            if (geoMid) { out.lat = geoMid.lat; out.lon = geoMid.lon; }
        }
        if (sdk.Map && typeof sdk.Map.getLonLatFromFeature === 'function') {
            try {
                var ll = sdk.Map.getLonLatFromFeature(s);
                if (ll) { out.lat = +ll.lat; out.lon = +ll.lon; }
            } catch (e) {}
        }
        var urPt = out.urAnchor || pointFromGeometry(a.geometry || ur.geometry);
        out.urAnchor = urPt || out.urAnchor;
        var segPt = null;
        if (out.lat != null && out.lon != null) segPt = { lat: out.lat, lon: out.lon };
        else {
            var sg2 = sa.geometry || s.geometry;
            segPt = pointFromGeometry(sg2) || pointFromLineGeometry(sg2);
        }
        out.segCenter = segPt;
        if (urPt && segPt) out.pinSegmentM = haversineMeters(urPt, segPt);
        if (out.conf === 'high') {
            out.sdkStreet = textFromAny(out.street) || null;
            out.sdkCity = textFromAny(out.city) || null;
        }
        out.segFromNearest = usedNearestSeg;
        return out;
    }

    var BLOCK_CITY_IN_DE = {
        der: 1, dem: 1, die: 1, den: 1, des: 1, einer: 1, einem: 1, eine: 1, einen: 1,
        nähe: 1, naehe: 1, nae: 1, kürze: 1, hinsicht: 1, gegend: 1, stadt: 1, bereich: 1, orde: 1,
        umkreis: 1, abschnitt: 1, folge: 1, moment: 1, zwischendurch: 1, süd: 1, nord: 1, ost: 1, west: 1,
    };
    var BLOCK_CITY_IN_EN = { the: 1, a: 1, an: 1, this: 1, that: 1, my: 1, your: 1, our: 1, its: 1, any: 1, all: 1, case: 1, order: 1, fact: 1, area: 1, general: 1, city: 1 };

    function applyUrTextHeuristics(ur, ctx) {
        if (!ur || !ctx) return;
        if (ctx.conf === 'high' && ctx.street && ctx.city) return;
        var a = ur.attributes || ur;
        var parts = [a.typeText, a.type, a.subType, a.description, a.text].map(function (x) {
            return x == null ? '' : String(x);
        });
        var blob = parts.join(' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
        if (blob.length < 3) return;
        var m, s, added = false;
        if (!ctx.street) {
            m = blob.match(/\b(?:Autobahn|BAB|Bundesautobahn)\s*(?:A\s*)?(\d{1,3})\b/i);
            if (m && m[1]) { ctx.street = 'A' + parseInt(m[1], 10); added = true; }
        }
        if (!ctx.street) {
            m = blob.match(/\bA\s*(\d{1,3})\b/i);
            if (m && m[1]) {
                var an = parseInt(m[1], 10);
                if (an >= 1 && an < 1000) { ctx.street = 'A' + an; added = true; }
            }
        }
        if (!ctx.street) {
            m = blob.match(/\bB\s*(\d{1,4})\b/i);
            if (m && m[1]) { ctx.street = 'B' + parseInt(m[1], 10); added = true; }
        }
        if (!ctx.street) {
            m = blob.match(/\bE\s*(\d{1,3})\b/i);
            if (m && m[1]) { ctx.street = 'E' + parseInt(m[1], 10); added = true; }
        }
        if (!ctx.street) {
            m = blob.match(/([0-9A-ZÄÖÜ][A-Za-zäöüß0-9\.\-']{0,42})\s*(?:str\.?|Str\.?|straße|Straße)\b/);
            if (m && m[1]) {
                s = m[1].replace(/^[\s,;-]+|[\s,;-]+$/g, '');
                if (s.length >= 2 && s.length < 50) { ctx.street = s; added = true; }
            }
        }
        if (!ctx.street) {
            m = blob.match(/([0-9A-ZÄÖÜ][A-Za-zäöüß0-9\.\-']+)\s*str\.\b/i);
            if (m && m[1] && m[1].length >= 2) { ctx.street = m[1].replace(/\s+$/g, '') + ' Str.'; added = true; }
        }
        if (!ctx.street) {
            m = blob.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+(St\.|Street|Road|Ave|Avenue|Blvd|Boulevard|Drive|Dr\.|Lane|Ln|Way)\b/);
            if (m && m[0] && m[0].length < 64) { ctx.street = m[0].replace(/\s+/g, ' ').trim(); added = true; }
        }
        if (!ctx.city) {
            m = blob.match(/\b(?:in|bei|nahe|um)\s+(?!der\s|dem\s|den\s|die\s|einem\s|einer\s|eine\s|einen\s)([A-ZÄÖÜ][a-zäöüßä]+)\b/);
            if (m && m[1] && m[1].length > 2 && m[1].length < 40) {
                var lw = m[1].toLowerCase();
                if (!BLOCK_CITY_IN_DE[lw] && !/^\d/.test(m[1])) { ctx.city = m[1]; added = true; }
            }
        }
        if (!ctx.city) {
            m = blob.match(/\b(?:in|at|near|around)\s+([A-Z][a-z]{2,30})\b/);
            if (m && m[1] && m[1].length > 2 && m[1].length < 40) {
                if (!BLOCK_CITY_IN_EN[m[1].toLowerCase()]) { ctx.city = m[1]; added = true; }
            }
        }
        if (added) {
            ctx.textHeuristic = true;
            if (ctx.conf === 'none') ctx.conf = 'low';
        }
    }

    function computeRisk(ur) {
        if (!ur) return { level: 'unclear', text: t('risk_unclear'), reasons: [] };
        var a = ur.attributes || ur;
        var d = a.description != null || a.text != null ? String(a.description || a.text) : '';
        var txt = d.replace(/\s+/g, ' ').trim();
        var L = txt.length;
        var s = 0;
        var reasons = [];
        var c = !!a.hasComments;
        var pm = locContext.pinSegmentM;

        if (locContext.conf === 'high' && (textFromAny(locContext.street) || textFromAny(locContext.city))) {
            s += 1.35; reasons.push(settings.language === 'en' ? 'strong WME address on segment' : 'starke WME-Adresse am Segment');
        } else if (locContext.conf === 'low' && (textFromAny(locContext.street) || textFromAny(locContext.city))) {
            s += 0.55; reasons.push(settings.language === 'en' ? 'partial address context' : 'teilweise Adressdaten');
        } else {
            s -= 0.45; reasons.push(settings.language === 'en' ? 'weak address context' : 'schwache Adresslage');
        }
        if (pm != null && isFinite(pm)) {
            if (pm <= 40) {
                s += 1.0;
                reasons.push((settings.language === 'en' ? 'pin near segment (~' : 'Pin nahe Segment (~') + Math.round(pm) + ' m)');
            } else if (pm <= 100) {
                s += 0.35;
                reasons.push((settings.language === 'en' ? 'pin offset ~' : 'Pin-Abstand ~') + Math.round(pm) + ' m');
            } else {
                s -= 1.35;
                reasons.push((settings.language === 'en' ? 'pin far from segment (~' : 'Pin weit vom Segment (~') + Math.round(pm) + ' m)');
            }
        } else {
            s -= 0.12;
            reasons.push(settings.language === 'en' ? 'pin–segment distance unknown' : 'Pin↔Segment nicht berechenbar');
        }
        if (locContext.segFromNearest) {
            s -= 0.22;
            reasons.push(settings.language === 'en' ? 'segment: nearest-guess to pin' : 'Segment: nächstes am Pin geschätzt');
        }
        if (locContext.addrMismatch) {
            s -= 0.9;
            reasons.push(settings.language === 'en' ? 'OSM vs WME address mismatch' : 'OSM vs. WME-Adresse widersprüchlich');
        }
        if (locContext.osmEnriched) {
            s += 0.35; reasons.push(settings.language === 'en' ? 'OSM reverse fill' : 'OSM-Reverse ergänzt');
        }
        if (locContext.textHeuristic) {
            s += 0.15; reasons.push(settings.language === 'en' ? 'text heuristic' : 'Text-Heuristik');
        }
        var stx = textFromAny(locContext.street);
        if (stx && /^[ABE]\d/i.test(stx)) {
            s += 0.18;
            reasons.push(settings.language === 'en' ? 'numbered route (A/B/E) in address line' : 'A/B/E-Strecke erkannt');
        }
        if (L > 45) { s += 1.0; reasons.push(settings.language === 'en' ? 'detailed report text' : 'detaillierter Meldungstext'); }
        else if (L > 18) { s += 0.5; reasons.push(settings.language === 'en' ? 'usable report text' : 'brauchbarer Meldungstext'); }
        else if (L < 8) { s -= 0.85; reasons.push(settings.language === 'en' ? 'very short report text' : 'sehr kurzer Meldungstext'); }

        if (/(vollsperr|sperrung|baustell|umleitung|gesperrt|road\s*closed|full\s*closure|detour|construction|road\s*work)/i.test(txt)) {
            s += 0.85; reasons.push(settings.language === 'en' ? 'closure/work keywords' : 'Sperr-/Baustellen-Stichworte');
        }
        if (/(\b20\d{2}\b)|(\b\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}\b)|(\b\d{1,2}:\d{2}\b)/.test(txt)) {
            s += 0.28; reasons.push(settings.language === 'en' ? 'timing/date hint' : 'Zeit-/Datums-Hinweis');
        }
        if (/(general|other|irgendwas|weiß\s*nicht|keine\s*ahnung|unknown|not\s*sure|maybe|vielleicht)/i.test(txt) || (a.type && /general|other/i.test(String(a.type)))) {
            s -= 0.75; reasons.push(settings.language === 'en' ? 'uncertain wording/type' : 'unscharfe Formulierung/Typ');
        }
        if (c) {
            s += 0.22; reasons.push(settings.language === 'en' ? 'comments thread' : 'Kommentarspur');
        }

        if (s >= 2.65) return { level: 'confident', text: t('risk_confident'), reasons: reasons, score: s };
        if (s >= 1.05) return { level: 'likely', text: t('risk_likely'), reasons: reasons, score: s };
        return { level: 'unclear', text: t('risk_unclear'), reasons: reasons, score: s };
    }

    I18N.de.risk_confident = 'eher klar (nur heuristische Texteinschätzung)';
    I18N.de.risk_likely = 'wahrscheinlich (heuristisch, unsicher)';
    I18N.de.risk_unclear = 'unklar (zusätzlich prüfen)';
    I18N.en.risk_confident = 'seems clear (heuristic only)';
    I18N.en.risk_likely = 'likely (heuristic, uncertain)';
    I18N.en.risk_unclear = 'unclear — verify on map';

    var ROAD_TYPE_ROW_DE = {
        1: 'Autobahn', 2: 'Kraftfahrstraße', 3: 'Bundesstraße', 4: 'Landstraße', 5: 'Straße',
        6: 'Schotter / unbefestigt', 7: 'Parkplatz', 8: 'Privatstraße', 9: 'Fußweg',
        10: 'Fußgängerbereich', 11: 'Treppe', 12: 'Gleis / Bahn', 14: 'Fähre', 15: 'Rollfeld',
        16: 'Schmalstraße', 17: 'Mautstelle', 18: 'Offroad',
    };
    var ROAD_TYPE_ROW_EN = {
        1: 'Freeway', 2: 'Major Highway', 3: 'Minor Highway', 4: 'Primary Street', 5: 'Street',
        6: 'Dirt / Unpaved', 7: 'Parking Lot Road', 8: 'Private Road', 9: 'Walking Trail',
        10: 'Pedestrian Boardwalk', 11: 'Stairway', 12: 'Railroad', 14: 'Ferry', 15: 'Runway',
        16: 'Narrow Street', 17: 'Toll Gantry', 18: 'Offroad',
    };
    var ROAD_TYPE_US_DE = {
        1: 'Straße', 2: 'Hauptstraße', 3: 'Autobahn', 4: 'Rampe', 5: 'große Hauptstraße', 6: 'kleine Hauptstraße',
        7: 'Schotter / unbefestigt', 8: 'Parkplatz', 9: 'Privatstraße', 10: 'Fußgängerbereich', 11: 'Fußweg',
        12: 'Treppe', 14: 'Gleis / Bahn', 15: 'Rollfeld', 16: 'Fähre', 17: 'Schmalstraße', 18: 'Mautstelle',
    };
    var ROAD_TYPE_US_EN = {
        1: 'Street', 2: 'Primary Street', 3: 'Freeway', 4: 'Ramp', 5: 'Major Highway', 6: 'Minor Highway',
        7: 'Off-road / Dirt', 8: 'Parking Lot Road', 9: 'Private Road', 10: 'Pedestrian Boardwalk', 11: 'Walking Trail',
        12: 'Stairway', 14: 'Railroad', 15: 'Runway', 16: 'Water Ferry', 17: 'Narrow Street', 18: 'Toll Gantry',
    };

    function wmeCountryLooksUs() {
        try {
            var g = window.W && W.model && W.model.attributes;
            if (!g) return false;
            if (g.countryCode === 'US' || g.countryCode === 'USA' || g.countryAbbr === 'US') return true;
            if (g.country && /^(United States|USA)$/i.test(String(g.country).trim())) return true;
        } catch (e) {}
        return false;
    }

    function roadTypeNameFromWmodel(n) {
        if (!isFinite(n)) return '';
        try {
            var coll = window.W && W.model && W.model.roadTypes;
            if (!coll) return '';
            var f = typeof coll.getObjectById === 'function' ? coll.getObjectById(n) : null;
            if (!f && typeof coll.getObjectById === 'function') f = coll.getObjectById(String(n));
            if (!f && typeof coll.get === 'function') f = coll.get(n);
            if (!f) return '';
            var a = f.attributes || f;
            var nm = a.name || a.roadTypeName || a.title;
            if (nm != null && String(nm).trim()) return String(nm).trim();
        } catch (e) {}
        return '';
    }

    function roadTypeDisplayName(rt) {
        var n = parseInt(String(rt), 10);
        var lang = settings.language === 'en' ? 'en' : 'de';
        if (!isFinite(n)) return rt != null && String(rt).trim() ? String(rt).trim() : '—';
        var live = roadTypeNameFromWmodel(n);
        if (live) return live;
        var us = wmeCountryLooksUs();
        var tbl = us
            ? (lang === 'en' ? ROAD_TYPE_US_EN : ROAD_TYPE_US_DE)
            : (lang === 'en' ? ROAD_TYPE_ROW_EN : ROAD_TYPE_ROW_DE);
        if (tbl[n]) return tbl[n];
        return lang === 'en' ? 'Unknown road type' : 'Unbekannter Straßentyp';
    }

    function autoHintsForItem(key, ur, seg) {
        if (!ur) return { mode: 'manual' };
        var a = ur.attributes || ur;
        var sa = seg && (seg.attributes || seg);
        var d = ((a.description || a.text || '') + '').toString();
        switch (key) {
            case 'ck_spot_exact':
                if (locContext.pinSegmentM != null && isFinite(locContext.pinSegmentM)) {
                    return { mode: 'auto', text: '~' + Math.round(locContext.pinSegmentM) + ' m' };
                }
                return { mode: 'manual' };
            case 'ck_problem_clear':
                if (d.length > 12) {
                    return {
                        mode: 'auto',
                        text: (settings.language === 'en' ? 'Text length ~' : 'Textlänge ca.') + ' ' + d.length + ' — ' + t('manual'),
                    };
                }
                if (d.length < 6) return { mode: 'auto', text: t('autoHint') + ' ' + (settings.language === 'en' ? 'very short text' : 'sehr kurzer Text') + ' — ' + t('manual') };
                return { mode: 'manual' };
            case 'ck_spot_matches_map':
                if (locContext.conf === 'high' && (locContext.street || locContext.city)) {
                    return { mode: 'auto', text: (locContext.street || '—') + (locContext.city ? ', ' + locContext.city : '') };
                }
                if (locContext.textHeuristic && (locContext.street || locContext.city)) {
                    return { mode: 'auto', text: '[' + t('heuristicLabelShort') + '] ' + (locContext.street || '—') + (locContext.city ? ', ' + locContext.city : '') };
                }
                return { mode: 'manual' };
            case 'ck_error_map_visible':
                if (d.length > 25) return { mode: 'auto', text: t('autoHint') + ' längerer Text — ' + t('manual') };
                return { mode: 'manual' };
            case 'ck_roadtype_plausible':
                if (sa && sa.roadType != null) {
                    var rdn = roadTypeDisplayName(sa.roadType);
                    var rlab = settings.language === 'en' ? 'Road type: ' : 'Straßentyp: ';
                    return { mode: 'auto', text: rlab + rdn + ' — ' + t('manual') };
                }
                return { mode: 'manual' };
            case 'ck_geometry_plausible':
                if (sa && sa.length != null && isFinite(+sa.length)) {
                    return {
                        mode: 'auto',
                        text: '~' + (+sa.length).toFixed(1) + ' m ' + (settings.language === 'en' ? 'segment (SDK)' : 'Segment (SDK)') + ' — ' + t('manual'),
                    };
                }
                return { mode: 'manual' };
            case 'ck_direction_oneway_plausible':
                if (sa) {
                    var fd = sa.fwdMaxSpeed, rv = sa.revMaxSpeed;
                    if (fd != null && rv != null && (fd === 0 || rv === 0)) {
                        return { mode: 'auto', text: t('autoHint') + ' FWD/REV unterschiedlich — ' + t('manual') };
                    }
                }
                return { mode: 'manual' };
            case 'ck_turns_tr_plausible':
                if (/abbieg|u-turn|turn|verbots|einbahn|routing|route|no left|no right|restriction/i.test(d)) {
                    return { mode: 'auto', text: t('autoHint') + ' ' + t('hintRoutingKeyword') + ' — ' + t('manual') };
                }
                return { mode: 'manual' };
            case 'ck_speeds_plausible':
                if (/tempo|geschwind|speed|kmh|mph|\d+\s*km/i.test(d)) {
                    return { mode: 'auto', text: t('autoHint') + ' ' + t('hintSpeedKeyword') + ' — ' + t('manual') };
                }
                if (sa && (sa.fwdMaxSpeed != null || sa.revMaxSpeed != null)) {
                    return { mode: 'auto', text: 'FWD ' + (sa.fwdMaxSpeed == null ? '—' : sa.fwdMaxSpeed) + ' / REV ' + (sa.revMaxSpeed == null ? '—' : sa.revMaxSpeed) + ' — ' + t('manual') };
                }
                return { mode: 'manual' };
            case 'ck_closure_traffic_signs':
                if (/bau|sperr|vollsperr|umleit|baustell|gesperrt|closure|detour|blocked|roadwork|verkehr/i.test(d)) {
                    return { mode: 'auto', text: t('autoHint') + ' ' + t('hintClosureKeyword') + ' — ' + t('manual') };
                }
                return { mode: 'manual' };
            case 'ck_imagery_sv_difficult':
                if (d.length < 10) return { mode: 'auto', text: t('autoHint') + ' wenig Detail — ' + t('manual') };
                return { mode: 'manual' };
            case 'ck_info_sufficient_decide':
                if (d.length < 8) return { mode: 'auto', text: t('autoHint') + ' wenig Text — ' + t('manual') };
                return { mode: 'manual' };
            case 'ck_need_reporter_question':
                if (a.hasComments) return { mode: 'auto', text: t('autoHint') + ' ' + t('hintCommentTrail') + ' — ' + t('manual') };
                return { mode: 'manual' };
            case 'ck_note_or_bookmark':
                if (a.hasComments) {
                    return {
                        mode: 'auto',
                        text: t('autoHint') + ' ' + (settings.language === 'en'
                            ? 'thread — consider a map note or bookmark'
                            : 'Kommentarspur evtl. in Notiz/Bookmark festhalten') + ' — ' + t('manual'),
                    };
                }
                return { mode: 'manual' };
            default:
                return { mode: 'manual' };
        }
    }

    function getFirstSegment(sdk, ur) {
        if (!ur) return null;
        if (segPicker.ids.length) {
            var a = getSegObj(sdk, segPicker.ids[segPicker.index]);
            if (a) return a;
        }
        var ids = listSegmentIdsFromUr(ur, lastContext.details);
        if (!ids.length) return null;
        return getSegObj(sdk, ids[0]);
    }

    var queryMode = 'withCity';

    function buildTips(ur) {
        var L = [];
        if (!ur) return L;
        var a = ur.attributes || ur;
        var d = (a.description || a.text || '').toString();
        if (d.length > 25) {
            L.push({ k: 'maperror', t: t('tip_maperr') });
        }
        if (/bau|sperr|vollsperr|umleit|baustell/i.test(d)) {
            L.push({ k: 'work', t: t('tip_work') });
        }
        L.push({ k: 'ext', t: t('tip_ext') });
        if (/tempo|geschwind|speed|kmh|\d+\s*km/i.test(d)) {
            L.push({ k: 'spd', t: t('tip_spd') });
        }
        if (/abbieg|u-turn|turn|verbots|einbahn|routing/i.test(d)) {
            L.push({ k: 'tr', t: t('tip_tr') });
        }
        if (d.length < 8) {
            L.push({ k: 'lo', t: t('tip_lo') });
        }
        return L;
    }

    I18N.de.tip_maperr = 'Hinweis: längere Textbeschreibung — eher klarer Kartenfehler möglich (keine Garantie).';
    I18N.de.tip_work = 'Mögliches Stichwort Baustelle/Sperrung in der Meldung — extern verifizieren.';
    I18N.de.tip_ext = 'Bei Unsicherheit: externe Quellen (Verkehrsmeldungen) prüfen.';
    I18N.de.tip_rt = 'Straßentyp/RT in WME bewusst prüfen (kein Autopilot).';
    I18N.de.tip_tr = 'Abbiege- / U-Turn- / ggf. SRT-Einschränkungen beachten.';
    I18N.de.tip_spd = 'Geschwindigkeit in beiden Richtungen prüfen (falls getrennt sinnvoll).';
    I18N.de.tip_lo = 'Wenig Text — zusätzliche Quellen/Street View sinnvoll (heuristisch).';
    I18N.en.tip_maperr = 'Longer text — a clearer map issue may be more likely (not guaranteed).';
    I18N.en.tip_work = 'Mentions closure/work-like wording — verify externally.';
    I18N.en.tip_ext = 'If unsure: check external live traffic / road sources.';
    I18N.en.tip_rt = 'Review WME road type on purpose (no auto-fix).';
    I18N.en.tip_tr = 'Check turn restrictions and routing limits.';
    I18N.en.tip_spd = 'Check both directions of speed, if applicable.';
    I18N.en.tip_lo = 'Short text — extra sources/Street View often help (heuristic).';

    var checklistKeys = [
        { id: 'spot_exact', l: 'ck_spot_exact' },
        { id: 'problem_clear', l: 'ck_problem_clear' },
        { id: 'route_driven_ok', l: 'ck_route_driven_ok' },
        { id: 'route_suggested_ok', l: 'ck_route_suggested_ok' },
        { id: 'spot_matches_map', l: 'ck_spot_matches_map' },
        { id: 'error_map_visible', l: 'ck_error_map_visible' },
        { id: 'roadtype_plausible', l: 'ck_roadtype_plausible' },
        { id: 'geometry_plausible', l: 'ck_geometry_plausible' },
        { id: 'direction_oneway_plausible', l: 'ck_direction_oneway_plausible' },
        { id: 'turns_tr_plausible', l: 'ck_turns_tr_plausible' },
        { id: 'speeds_plausible', l: 'ck_speeds_plausible' },
        { id: 'closure_traffic_signs', l: 'ck_closure_traffic_signs' },
        { id: 'imagery_sv_difficult', l: 'ck_imagery_sv_difficult' },
        { id: 'external_confirms', l: 'ck_external_confirms' },
        { id: 'spot_recent_edit', l: 'ck_spot_recent_edit' },
        { id: 'cause_pending_livemap', l: 'ck_cause_pending_livemap' },
        { id: 'info_sufficient_decide', l: 'ck_info_sufficient_decide' },
        { id: 'need_reporter_question', l: 'ck_need_reporter_question' },
        { id: 'fix_clean_direct', l: 'ck_fix_clean_direct' },
        { id: 'note_or_bookmark', l: 'ck_note_or_bookmark' },
        { id: 'outcome_resolved_open', l: 'ck_outcome_resolved_open' },
    ];

    function uriaOverlayMount() {
        return document.documentElement || document.body;
    }

    function sanitizeFloatPos(x, y, fw, fh) {
        var iw = window.innerWidth || 1200;
        var ih = window.innerHeight || 800;
        var m = 8;
        fw = Math.max(200, fw || 300);
        fh = Math.max(200, fh || Math.min(560, Math.floor(ih * 0.92)) || 400);
        var maxX = Math.max(m, iw - fw - m);
        var maxY = Math.max(m, ih - fh - m);
        var x0 = typeof x === 'number' && isFinite(x) ? x : 12;
        var y0 = typeof y === 'number' && isFinite(y) ? y : 88;
        if (x0 < m) x0 = 12;
        if (x0 > maxX) x0 = maxX;
        if (y0 < m) y0 = 88;
        if (y0 > maxY) y0 = maxY;
        return { x: x0, y: y0 };
    }

    function applyFloatPosFromState() {
        if (!floatEl) return;
        var s = loadUiState();
        var iw = window.innerWidth || 1200;
        var ih = window.innerHeight || 800;
        if (s.w) floatEl.style.width = Math.max(260, Math.min(iw - 16, s.w)) + 'px';
        if (typeof s.h === 'number' && s.h >= 200) {
            floatEl.style.height = Math.min(Math.max(200, s.h), ih - 16) + 'px';
            floatEl.classList.add('uria-float--fixedh');
        } else {
            floatEl.style.height = '';
            floatEl.classList.remove('uria-float--fixedh');
        }
        var fw = floatEl.offsetWidth || (typeof s.w === 'number' ? s.w : 300) || 300;
        var fh = floatEl.offsetHeight || (typeof s.h === 'number' && s.h >= 200 ? s.h : Math.min(560, Math.floor(ih * 0.92)));
        var xy = sanitizeFloatPos(s.x, s.y, fw, fh);
        floatEl.style.left = xy.x + 'px';
        floatEl.style.top = xy.y + 'px';
    }

    function saveFloatFromDom() {
        if (!floatEl) return;
        var s = loadUiState();
        s.x = floatEl.offsetLeft;
        s.y = floatEl.offsetTop;
        s.w = floatEl.offsetWidth;
        s.h = floatEl.offsetHeight;
        saveUiState(s);
    }

    function injectGlobalCss() {
        var cssVer = '17';
        var prev = document.querySelector('style.uria-gcss');
        if (prev && prev.getAttribute('data-uria-css') !== cssVer) prev.remove();
        if (document.querySelector('style.uria-gcss')) return;
        var st = el('style', 'uria-gcss');
        st.setAttribute('data-uria-css', cssVer);
        st.textContent = ''
            + '#uria-float{position:fixed;z-index:2000100;width:300px;'
            + 'height:auto;max-height:min(720px,92vh);min-height:min(280px,72vh);'
            + 'display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;'
            + 'box-shadow:0 10px 30px rgba(0,0,0,.35);border-radius:10px;'
            + 'font:12px/1.4 system-ui,Segoe UI,Roboto,sans-serif;'
            + 'background:#0b1220;color:#e2e8f0;border:1px solid #334155;}'
            + '#uria-float.uria--light{background:#fff;color:#0f172a;border-color:#cbd5e1;'
            + 'box-shadow:0 8px 22px rgba(0,0,0,.12);}'
            + '#uria-hdr{flex:0 0 auto;display:flex;align-items:flex-start;gap:6px;padding:8px 10px;cursor:grab;'
            + 'box-sizing:border-box;min-height:44px;user-select:none;background:#111827;border-bottom:1px solid #334155;}'
            + '#uria-float.uria--light #uria-hdr{background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#0f172a;}'
            + '#uria-hdr:active{cursor:grabbing;}'
            + '#uria-title{flex:1;min-width:0;font-weight:700;font-size:12px;}'
            + '#uria-rbadge,[id$="uria-rbadge"]{font-size:10px;padding:1px 6px;border-radius:999px;max-width:48%;'
            + 'border:1px solid #64748b;background:#0f172a;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
            + '#uria-float.uria--light #uria-rbadge,#uria-float.uria--light [id$="uria-rbadge"],'
            + '.uria-script-root.uria--light [id$="uria-rbadge"]{background:#fff;border-color:#cbd5e1;}'
            + '#uria-hdr [id$="uria-rbadge"]{align-self:flex-start;}'
            + '#uria-bclose{appearance:none;border:1px solid #64748b;background:#334155;'
            + 'color:#e2e8f0;border-radius:6px;padding:0 5px;cursor:pointer;font-size:9px;'
            + 'line-height:1.1;min-width:20px;height:20px;box-sizing:border-box;font-weight:700;display:inline-flex;'
            + 'align-items:center;justify-content:center;}'
            + '#uria-float.uria--light #uria-bclose{background:#e2e8f0;border-color:#cbd5e1;color:#0f172a;}'
            + '#uria-body,[id$="uria-body"]{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow:hidden;padding:0;'
            + 'box-sizing:border-box;}'
            + '#uria-float > [id$="uria-body"]{flex:1 1 0%;flex-basis:0;min-width:0;min-height:0;width:100%;'
            + 'max-height:100%;overflow:hidden;}'
            + '.uria-script-root{height:78vh;min-height:min(360px,75vh);display:flex;flex-direction:column;}'
            + '.uria-script-root > [id$="uria-body"]{flex:1 1 0%;min-height:0;}'
            + '[id$="uria-tabbar"]{flex:0 0 auto;display:flex;gap:4px;flex-wrap:wrap;align-items:center;'
            + 'box-sizing:border-box;padding:6px 10px;margin:0;border-bottom:1px solid #334155;'
            + 'background:#0d1424;}'
            + '#uria-float.uria--light [id$="uria-tabbar"],.uria-script-root.uria--light [id$="uria-tabbar"]{'
            + 'background:#f8fafc;border-bottom-color:#e2e8f0;}'
            + '[id$="uria-body-scroll"]{flex:1 1 0%;flex-basis:0;min-height:0;min-width:0;width:100%;'
            + 'overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;'
            + 'touch-action:pan-y;padding:6px 10px 8px;box-sizing:border-box;font-size:12px;}'
            + '#uria-float [id$="uria-body-scroll"]{min-height:120px;}'
            + '#uria-footer,[id$="uria-footer"]{flex-shrink:0;flex-grow:0;flex-basis:auto;padding:1px 16px 2px 6px;margin:0;'
            + 'font-size:8px;text-align:center;border-top:1px solid #334155;line-height:1.1;background:#111827;'
            + 'opacity:.95;position:relative;z-index:4;}'
            + '#uria-float.uria--light [id$="uria-footer"]{border-top-color:#e2e8f0;background:#f8fafc;}'
            + '.uria-script-root.uria--light [id$="uria-footer"]{border-top-color:#e2e8f0;background:#f8fafc;}'
            + '[id$="uria-body"] [id$="uria-footer"]{background:#111827;}'
            + '.uria-float-resize{position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:se-resize;'
            + 'z-index:6;pointer-events:auto;background:linear-gradient(135deg,transparent 50%,#64748b 50%);'
            + 'border-bottom-right-radius:8px;}'
            + '#uria-float.uria--light .uria-float-resize{background:linear-gradient(135deg,transparent 50%,#94a3b8 50%);}'
            + '.uria-sec{margin:0 0 10px;}'
            + '.uria-st{font-size:10px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;'
            + 'opacity:.8;margin:0 0 4px;}'
            + '.uria-row{display:flex;align-items:flex-start;gap:6px;font-size:11.5px;margin:3px 0;}'
            + '.uria-row input{margin-top:2px;}'
            + '.uria-badg{font-size:9px;opacity:.85;margin-left:2px;}'
            + '#uria-tips,[id$="uria-tips"]{list-style:disc;padding-left:16px;margin:4px 0 0;}'
            + '#uria-segrow,[id$="uria-segrow"]{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:4px 0;}'
            + '#uria-segprev,#uria-segnext,[id$="uria-segprev"],[id$="uria-segnext"]{flex:0 0 auto;padding:4px 8px;font-size:11px;'
            + 'border:1px solid #64748b;background:#334155;color:#e2e8f0;border-radius:6px;cursor:pointer;}'
            + '#uria-float.uria--light #uria-segprev,#uria-float.uria--light #uria-segnext,'
            + '#uria-float.uria--light [id$="uria-segprev"],#uria-float.uria--light [id$="uria-segnext"],'
            + '.uria-script-root.uria--light [id$="uria-segprev"],.uria-script-root.uria--light [id$="uria-segnext"]'
            + '{background:#e2e8f0;color:#0f172a;border-color:#cbd5e1;}'
            + '#uria-seglab,[id$="uria-seglab"]{flex:1;min-width:0;font-size:10px;opacity:.85;line-height:1.25;word-break:break-word;}'
            + '#uria-bsearch,[id$="uria-bsearch"]{padding:4px 8px;font-size:11px;font-weight:600;}'
            + '#uria-sbt,[id$="uria-sbt"]{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;}'
            + '#uria-sbt button,[id$="uria-sbt"] button{appearance:none;border:1px solid #64748b;background:#334155;'
            + 'color:#e2e8f0;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;max-width:100%;text-align:left;}'
            + '#uria-float.uria--light #uria-sbt button,#uria-float.uria--light [id$="uria-sbt"] button,'
            + '.uria-script-root.uria--light #uria-sbt button,.uria-script-root.uria--light [id$="uria-sbt"] button'
            + '{background:#e2e8f0;border-color:#cbd5e1;color:#0f172a;}'
            + '#uria-sbt button:hover,[id$="uria-sbt"] button:hover{filter:brightness(1.06);}'
            + '#uria-acts .uria-acts-primary,[id$="uria-acts"] .uria-acts-primary{border-color:#1d4ed8;background:#2563eb;color:#fff;}'
            + '#uria-float.uria--light #uria-acts .uria-acts-primary,#uria-float.uria--light [id$="uria-acts"] .uria-acts-primary,'
            + '.uria-script-root.uria--light #uria-acts .uria-acts-primary,.uria-script-root.uria--light [id$="uria-acts"] .uria-acts-primary'
            + '{background:#2563eb;border-color:#1d4ed8;color:#fff;}'
            + '#uria-search,[id$="uria-search"]{width:100%;min-height:52px;box-sizing:border-box;border-radius:6px;'
            + 'border:1px solid #475569;background:#0f172a;color:#e2e8f0;padding:6px;font-size:12px;resize:vertical;}'
            + '#uria-float.uria--light #uria-search,#uria-float.uria--light [id$="uria-search"],'
            + '.uria-script-root.uria--light #uria-search,.uria-script-root.uria--light [id$="uria-search"]'
            + '{background:#fff;border-color:#cbd5e1;color:#0f172a;}'
            + '#uria-acts,[id$="uria-acts"]{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0;}'
            + '#uria-acts button,[id$="uria-acts"] button{appearance:none;border-radius:6px;border:1px solid #64748b;'
            + 'background:#334155;color:#e2e8f0;padding:4px 8px;cursor:pointer;font-size:11px;}'
            + '#uria-float.uria--light #uria-acts button,#uria-float.uria--light [id$="uria-acts"] button,'
            + '.uria-script-root.uria--light #uria-acts button,.uria-script-root.uria--light [id$="uria-acts"] button'
            + '{background:#e2e8f0;border-color:#cbd5e1;color:#0f172a;}'
            + '.uria--compact .uria-row,.uria--compact #uria-tips,.uria--compact [id$="uria-tips"],.uria-script-root.uria--compact .uria-row,.uria-script-root.uria--compact #uria-tips,.uria-script-root.uria--compact [id$="uria-tips"]{font-size:10.5px;}'
            + '#uria-geo,[id$="uria-geo"]{font-size:10px;opacity:.85;margin:2px 0 6px;line-height:1.3;word-break:break-word;}'
            + '.uria-geo-pinrow{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:6px;row-gap:2px;margin:4px 0 2px;'
            + 'max-width:100%;}'
            + '.uria-geo-pinlab{flex:0 1 auto;min-width:0;word-break:normal;}'
            + '.uria-geo-pinv{flex:0 0 auto;white-space:nowrap;font-weight:700;font-variant-numeric:tabular-nums;}'
            + '#uria-geo .warn,[id$="uria-geo"] .warn{color:#fbbf24;}'
            + '#uria-geo .ok,[id$="uria-geo"] .ok{opacity:1;}'
            + '#uria-launch{position:fixed;z-index:2000101;right:10px;bottom:20px;'
            + 'padding:6px 10px;border-radius:999px;border:1px solid #64748b;background:#0f172a;'
            + 'color:#fff;cursor:pointer;font-size:11px;box-shadow:0 4px 16px rgba(0,0,0,.3);'
            + 'display:none;}'
            + '#uria-float.uria--light + #uria-launch, #uria-launch.uria--light{'
            + 'background:#fff;border-color:#cbd5e1;color:#0f172a;box-shadow:0 8px 22px rgba(0,0,0,.1);}'
            + '[id$="uria-tabbar"] .uria-tabbtn{flex:1;font-size:10px;padding:4px 8px;border-radius:6px;cursor:pointer;'
            + 'border:1px solid #64748b;background:#334155;color:#e2e8f0;}'
            + '#uria-float.uria--light [id$="uria-tabbar"] .uria-tabbtn,.uria-script-root.uria--light [id$="uria-tabbar"] .uria-tabbtn'
            + '{background:#e2e8f0;color:#0f172a;border-color:#cbd5e1;}'
            + '[id$="uria-tabbar"] .uria-tabbtn--on{background:#2563eb !important;border-color:#1d4ed8 !important;color:#fff !important;}'
            + '#uria-tabbar .uria-tabbtn--on,[id$="uria-tabbar"] .uria-tabbtn--on{outline:none;}'
            + '.uria-script-root.uria--light{background:#fff;color:#0f172a;border-radius:10px;border:1px solid #cbd5e1;'
            + 'box-shadow:0 8px 22px rgba(0,0,0,.08);}'
            + '.uria-script-root.uria--dark{background:#0b1220;color:#e2e8f0;border-radius:10px;border:1px solid #334155;}'
            + '#uria-footer a,[id$="uria-footer"] a{color:#60a5fa;}'
            + '#uria-footer a:hover,[id$="uria-footer"] a:hover{text-decoration:underline;color:#93c5fd;}'
            + '#uria-float.uria--light #uria-footer a,#uria-float.uria--light [id$="uria-footer"] a,'
            + '.uria-script-root.uria--light #uria-footer a,.uria-script-root.uria--light [id$="uria-footer"] a{color:#2563eb;}'
            + 'select[id$="uria-set-eng"]{width:100%;box-sizing:border-box;border:1px solid #475569;background:#0f172a;'
            + 'color:#e2e8f0;border-radius:6px;padding:6px;font-size:12px;}'
            + '#uria-float.uria--light select[id$="uria-set-eng"],.uria-script-root.uria--light select[id$="uria-set-eng"]'
            + '{background:#fff;color:#0f172a;border-color:#cbd5e1;}'
        document.documentElement.appendChild(st);
    }

    function setThemeClass() {
        var light = settings.lightTheme !== false;
        if (floatEl) floatEl.classList.toggle('uria--light', light);
        if (SUR.t.root) {
            SUR.t.root.classList.toggle('uria--light', light);
            SUR.t.root.classList.toggle('uria--dark', !light);
        }
    }

    var launcherBtn = null;

    function setLauncherVisible(vis) {
        if (launcherBtn) launcherBtn.style.display = vis ? 'block' : 'none';
    }

    function ensureFloatInViewport() {
        if (!floatEl) return;
        var w = floatEl.offsetWidth || 300, h = floatEl.offsetHeight || 200;
        var maxL = Math.max(8, window.innerWidth - w - 8);
        var maxT = Math.max(8, window.innerHeight - h - 8);
        var l = floatEl.offsetLeft, top = floatEl.offsetTop;
        if (l > maxL) { floatEl.style.left = maxL + 'px'; l = maxL; }
        if (top > maxT) { floatEl.style.top = maxT + 'px'; top = maxT; }
        if (l < 4) floatEl.style.left = '4px';
        if (top < 4) floatEl.style.top = '4px';
    }

    function setFloatVisible(vis) {
        if (!floatEl) return;
        if (vis) {
            floatEl.style.display = 'flex';
            ensureFloatInViewport();
        } else {
            floatEl.style.display = 'none';
        }
    }

    function createCommonBody(P, isFloatShell, bucket) {
        bucket = bucket || {};
        var bodyLocal = el('div');
        bucket.bodyEl = bodyLocal;
        bodyLocal.id = P + 'uria-body';

        var scrollPart = el('div');
        scrollPart.id = P + 'uria-body-scroll';

        var tabBar = el('div');
        tabBar.id = P + 'uria-tabbar';
        tabBar.style.cssText = 'margin:0;';
        function makeTabBtn(tabId, labelKey) {
            var b = el('button', 'uria-tabbtn');
            b.type = 'button';
            b.setAttribute('data-tab', tabId);
            b.textContent = t(labelKey);
            b.classList.toggle('uria-tabbtn--on', activeMainTab === tabId);
            b.addEventListener('click', function (e) { e.stopPropagation(); setMainTab(tabId); });
            return b;
        }
        tabBar.appendChild(makeTabBtn('check', 'tabCheck'));
        tabBar.appendChild(makeTabBtn('research', 'tabResearch'));
        if (!isFloatShell) tabBar.appendChild(makeTabBtn('settings', 'tabSettings'));

        var paneCheck = el('div');
        paneCheck.id = P + 'uria-pane-check';
        var secC = el('div', 'uria-sec');
        secC.appendChild(el('div', 'uria-st', t('checklist')));
        var list = el('div');
        list.id = P + 'uria-checks';
        secC.appendChild(list);
        paneCheck.appendChild(secC);
        var secT = el('div', 'uria-sec');
        secT.appendChild(el('div', 'uria-st', t('tips')));
        var tipsU = el('ul');
        tipsU.id = P + 'uria-tips';
        secT.appendChild(tipsU);
        bucket.tipsEl = tipsU;
        paneCheck.appendChild(secT);
        scrollPart.appendChild(paneCheck);

        var paneResearch = el('div');
        paneResearch.id = P + 'uria-pane-research';
        paneResearch.style.display = 'none';
        var geo = el('div');
        geo.id = P + 'uria-geo';
        paneResearch.appendChild(geo);
        var secR = el('div', 'uria-sec');
        secR.appendChild(el('div', 'uria-st', t('research')));
        var rDisc = el('div', 'warn');
        rDisc.style.cssText = 'font-size:9.5px;line-height:1.35;margin:0 0 6px;opacity:0.95;';
        rDisc.textContent = t('scopeDisclaimer');
        secR.appendChild(rDisc);
        var modeRow = el('div', 'uria-acts');
        [['withCity', 'withCity'], ['noCity', 'noCity']].forEach(function (pair) {
            var b = el('button');
            b.type = 'button';
            b.textContent = t(pair[1]);
            b.setAttribute('data-m', pair[0]);
            b.addEventListener('click', function () {
                queryMode = pair[0] === 'noCity' ? 'noCity' : 'withCity';
                fillDefaultSearchText();
            });
            modeRow.appendChild(b);
        });
        secR.appendChild(modeRow);
        var dateRow = el('div', 'uria-row');
        var dateCb = el('input');
        dateCb.type = 'checkbox';
        dateCb.id = P + 'uria-with-date';
        dateCb.checked = settings.includeMonthYear !== false;
        dateCb.addEventListener('change', function () {
            var on = dateCb.checked;
            qAll('uria-with-date').forEach(function (c) { c.checked = on; });
            settings.includeMonthYear = on;
            saveSettings();
            fillDefaultSearchText();
        });
        var dateLab = el('label');
        dateLab.htmlFor = P + 'uria-with-date';
        dateLab.textContent = t('withDate');
        dateRow.appendChild(dateCb);
        dateRow.appendChild(dateLab);
        secR.appendChild(dateRow);
        var segrow = el('div');
        segrow.id = P + 'uria-segrow';
        var segP = el('button');
        segP.id = P + 'uria-segprev';
        segP.type = 'button';
        segP.setAttribute('aria-label', 'prev segment');
        segP.textContent = '◀';
        segP.title = 'Anderes Segment (Nachbar an Kreuzung/Ende)';
        segP.addEventListener('click', function (e) { e.stopPropagation(); nudgeSegmentPick(-1); });
        segrow.appendChild(segP);
        var segL = el('div');
        segL.id = P + 'uria-seglab';
        segrow.appendChild(segL);
        var segN = el('button');
        segN.id = P + 'uria-segnext';
        segN.type = 'button';
        segN.setAttribute('aria-label', 'next segment');
        segN.textContent = '▶';
        segN.title = 'Anderes Segment (Nachbar an Kreuzung/Ende)';
        segN.addEventListener('click', function (e) { e.stopPropagation(); nudgeSegmentPick(1); });
        segrow.appendChild(segN);
        secR.appendChild(segrow);
        var sBox = el('textarea');
        sBox.id = P + 'uria-search';
        sBox.setAttribute('placeholder', t('searchPlaceholder'));
        secR.appendChild(sBox);
        bucket.searchBox = sBox;
        var act2 = el('div', 'uria-acts');
        var bSearch = el('button');
        bSearch.id = P + 'uria-bsearch';
        bSearch.type = 'button';
        bSearch.className = 'uria-acts-primary';
        bSearch.textContent = t('oneSearch');
        bSearch.title = (settings.searchEngine || 'google') + ' / Suchfeld';
        bSearch.addEventListener('click', function (e) { e.stopPropagation(); doOneClickSearch(); });
        act2.appendChild(bSearch);
        [['regen', regen], ['copyQ', copyQuery]].forEach(function (x) {
            var b0 = el('button');
            b0.type = 'button';
            b0.textContent = t(x[0]);
            b0.addEventListener('click', x[1]);
            act2.appendChild(b0);
        });
        if (isFloatShell) {
            var bp = el('button');
            bp.type = 'button';
            bp.textContent = t('resetPos');
            bp.addEventListener('click', function () {
                var s = loadUiState();
                s.x = 12; s.y = 88; s.w = 300; s.h = 0;
                saveUiState(s);
                applyFloatPosFromState();
            });
            act2.appendChild(bp);
        }
        secR.appendChild(act2);
        var sbt = el('div');
        sbt.id = P + 'uria-sbt';
        secR.appendChild(sbt);
        paneResearch.appendChild(secR);
        scrollPart.appendChild(paneResearch);

        if (!isFloatShell) {
            var paneSettings = el('div');
            paneSettings.id = P + 'uria-pane-settings';
            paneSettings.style.display = 'none';
            paneSettings.appendChild(el('div', 'uria-st', t('settings')));
            paneSettings.appendChild(buildSettingsForm(P));
            scrollPart.appendChild(paneSettings);
        }

        bodyLocal.appendChild(tabBar);
        bodyLocal.appendChild(scrollPart);

        var foot = el('div');
        foot.id = P + 'uria-footer';
        var fa = el('a');
        fa.href = AUTHOR_FOOTER_URL;
        fa.target = '_blank';
        fa.rel = 'noopener noreferrer';
        fa.textContent = t('footerMade');
        fa.style.cssText = 'text-decoration:none;';
        foot.appendChild(fa);
        bodyLocal.appendChild(foot);

        setMainTab(activeMainTab);
        return bodyLocal;
    }

    function buildFloatUi() {
        injectGlobalCss();
        floatEl = el('div', settings.compactLayout ? 'uria--compact' : '');
        floatEl.id = 'uria-float';
        floatEl.setAttribute('role', 'complementary');
        floatEl.setAttribute('aria-label', SCRIPT_NAME);
        if (settings.compactLayout) floatEl.classList.add('uria--compact');

        headerEl = el('div');
        headerEl.id = 'uria-hdr';
        var closeBtn = el('button');
        closeBtn.id = 'uria-bclose';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', t('closeFloat'));
        closeBtn.title = t('closeFloat');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            floatManuallyHidden = true;
            setFloatVisible(false);
            if (settings.autoOpenOnUr !== false) setLauncherVisible(true);
        });
        var twrap = el('div');
        twrap.id = 'uria-title';
        twrap.appendChild(el('div'));
        twrap.firstChild.id = SUR.f.p + 'uria-titleline';
        titleSub = el('div');
        titleSub.id = SUR.f.p + 'uria-subline';
        titleSub.style.cssText = 'font-size:10px;font-weight:500;opacity:.85;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.2;';
        twrap.appendChild(titleSub);
        riskBadge = el('div');
        riskBadge.id = SUR.f.p + 'uria-rbadge';
        headerEl.appendChild(closeBtn);
        headerEl.appendChild(twrap);
        headerEl.appendChild(riskBadge);

        floatEl.appendChild(headerEl);
        SUR.f.refs = {};
        floatEl.appendChild(createCommonBody(SUR.f.p, true, SUR.f.refs));
        var resizeGrip = el('div');
        resizeGrip.className = 'uria-float-resize';
        resizeGrip.title = t('resizeFloat');
        resizeGrip.setAttribute('aria-hidden', 'true');
        resizeGrip.addEventListener('mousedown', startResize);
        floatEl.appendChild(resizeGrip);
        SUR.f.root = floatEl;
        bodyEl = SUR.f.refs.bodyEl;
        uriaOverlayMount().appendChild(floatEl);
        launcherBtn = el('button');
        launcherBtn.id = 'uria-launch';
        launcherBtn.type = 'button';
        launcherBtn.textContent = t('title');
        launcherBtn.addEventListener('click', function () {
            if (!floatEl) return;
            floatManuallyHidden = false;
            setFloatVisible(true);
            setLauncherVisible(false);
        });
        uriaOverlayMount().appendChild(launcherBtn);

        headerEl.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onGlobalPointerMove);
        document.addEventListener('mouseup', endGlobalPointer);
        floatEl.style.display = 'none';
        setLauncherVisible(false);
        applyFloatPosFromState();
        setThemeClass();
    }

    function buildScriptMount(tabPane) {
        injectGlobalCss();
        var wrap = el('div', 'uria-script-root');
        wrap.classList.add(settings.lightTheme !== false ? 'uria--light' : 'uria--dark');
        wrap.style.cssText = 'font:12px/1.4 system-ui,Segoe UI,Roboto,sans-serif;'
            + 'display:flex;flex-direction:column;height:78vh;min-height:min(360px,75vh);'
            + 'padding:8px 10px;max-height:78vh;overflow:hidden;box-sizing:border-box;';

        var miniHdr = el('div');
        miniHdr.style.cssText = 'display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;flex-wrap:wrap;'
            + 'flex-shrink:0;';
        var tw2 = el('div');
        tw2.style.cssText = 'flex:1;min-width:0;';
        var tl2 = el('div');
        tl2.id = SUR.t.p + 'uria-titleline';
        tl2.style.fontWeight = '700';
        tl2.style.fontSize = '12px';
        tl2.textContent = t('title');
        titleSub = el('div');
        titleSub.id = SUR.t.p + 'uria-subline';
        titleSub.style.cssText = 'font-size:10px;font-weight:500;opacity:.85;line-height:1.2;margin-top:2px;';
        tw2.appendChild(tl2);
        tw2.appendChild(titleSub);
        riskBadge = el('div');
        riskBadge.id = SUR.t.p + 'uria-rbadge';
        riskBadge.style.cssText = 'align-self:flex-start;';
        miniHdr.appendChild(tw2);
        miniHdr.appendChild(riskBadge);
        wrap.appendChild(miniHdr);

        SUR.t.refs = {};
        wrap.appendChild(createCommonBody(SUR.t.p, false, SUR.t.refs));
        SUR.t.root = wrap;
        tabPane.appendChild(wrap);
    }

    function buildSettingsForm(idPrefix) {
        var P = idPrefix || 'T-';
        var w = el('div');
        function addRow(lab, node) {
            var r = el('div', 'uria-row');
            r.appendChild(lab);
            r.appendChild(node);
            return r;
        }
        var c1 = el('input');
        c1.type = 'checkbox';
        c1.id = P + 'uria-set-a';
        c1.checked = settings.autoOpenOnUr !== false;
        c1.addEventListener('change', function () { settings.autoOpenOnUr = c1.checked; saveSettings(); });
        w.appendChild(addRow((function () {
            var L = el('label');
            L.htmlFor = P + 'uria-set-a';
            L.textContent = t('autoOpen');
            return L;
        }()), c1));
        var c1b = el('input');
        c1b.type = 'checkbox';
        c1b.id = P + 'uria-set-asearch';
        c1b.checked = settings.autoOpenSearch === true;
        c1b.addEventListener('change', function () { settings.autoOpenSearch = c1b.checked; saveSettings(); });
        w.appendChild(addRow((function () { var L = el('label'); L.htmlFor = P + 'uria-set-asearch'; L.textContent = t('autoSearchUr'); return L; }()), c1b));
        var c1c = el('input');
        c1c.type = 'checkbox';
        c1c.id = P + 'uria-set-rgeo';
        c1c.checked = settings.reverseGeocode !== false;
        c1c.addEventListener('change', function () { settings.reverseGeocode = c1c.checked; saveSettings(); if (SUR.t.root || SUR.f.root) scheduleRefresh(); });
        w.appendChild(addRow((function () { var L = el('label'); L.htmlFor = P + 'uria-set-rgeo'; L.textContent = t('revGeo'); return L; }()), c1c));
        var c2 = el('input');
        c2.type = 'checkbox';
        c2.id = P + 'uria-set-b';
        c2.checked = !!settings.compactLayout;
        c2.addEventListener('change', function () {
            settings.compactLayout = c2.checked;
            if (floatEl) floatEl.classList.toggle('uria--compact', settings.compactLayout);
            if (SUR.t.root) SUR.t.root.classList.toggle('uria--compact', settings.compactLayout);
            saveSettings();
        });
        w.appendChild(addRow((function () { var L = el('label'); L.htmlFor = P + 'uria-set-b'; L.textContent = t('compact'); return L; }()), c2));
        var c3 = el('input');
        c3.type = 'checkbox';
        c3.id = P + 'uria-set-c';
        c3.checked = settings.lightTheme !== false;
        c3.addEventListener('change', function () {
            settings.lightTheme = c3.checked;
            if (launcherBtn) launcherBtn.classList.toggle('uria--light', settings.lightTheme !== false);
            setThemeClass();
            saveSettings();
        });
        w.appendChild(addRow((function () { var L = el('label'); L.htmlFor = P + 'uria-set-c'; L.textContent = t('light'); return L; }()), c3));
        var c4 = el('input');
        c4.type = 'checkbox';
        c4.id = P + 'uria-set-d';
        c4.checked = settings.showRisk !== false;
        c4.addEventListener('change', function () { settings.showRisk = c4.checked; saveSettings(); scheduleRefresh(); });
        w.appendChild(addRow((function () { var L = el('label'); L.htmlFor = P + 'uria-set-d'; L.textContent = t('riskShow'); return L; }()), c4));
        var sel = el('select');
        sel.id = P + 'uria-set-eng';
        [['google', t('se_google')], ['bing', t('se_bing')], ['ddg', t('se_ddg')]].forEach(function (o) {
            var op = el('option');
            op.value = o[0];
            op.textContent = o[1];
            sel.appendChild(op);
        });
        sel.value = settings.searchEngine || 'google';
        sel.addEventListener('change', function () { settings.searchEngine = sel.value; saveSettings(); });
        w.appendChild(addRow((function () { var L = el('label'); L.htmlFor = P + 'uria-set-eng'; L.textContent = t('engine'); return L; }()), sel));
        w.appendChild(el('div', 'uria-st', t('btnSearches')));
        Object.keys(DEFAULTS.searchButtons).forEach(function (k) {
            var c = el('input');
            c.type = 'checkbox';
            c.checked = ((settings.searchButtons || DEFAULTS.searchButtons)[k] !== false);
            c.setAttribute('data-s', k);
            c.addEventListener('change', function () {
                settings.searchButtons = Object.assign({}, DEFAULTS.searchButtons, settings.searchButtons || {});
                settings.searchButtons[k] = c.checked;
                saveSettings();
                renderSearchButtons();
            });
            var L = el('label');
            L.textContent = ' ' + k;
            w.appendChild(addRow(L, c));
        });
        return w;
    }

    function startResize(ev) {
        if (!floatEl) return;
        ev.stopPropagation();
        ev.preventDefault();
        posResize.active = true;
        posResize.sx = ev.clientX;
        posResize.sy = ev.clientY;
        posResize.sw = floatEl.offsetWidth;
        posResize.sh = floatEl.offsetHeight;
    }

    function startDrag(ev) {
        if (ev.target && ev.target.closest && ev.target.closest('button')) return;
        if (ev.target && ev.target.closest && ev.target.closest('.uria-float-resize')) return;
        posDrag.active = true;
        posDrag.x = ev.clientX;
        posDrag.y = ev.clientY;
        if (!floatEl) return;
        posDrag.ox = floatEl.offsetLeft;
        posDrag.oy = floatEl.offsetTop;
        ev.preventDefault();
    }
    function onGlobalPointerMove(ev) {
        if (posResize.active && floatEl) {
            var dw = ev.clientX - posResize.sx;
            var dh = ev.clientY - posResize.sy;
            var nw = Math.max(260, Math.min(window.innerWidth - floatEl.offsetLeft - 8, posResize.sw + dw));
            var nh = Math.max(200, Math.min(window.innerHeight - floatEl.offsetTop - 8, posResize.sh + dh));
            floatEl.style.width = nw + 'px';
            floatEl.style.height = nh + 'px';
            return;
        }
        if (!posDrag.active || !floatEl) return;
        var dx = ev.clientX - posDrag.x;
        var dy = ev.clientY - posDrag.y;
        floatEl.style.left = (posDrag.ox + dx) + 'px';
        floatEl.style.top = (posDrag.oy + dy) + 'px';
    }
    function endGlobalPointer() {
        if (posResize.active) {
            posResize.active = false;
            if (floatEl) floatEl.classList.add('uria-float--fixedh');
            saveFloatFromDom();
            return;
        }
        if (posDrag.active) {
            posDrag.active = false;
            saveFloatFromDom();
        }
    }

    function copyQuery() {
        var sbin = qId('uria-search');
        if (!sbin) return;
        var q = (sbin.value || '').trim();
        if (!q) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(q).catch(function () { fallbackCopy(q); });
        } else { fallbackCopy(q); }
    }
    function fallbackCopy(t0) {
        var ta = el('textarea');
        ta.value = t0;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
    }
    function regen() { fillDefaultSearchText(); }
    function monthYearToken() {
        var d = new Date();
        var mm = String(d.getMonth() + 1);
        var yyyy = String(d.getFullYear());
        return settings.language === 'en' ? (yyyy + '-' + mm.padStart(2, '0')) : (mm + '/' + yyyy);
    }
    function buildLocationQuery() {
        var s = textFromAny(locContext.street);
        var c = textFromAny(locContext.city);
        var r0 = textFromAny(locContext.region);
        var co0 = textFromAny(locContext.country);
        if (queryMode === 'noCity') {
            if (s) return s;
            if (r0) return r0;
            return '';
        }
        if (s && c) return s + ' ' + c;
        if (c) return c;
        if (s && r0) return s + ' ' + r0;
        if (s) return s;
        if (r0 && co0) return r0 + ' ' + co0;
        if (r0) return r0;
        if (co0) return co0;
        return '';
    }

    function defaultSearchLine(keyword) {
        var k = (keyword || (settings.language === 'en' ? 'road closure' : 'Vollsperrung')).trim();
        var q = (buildLocationQuery() || '').trim();
        var dTok = settings.includeMonthYear === false ? '' : monthYearToken();
        if (!q) {
            return (k + ' ' + t('searchNoLocation') + (dTok ? ' ' + dTok : '')).replace(/\s+/g, ' ').trim();
        }
        return (k + ' ' + q + (dTok ? ' ' + dTok : '')).replace(/\s+/g, ' ').trim();
    }
    function fillDefaultSearchText() {
        var v = defaultSearchLine();
        qAll('uria-search').forEach(function (el) { el.value = v; });
    }
    function searchUrlForQuery(q) {
        var e = settings.searchEngine || 'google';
        var enc = encodeURIComponent(q);
        if (e === 'bing') return 'https://www.bing.com/search?q=' + enc;
        if (e === 'ddg') return 'https://duckduckgo.com/?q=' + enc;
        return 'https://www.google.com/search?q=' + enc;
    }
    function openUrl(u) {
        if (!u || typeof u !== 'string') return;
        try {
            var a = document.createElement('a');
            a.href = u;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none;';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            try { window.open(u, '_blank', 'noopener,noreferrer'); } catch (e2) {}
        }
    }

    function renderSearchButtons() {
        var boxes = qAll('uria-sbt');
        if (!boxes.length) return;
        var sb = Object.assign({}, DEFAULTS.searchButtons, settings.searchButtons || {});

        var searchDefs = {
            fullclosure: { de: 'Vollsperrung', en: 'full closure' },
            construction: { de: 'Baustelle', en: 'road works' },
            closure: { de: 'Sperrung', en: 'road closure' },
            traffic: { de: 'Verkehrsführung', en: 'traffic routing' },
            detour: { de: 'Umleitung', en: 'detour' },
        };
        var lang = settings.language === 'en' ? 'en' : 'de';

        function fillOneBox(box) {
            box.innerHTML = '';
            function addTextBtn(key) {
                if (sb[key] === false) return;
                var kw = (searchDefs[key] && searchDefs[key][lang]) || key;
                var b = el('button');
                b.type = 'button';
                b.textContent = (lang === 'en' ? 'Search: ' : 'Suche: ') + kw;
                b.addEventListener('click', function () {
                    openUrl(searchUrlForQuery(defaultSearchLine(kw)));
                });
                box.appendChild(b);
            }
            addTextBtn('fullclosure');
            addTextBtn('construction');
            addTextBtn('closure');
            addTextBtn('traffic');
            addTextBtn('detour');

            if (sb.gmaps !== false) {
                var bG = el('button');
                bG.type = 'button';
                bG.textContent = 'Google Maps';
                bG.addEventListener('click', function () {
                    if (locContext.lat != null && locContext.lon != null) {
                        openUrl('https://www.google.com/maps/@?api=1&map_action=map&center=' + locContext.lat + ',' + locContext.lon + '&zoom=19');
                    } else {
                        var gq = (buildLocationQuery() || ((locContext.street || '') + ' ' + (locContext.city || '')).trim());
                        if (gq) openUrl('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(gq));
                        else openUrl('https://www.google.com/maps/');
                    }
                });
                box.appendChild(bG);
            }
            if (sb.osm !== false) {
                var bO = el('button');
                bO.type = 'button';
                bO.textContent = 'OSM Karte';
                bO.addEventListener('click', function () {
                    if (locContext.lat != null && locContext.lon != null) {
                        var la = locContext.lat, lo = locContext.lon;
                        openUrl('https://www.openstreetmap.org/?mlat=' + la + '&mlon=' + lo + '#map=19/' + la + '/' + lo);
                    } else {
                        var oq = (buildLocationQuery() || ((locContext.street || '') + ' ' + (locContext.city || '')).trim());
                        if (oq) openUrl('https://www.openstreetmap.org/search?query=' + encodeURIComponent(oq));
                        else openUrl('https://www.openstreetmap.org/');
                    }
                });
                box.appendChild(bO);
            }
            if (sb.nominatim !== false) {
                var bN = el('button');
                bN.type = 'button';
                bN.textContent = 'Nominatim';
                bN.addEventListener('click', function () {
                    var nq = (buildLocationQuery() || ((locContext.street || '') + ' ' + (locContext.city || '')).trim());
                    if (nq) {
                        openUrl('https://nominatim.openstreetmap.org/ui/search.html?q=' + encodeURIComponent(nq));
                        return;
                    }
                    if (locContext.lat != null && locContext.lon != null) {
                        openUrl('https://nominatim.openstreetmap.org/ui/reverse.html?lat=' + encodeURIComponent(String(locContext.lat)) + '&lon=' + encodeURIComponent(String(locContext.lon)));
                    } else {
                        openUrl('https://nominatim.openstreetmap.org/ui/');
                    }
                });
                box.appendChild(bN);
            }
            if (sb.streetview !== false) {
                var bS = el('button');
                bS.type = 'button';
                bS.textContent = 'Street View (G)';
                bS.addEventListener('click', function () {
                    if (locContext.lat != null && locContext.lon != null) {
                        openUrl('https://www.google.com/maps?layer=c&cbll=' + locContext.lat + ',' + locContext.lon);
                    } else {
                        var sq = buildLocationQuery() || defaultSearchLine(settings.language === 'en' ? 'street view' : 'Street View');
                        openUrl(searchUrlForQuery(sq));
                    }
                });
                box.appendChild(bS);
            }
        }
        boxes.forEach(fillOneBox);
    }

    var titleLineEl = null;
    function renderChecklist(ur) {
        var lists = qAll('uria-checks');
        if (!lists.length) return;
        function fillList(list) {
            list.innerHTML = '';
            if (!ur) return;
            var seg = getFirstSegment(sdk, ur);
            checklistKeys.forEach(function (def) {
                var row = el('div', 'uria-row');
                var h = autoHintsForItem('ck_' + def.id, ur, seg);
                var cb = el('input');
                cb.type = 'checkbox';
                var uid = (lastUrId != null) ? 'id' + lastUrId : 'x';
                var st = (checksMap[uid] || {});
                cb.checked = !!st[def.id];
                cb.addEventListener('change', function () {
                    if (lastUrId == null) return;
                    var u = 'id' + lastUrId;
                    checksMap[u] = checksMap[u] || {};
                    checksMap[u][def.id] = cb.checked;
                    saveChecksMap();
                    var ix = checklistKeys.findIndex(function (d) { return d.id === def.id; });
                    if (ix < 0) return;
                    lists.forEach(function (other) {
                        if (other === list) return;
                        var rows = other.querySelectorAll('.uria-row input[type=checkbox]');
                        if (rows[ix]) rows[ix].checked = cb.checked;
                    });
                });
                var L = el('label');
                L.appendChild(document.createTextNode(t(def.l) + ' '));
                if (h.mode === 'auto') {
                    var sp = el('span', 'uria-badg');
                    sp.textContent = '[' + t('autoHint') + ' ' + h.text + ']';
                    L.appendChild(sp);
                } else {
                    L.appendChild(el('span', 'uria-badg', '[ ' + t('manual') + ' ]'));
                }
                var wrap = el('div');
                wrap.appendChild(cb);
                wrap.appendChild(L);
                row.appendChild(wrap);
                list.appendChild(row);
            });
        }
        lists.forEach(fillList);
    }

    function updateGeo(ur) {
        var rrCached = (ur && settings.showRisk !== false) ? computeRisk(ur) : null;
        function fillGeo(g) {
            g.innerHTML = '';
            if (!ur) { g.appendChild(el('div', 'warn', t('subUnknown'))); return; }
            var bits = [locContext.street, locContext.city, locContext.region]
                .filter(function (v) { return v != null && String(v).trim() !== ''; })
                .map(function (v) { return String(v).trim(); });
            var line = bits.join(', ');

            g.appendChild(el('div', 'uria-st', t('geoForSearch')));
            var hasStreetName = !!textFromAny(locContext.street);
            if (line) {
                g.appendChild(el('div', locContext.conf === 'high' ? 'ok' : 'warn', line));
            } else if (locContext.lat != null && locContext.lon != null) {
                var la = Math.round(locContext.lat * 1e5) / 1e5;
                var lo = Math.round(locContext.lon * 1e5) / 1e5;
                g.appendChild(el('div', 'warn', la + ', ' + lo));
                g.appendChild(el('div', 'ok', t('geoCoordsFallback')));
            } else {
                g.appendChild(el('div', 'warn', t('subUnknown')));
            }
            if (ur && !hasStreetName) g.appendChild(el('div', 'ok', t('geoZoomTip')));
            if (locContext.segFromNearest) g.appendChild(el('div', 'warn', t('geoNearestSeg')));

            if (rrCached) {
                g.appendChild(el('div', 'ok', t('risk') + ' ' + rrCached.text));
                if (rrCached.reasons && rrCached.reasons.length) {
                    g.appendChild(el('div', 'warn', t('riskWhy') + ' ' + rrCached.reasons.slice(0, 6).join(' · ')));
                }
            }
            if (locContext.pinSegmentM != null && isFinite(locContext.pinSegmentM)) {
                var cls0 = locContext.pinSegmentM <= 40 ? 'ok' : 'warn';
                var pinRow = el('div', 'uria-geo-pinrow ' + cls0);
                var pinLab = el('span', 'uria-geo-pinlab');
                pinLab.textContent = t('geoPinSep');
                var pinV = el('span', 'uria-geo-pinv');
                pinV.textContent = '~' + Math.round(locContext.pinSegmentM) + ' m';
                pinRow.appendChild(pinLab);
                pinRow.appendChild(pinV);
                g.appendChild(pinRow);
            }
            if (locContext.addrMismatch) g.appendChild(el('div', 'warn', t('geoMismatch')));
            if (locContext.textHeuristic) g.appendChild(el('div', 'warn', t('heuristicFromText')));
            if (locContext.osmEnriched) g.appendChild(el('div', 'ok', t('osmEnriched')));
            if (lastContext.detailsError) g.appendChild(el('div', 'warn', 'SDK-Details: ' + String(lastContext.detailsError)));
        }
        qAll('uria-geo').forEach(fillGeo);
        if (rrCached) {
            qAll('uria-rbadge').forEach(function (rb) { rb.textContent = rrCached.text; });
        } else {
            qAll('uria-rbadge').forEach(function (rb) { rb.textContent = ''; });
        }
    }

    function setHeader(ur) {
        var tTitle = t('title') + (lastUrId ? ' · ' + t('urActive') + ' ' + lastUrId : '');
        qAll('uria-titleline').forEach(function (tln) { tln.textContent = tTitle; });
        var subT;
        if (!ur && lastUrId) {
            subT = t('noSdkUr');
        } else {
            var f = ur ? extractUrFields(ur) : null;
            var sub = f && f.typeText ? String(f.typeText) : '';
            if (f && f.desc) {
                var d0 = String(f.desc).replace(/\s+/g, ' ').trim();
                if (d0.length > 90) d0 = d0.slice(0, 90) + '…';
                sub = (sub ? sub + ' — ' : '') + d0;
            }
            subT = sub || '';
        }
        qAll('uria-subline').forEach(function (el) { el.textContent = subT; });
    }

    function renderTips(ur) {
        qAll('uria-tips').forEach(function (tipsEl) {
            tipsEl.innerHTML = '';
            if (!ur) return;
            buildTips(ur).forEach(function (it) {
                var li = el('li');
                li.textContent = it.t;
                tipsEl.appendChild(li);
            });
            if (!tipsEl.children.length) {
                var li0 = el('li');
                li0.textContent = t('tip_lo');
                tipsEl.appendChild(li0);
            }
        });
    }

    function extractUrIdFromPanelEvent(detail) {
        if (detail == null) return null;
        if (typeof detail === 'number' && isFinite(detail)) return detail;
        if (typeof detail === 'string' && /^\d+$/.test(detail.trim())) return Number(detail);
        if (typeof detail !== 'object') return null;
        var keys = [
            'mapUpdateRequestId', 'updateRequestId', 'id', 'modelId', 'objectId',
            'featureId', 'urId', 'issueId', 'itemId',
        ];
        var k, v;
        for (k = 0; k < keys.length; k++) {
            v = detail[keys[k]];
            if (v != null && (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(String(v))))) {
                return Number(v);
            }
        }
        return null;
    }

    function scheduleRefresh() {
        if (refreshDebounceTimer) {
            try { clearTimeout(refreshDebounceTimer); } catch (e) { refreshDebounceTimer = null; }
        }
        refreshDebounceTimer = setTimeout(function () {
            refreshDebounceTimer = null;
            refresh();
        }, 32);
    }

    function refresh() {
        if (!sdk) return;
        var id = tryLegacyWmeSelectionUrId();
        if (id == null) {
            var sel = tryGetSelection(sdk);
            id = pickUrIdFromSelection(sdk, sel);
        }
        var source = 'selection';
        if (id != null) {
            lastContext.eventUrId = null;
            lastContext.eventUrAt = 0;
        } else if (lastContext.eventUrId != null) {
            var evAge = Date.now() - (lastContext.eventUrAt || 0);
            if (evAge >= 0 && evAge <= PANEL_UR_BRIDGE_MS) {
                id = lastContext.eventUrId;
                source = 'event';
            } else {
                lastContext.eventUrId = null;
                lastContext.eventUrAt = 0;
            }
        }
        if (id == null) {
            if (geocodeState.timer) {
                try { clearTimeout(geocodeState.timer); } catch (e) { }
                geocodeState.timer = null;
            }
            geocodeState.seq += 1;
            lastUrId = null;
            lastContext.ur = null;
            lastContext.details = null;
            lastContext.detailsError = null;
            lastContext.selectionSource = 'none';
            lastContext.eventUrId = null;
            lastContext.eventUrAt = 0;
            lastAutoSearchUrId = null;
            locContext = emptyLocContext();
            segPicker.ids = [];
            segPicker.index = 0;
            if (segPickerLabelEl) updateSegPickerUI();
            floatManuallyHidden = false;
            if (floatEl) {
                setFloatVisible(false);
                setLauncherVisible(settings.autoOpenOnUr === false);
            }
            qAll('uria-search').forEach(function (el) { el.value = ''; });
            if (SUR.t.root || SUR.f.root) renderEmptyState();
            return;
        }
        var isNewUr = (id !== lastUrId);
        var got = tryGetMapUpdateRequest(sdk, id);
        lastContext.ur = got.ur;
        lastContext.details = null;
        lastContext.detailsError = got.err;
        lastContext.selectionSource = source;
        lastUrId = id;
        if (isNewUr) floatManuallyHidden = false;
        if (lastContext.ur) {
            rebuildSegPicker(!isNewUr);
        } else {
            locContext = emptyLocContext();
            segPicker.ids = [];
            segPicker.index = 0;
            updateSegPickerUI();
        }
        if (!SUR.t.root && !SUR.f.root) return;
        if (floatEl) {
            if (settings.autoOpenOnUr !== false) {
                if (!floatManuallyHidden) {
                    setFloatVisible(true);
                    setLauncherVisible(false);
                } else {
                    setFloatVisible(false);
                    setLauncherVisible(true);
                }
            } else {
                setFloatVisible(false);
                setLauncherVisible(true);
            }
        }
        setHeader(lastContext.ur);
        updateGeo(lastContext.ur);
        renderChecklist(lastContext.ur);
        renderTips(lastContext.ur);
        renderSearchButtons();
        fillDefaultSearchText();
        if (isNewUr && settings.autoOpenSearch) {
            (function (snap) {
                setTimeout(function () {
                    if (lastUrId !== snap || !lastContext.ur) return;
                    if (lastAutoSearchUrId === snap) return;
                    lastAutoSearchUrId = snap;
                    doOneClickSearch();
                }, 500);
            }(id));
        }
        tryGetUpdateRequestDetails(sdk, id).then(function (res) {
            if (lastUrId !== id) return;
            lastContext.details = res.details;
            lastContext.detailsError = res.err;
            if (lastContext.ur) {
                rebuildSegPicker(true);
            }
            updateGeo(lastContext.ur);
            renderSearchButtons();
            fillDefaultSearchText();
            renderChecklist(lastContext.ur);
            renderTips(lastContext.ur);
        });
    }

    function onUpdateRequestPanelOpened(e) {
        var raw = e && (e.detail != null ? e.detail : e);
        var eid = extractUrIdFromPanelEvent(raw);
        if (eid != null) {
            lastContext.eventUrId = eid;
            lastContext.eventUrAt = Date.now();
        } else {
            lastContext.eventUrId = null;
            lastContext.eventUrAt = 0;
        }
        scheduleRefresh();
        setTimeout(function () { if (typeof sdk === 'object' && sdk) scheduleRefresh(); }, 90);
        setTimeout(function () { if (typeof sdk === 'object' && sdk) scheduleRefresh(); }, 280);
        setTimeout(function () { if (typeof sdk === 'object' && sdk) scheduleRefresh(); }, 500);
    }

    function wireEvents() {
        var onRef = function () { scheduleRefresh(); };
        try {
            sdk.Events.on({ eventName: 'wme-selection-changed', eventHandler: onRef });
        } catch (e) {}
        try {
            sdk.Events.on({ eventName: 'wme-feature-editor-opened', eventHandler: onRef });
        } catch (e) {}
        try {
            sdk.Events.on({
                eventName: 'wme-update-request-panel-opened',
                eventHandler: onUpdateRequestPanelOpened,
            });
        } catch (e) {}
        if (!nativeSelectionWired) {
            nativeSelectionWired = true;
            try {
                document.addEventListener('wme-selection-changed', onRef, false);
            } catch (e2) {}
            try {
                window.addEventListener('wme-selection-changed', onRef, false);
            } catch (e3) {}
            try {
                document.addEventListener('wme-update-request-panel-opened', onUpdateRequestPanelOpened, false);
            } catch (e4) {}
            try {
                window.addEventListener('wme-update-request-panel-opened', onUpdateRequestPanelOpened, false);
            } catch (e5) {}
        }
    }

    var initDone = false;
    function finishInitUi() {
        try {
            var tl = qId('uria-titleline');
            if (tl) titleLineEl = tl;
        } catch (e0) {}
        try { wireSearchBoxesSync(); } catch (eS) {}
        wireEvents();
        try {
            if (sdk.Events && typeof sdk.Events.once === 'function') {
                sdk.Events.once({ eventName: 'wme-ready' }).then(function () { scheduleRefresh(); });
            }
        } catch (e1) {}
        renderSearchButtons();
        refresh();
        initDone = true;
        initStarted = false;
    }

    function initAfterSdk() {
        if (initDone) return;
        if (initStarted) return;
        if (typeof window.getWmeSdk !== 'function') return;
        initStarted = true;
        try {
            sdk = window.getWmeSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME, version: String(VERSION) });
        } catch (e) {
            initStarted = false;
            return;
        }
        if (!sdk.Sidebar || typeof sdk.Sidebar.registerScriptTab !== 'function') {
            buildFloatUi();
            finishInitUi();
            return;
        }
        Promise.resolve(sdk.Sidebar.registerScriptTab()).then(function (sb) {
            scriptSidebarReg = sb;
            sb.tabLabel.textContent = 'UR';
            sb.tabLabel.title = SCRIPT_NAME;
            scriptTabPane = sb.tabPane;
            scriptTabPane.innerHTML = '';
            buildScriptMount(scriptTabPane);
            buildFloatUi();
            finishInitUi();
        }).catch(function () {
            scriptSidebarReg = null;
            buildFloatUi();
            finishInitUi();
        });
    }

    if (window.SDK_INITIALIZED && window.SDK_INITIALIZED.then) {
        window.SDK_INITIALIZED.then(initAfterSdk).catch(function () { initAfterSdk(); });
    } else {
        (function w(n) {
            n = n || 0;
            if (n > 200) { initAfterSdk(); return; }
            if (typeof window.getWmeSdk === 'function') { initAfterSdk(); return; }
            setTimeout(function () { w(n + 1); }, 100);
        }());
    }
    (function addWmeInitHook() {
        var fn = function () { setTimeout(initAfterSdk, 0); };
        if (window.addEventListener) window.addEventListener('wme-initialized', fn);
        if (document && document.addEventListener) {
            document.addEventListener('wme-initialized', fn);
        }
    }());
})();
