// ==UserScript==
// @name         WME Map Change Notebook
// @namespace    https://waze.com/editor
// @version      1.0.0
// @description  Private notebook for WME
// @author       kev (ogkm01)
// @match        https://www.waze.com/editor*
// @match        https://www.waze.com/*/editor*
// @match        https://beta.waze.com/editor*
// @match        https://beta.waze.com/*/editor*
// @exclude      https://www.waze.com/*/user/*
// @exclude      https://beta.waze.com/*/user/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    if (/\/user\//.test(location.pathname)) return;

    var SCRIPT_ID   = 'jack-wme-map-change-notebook';
    var SCRIPT_NAME = 'WME Map Change Notebook';
    var VERSION     = '1.0.0';
    var LS          = 'wme-mcn:';
    var JUMP_ZOOM   = 17;

    var STATUS = ['open', 'reviewed', 'done', 'waiting_feedback', 'later'];

    var NOTE_COLOR_HEX = {
        default:'#78716c', red:'#b91c1c', orange:'#c2410c', yellow:'#d97706',
        green:'#15803d',   blue:'#1d4ed8', purple:'#7c3aed', pink:'#be185d',
    };

    var I18N = {
        en: {
            tabCreate:'Create', tabNotes:'Notes', tabEdit:'Edit', tabSettings:'Settings',
            editEmpty:'No note selected for editing.',
            objTitle:'Current Object', noObj:'No object selected.',
            noteTitle:'Title', noteText:'Note', tags:'Tags (comma-separated)',
            alarm:'Reminder (optional)', color:'Color', status:'Status',
            save:'Save', refresh:'Reload', deleteObj:'Delete object notes',
            searchPh:'Search...', filterAlarm:'With alarm only',
            edit:'Edit', jump:'Go to object', del:'Delete', cancel:'Cancel', update:'Update',
            exportBtn:'Export JSON', importBtn:'Import JSON',
            noNotes:'No notes.', noMatches:'No results.',
            confirmDel:'Delete note?', confirmDelObj:'Delete all notes for this object?',
            alarmDue:'Reminder', alarmMissed:'Missed / overdue',
            snooze:'+15 min', done:'Done',
            language:'Language', theme:'Theme', uiMode:'Display mode',
            uiModeFloat:'Floating (emoji button)', uiModeSidebar:'WME Script-Tab (no emoji)',
            resetPos:'Reset position', compactMode:'Compact mode',
            status_open:'Open', status_reviewed:'Reviewed', status_done:'Done',
            status_waiting_feedback:'Feedback pending', status_later:'Later',
            type_all:'All types', type_segment:'Segment', type_place:'Place',
            type_houseNumber:'House number', type_navPoint:'NavPoint',
            type_ur:'UR', type_unknown:'Unknown',
            color_all:'All colors', color_default:'Default', color_red:'Red',
            color_orange:'Orange', color_yellow:'Yellow', color_green:'Green',
            color_blue:'Blue', color_purple:'Purple', color_pink:'Pink',
            theme_dark:'Dark', theme_black:'Black', theme_gray:'Gray',
            theme_light:'Light', theme_warm:'Warm',
            goToMap:'Go to map',
            sortNewest:'Newest first', sortOldest:'Oldest first', sortColor:'By color',
            sortStatus:'By status', sortAlpha:'A → Z', sortCustom:'Custom (drag)',
            footer:'Made with ❤️ by Kevin (Ogkm01)',
        },
        de: {
            tabCreate:'Erstellen', tabNotes:'Notizen', tabEdit:'Bearbeiten', tabSettings:'Einstellungen',
            editEmpty:'Kein Eintrag zum Bearbeiten ausgewählt.',
            objTitle:'Aktuelles Objekt', noObj:'Kein Objekt ausgewählt.',
            noteTitle:'Titel', noteText:'Notiz', tags:'Tags (kommagetrennt)',
            alarm:'Erinnerung (optional)', color:'Farbe', status:'Status',
            save:'Speichern', refresh:'Neu laden', deleteObj:'Objekt-Notizen löschen',
            searchPh:'Suchen...', filterAlarm:'Nur mit Alarm',
            edit:'Bearbeiten', jump:'Zum Objekt', del:'Löschen', cancel:'Abbrechen', update:'Update',
            exportBtn:'Export JSON', importBtn:'Import JSON',
            noNotes:'Keine Notizen.', noMatches:'Keine Treffer.',
            confirmDel:'Notiz löschen?', confirmDelObj:'Alle Notizen für dieses Objekt löschen?',
            alarmDue:'Erinnerung', alarmMissed:'Verpasst / Nachtrag',
            snooze:'+15 min', done:'Erledigt',
            language:'Sprache', theme:'Design', uiMode:'Anzeigemodus',
            uiModeFloat:'Floating (Emoji-Button)', uiModeSidebar:'WME Script-Tab (kein Emoji)',
            resetPos:'Position zurücksetzen', compactMode:'Kompaktmodus',
            status_open:'Offen', status_reviewed:'Geprüft', status_done:'Erledigt',
            status_waiting_feedback:'Rückmeldung', status_later:'Später',
            type_all:'Alle Typen', type_segment:'Segment', type_place:'Place',
            type_houseNumber:'Hausnummer', type_navPoint:'NavPoint',
            type_ur:'UR', type_unknown:'Unbekannt',
            color_all:'Alle Farben', color_default:'Standard', color_red:'Rot',
            color_orange:'Orange', color_yellow:'Gelb', color_green:'Grün',
            color_blue:'Blau', color_purple:'Lila', color_pink:'Pink',
            theme_dark:'Dunkel', theme_black:'Schwarz', theme_gray:'Grau',
            theme_light:'Hell', theme_warm:'Warm',
            goToMap:'Zur Karte',
            sortNewest:'Neueste zuerst', sortOldest:'Älteste zuerst', sortColor:'Nach Farbe',
            sortStatus:'Nach Status', sortAlpha:'A → Z', sortCustom:'Benutzerdefiniert (Drag)',
            footer:'Made with ❤️ by Kevin (Ogkm01)',
        },
        fr: {
            tabCreate:'Créer', tabNotes:'Notes', tabEdit:'Modifier', tabSettings:'Paramètres',
            editEmpty:'Aucune note sélectionnée.',
            objTitle:'Objet actuel', noObj:'Aucun objet sélectionné.',
            noteTitle:'Titre', noteText:'Note', tags:'Tags (virgule)',
            alarm:'Rappel (optionnel)', color:'Couleur', status:'Statut',
            save:'Enregistrer', refresh:'Recharger', deleteObj:'Suppr. notes objet',
            searchPh:'Rechercher...', filterAlarm:'Avec alarme seulement',
            edit:'Modifier', jump:"Aller à l'objet", del:'Supprimer',
            cancel:'Annuler', update:'Mettre à jour',
            exportBtn:'Export JSON', importBtn:'Import JSON',
            noNotes:'Aucune note.', noMatches:'Aucun résultat.',
            confirmDel:'Supprimer la note ?', confirmDelObj:"Supprimer toutes les notes ?",
            alarmDue:'Rappel', alarmMissed:'Manqué / en retard',
            snooze:'+15 min', done:'Terminé',
            language:'Langue', theme:'Thème', uiMode:"Mode d'affichage",
            uiModeFloat:"Flottant (bouton emoji)", uiModeSidebar:'Script-Tab WME (sans emoji)',
            resetPos:'Réinitialiser la position', compactMode:'Mode compact',
            status_open:'Ouvert', status_reviewed:'Examiné', status_done:'Terminé',
            status_waiting_feedback:'Retour en attente', status_later:'Plus tard',
            type_all:'Tous les types', type_segment:'Segment', type_place:'Place',
            type_houseNumber:'Numéro', type_navPoint:'NavPoint',
            type_ur:'UR', type_unknown:'Inconnu',
            color_all:'Toutes', color_default:'Défaut', color_red:'Rouge',
            color_orange:'Orange', color_yellow:'Jaune', color_green:'Vert',
            color_blue:'Bleu', color_purple:'Violet', color_pink:'Rose',
            theme_dark:'Sombre', theme_black:'Noir', theme_gray:'Gris',
            theme_light:'Clair', theme_warm:'Chaud',
            goToMap:'Aller à la carte',
            sortNewest:'Plus récent', sortOldest:'Plus ancien', sortColor:'Par couleur',
            sortStatus:'Par statut', sortAlpha:'A → Z', sortCustom:'Personnalisé (glisser)',
            footer:'Made with ❤️ by Kevin (Ogkm01)',
        },
    };

    function t(k) {
        var lang = settings && settings.language;
        var L = I18N[lang] || I18N.en;
        return (L && L[k]) || I18N.en[k] || k;
    }

    var THEMES = {
        dark: {
            panelBg:'linear-gradient(165deg,#1c1917,#100e0c)', panelBorder:'#44403c', panelColor:'#e7e5e4',
            hdrBg:'repeating-linear-gradient(-45deg,#1c1917,#1c1917 5px,#232018 5px,#232018 6px)',
            hdrBorder:'#57534e', inputBg:'#252120', inputBorder:'#57534e', inputColor:'#fafaf9',
            btnBg:'#3f3a36', btnBorder:'#78716c', btnColor:'#e7e5e4',
            noteHover:'#d97706', metaColor:'#a8a29e', labColor:'#a8a29e',
            tabActiveBg:'#3f3a36', scrollThumb:'#57534e',
        },
        black: {
            panelBg:'#000', panelBorder:'#333', panelColor:'#e2e8f0',
            hdrBg:'#0a0a0a', hdrBorder:'#222', inputBg:'#111', inputBorder:'#333', inputColor:'#f0f0f0',
            btnBg:'#1a1a1a', btnBorder:'#444', btnColor:'#e2e8f0',
            noteHover:'#3b82f6', metaColor:'#888', labColor:'#777',
            tabActiveBg:'#1a1a1a', scrollThumb:'#333',
        },
        gray: {
            panelBg:'linear-gradient(165deg,#374151,#1f2937)', panelBorder:'#4b5563', panelColor:'#f9fafb',
            hdrBg:'#1f2937', hdrBorder:'#374151', inputBg:'#374151', inputBorder:'#4b5563', inputColor:'#f9fafb',
            btnBg:'#4b5563', btnBorder:'#6b7280', btnColor:'#f9fafb',
            noteHover:'#60a5fa', metaColor:'#9ca3af', labColor:'#9ca3af',
            tabActiveBg:'#4b5563', scrollThumb:'#4b5563',
        },
        light: {
            panelBg:'#f8fafc', panelBorder:'#cbd5e1', panelColor:'#0f172a',
            hdrBg:'#f1f5f9', hdrBorder:'#e2e8f0', inputBg:'#fff', inputBorder:'#cbd5e1', inputColor:'#0f172a',
            btnBg:'#e2e8f0', btnBorder:'#94a3b8', btnColor:'#0f172a',
            noteHover:'#2563eb', metaColor:'#64748b', labColor:'#64748b',
            tabActiveBg:'#e2e8f0', scrollThumb:'#cbd5e1',
        },
        warm: {
            panelBg:'linear-gradient(165deg,#292524,#1c1917)', panelBorder:'#9a3412', panelColor:'#fef3c7',
            hdrBg:'#1c1917', hdrBorder:'#9a3412', inputBg:'#292524', inputBorder:'#9a3412', inputColor:'#fef3c7',
            btnBg:'#3d1d0d', btnBorder:'#9a3412', btnColor:'#fed7aa',
            noteHover:'#ea580c', metaColor:'#d97706', labColor:'#b45309',
            tabActiveBg:'#3d1d0d', scrollThumb:'#9a3412',
        },
    };

    function th() { return THEMES[settings.theme] || THEMES.dark; }

    //storage stuff

    function tryParse(s) {
        if (!s) return null;
        try { return JSON.parse(s); } catch (e) { return null; }
    }
    function readJson(key, fallback) {
        var v = tryParse((function () { try { return localStorage.getItem(LS + key); } catch (e) { return null; } }()));
        return v != null ? v : fallback;
    }
    function writeJson(key, val) {
        try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch (e) {}
    }
    function saveAll() {
        var now = Date.now();
        db._t = now; settings._t = now;
        writeJson('db', db);
        writeJson('settings', settings);
    }

    //data structures

    function defaultDb() {
        return { notes: [], lastTouched: [], nextId: 1, _t: 0 };
    }
    function defaultSettings() {
        return {
            language: 'en', theme: 'dark', uiMode: 'float', compact: false, collapsed: false,
            ui: { x: 16, y: 84, w: 380, h: 580 },
            filters: { type: 'all', status: 'all', color: 'all', q: '', alarmOnly: false },
            sortMode: 'newest',
            lastVisitAt: null, _t: 0,
        };
    }

    //states

    var sdk             = null;
    var sdkReady        = false;
    var ready           = false;
    var selected        = null;
    var noteEditId      = null;
    var editNoteColor   = 'default';
    var quickNoteColor  = 'default';
    var activeTab       = 'create';
    var sidebarTabPane  = null;
    var sdkTabRegistered = false;
    var alarmTimer      = null;
    var alarmWired      = false;
    var currentAlarmStack = [];
    var currentAlarmIdx = 0;
    var prevVisitAt     = null;
    var expandedCards   = {};   //note ids that are expanded in card view

    //draft persists while switching tabs
    var quickDraft = { title: '', text: '', tags: '', status: 'open', color: 'default', alarmAt: '' };

    var db       = readJson('db', defaultDb());
    var settings = Object.assign(defaultSettings(), readJson('settings', {}));
    if (!settings.ui)      settings.ui      = defaultSettings().ui;
    if (!settings.filters) settings.filters = defaultSettings().filters;
    if (!settings.sortMode) settings.sortMode = 'newest';

    var _drag   = { on: false, x: 0, y: 0, ox: 0, oy: 0 };
    var _bdrag  = { on: false, x: 0, y: 0, ox: 0, oy: 0, sx: 0, sy: 0 };
    var _resize = { on: false, x: 0, y: 0, ow: 0, oh: 0 };

    //helpers

    function log() {
        try { console.log.apply(console, ['[MCN]'].concat(Array.prototype.slice.call(arguments))); } catch (e) {}
    }
    function nowIso()   { return new Date().toISOString(); }
    function uid()      { var id = Number(db.nextId) || 1; db.nextId = id + 1; return String(id); }
    function byId(id)   { return document.getElementById(id); }
    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function debounce(fn, ms) {
        var t = null;
        return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
    }
    function isoToLocal(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        var p = function (n) { return n < 10 ? '0' + n : String(n); };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function localToIso(s) {
        if (!s || !String(s).trim()) return null;
        var d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    function fmtDate(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
    }
    function statusLabel(k) { return t('status_' + k) || k; }
    function typeLabel(k)   { return t('type_' + k) || k; }

    //map helpers

    function getMapCenter() {
        try { if (sdk && sdk.Map) { var c = sdk.Map.getMapCenter(); if (c && c.lat != null) return { lat: +c.lat, lon: +c.lon }; } } catch (e) {}
        try { var ll = window.W && W.map && W.map.getCenter && W.map.getCenter(); if (ll && ll.lat != null) return { lat: +ll.lat, lon: +ll.lon }; } catch (e) {}
        return null;
    }
    function getMapZoom() {
        try { if (sdk && sdk.Map) return Number(sdk.Map.getZoomLevel()) || null; } catch (e) {}
        try { return Number(window.W && W.map && W.map.getZoom && W.map.getZoom()) || null; } catch (e) {}
        return null;
    }
    function makeBookmark(anchor) {
        var a = anchor || getMapCenter();
        if (!a) return null;
        var z = getMapZoom();
        var out = { lat: +a.lat, lon: +a.lon, zoom: z };
        try { out.url = location.origin + location.pathname + '?lat=' + a.lat + '&lon=' + a.lon + (z ? '&zoomLevel=' + z : ''); } catch (e) {}
        return out;
    }

    //SDK geometry to SDK center to OpenLayers fallback
    function sdkCenterOnGeometry(g) {
        if (!sdk || !sdk.Map || !g) return false;
        try { sdk.Map.centerMapOnGeometry({ geometry: g }); try { sdk.Map.setZoomLevel({ zoomLevel: JUMP_ZOOM }); } catch (e) {} return true; } catch (e) {}
        return false;
    }
    function sdkMapCenter(lat, lon, zoom) {
        if (!sdk || !sdk.Map) return false;
        try { sdk.Map.setMapCenter({ lonLat: { lon: +lon, lat: +lat }, zoomLevel: zoom || JUMP_ZOOM }); return true; } catch (e) {}
        return false;
    }
    function olMapCenter(lat, lon, zoom) {
        var la = parseFloat(String(lat).replace(/,/g, '.')), lo = parseFloat(String(lon).replace(/,/g, '.'));
        if (!isFinite(la) || !isFinite(lo)) return false;
        var z = zoom || JUMP_ZOOM, map = window.W && W.map;
        if (!map) return false;
        try { var proj = map.getProjectionObject && map.getProjectionObject(); if (window.OpenLayers && window.PROJ_4326 && proj) { map.setCenter(new OpenLayers.LonLat(lo, la).transform(PROJ_4326, proj), z); return true; } } catch (e) {}
        try { map.setCenter(new OpenLayers.LonLat(lo, la).transform(window.PROJ_4326, window.PROJ_900913), z); return true; } catch (e) {}
        return false;
    }
    function getSegGeoJson(id) {
        try {
            var s = window.W && W.model && W.model.segments && W.model.segments.getObjectById(id);
            if (!s) return null;
            if (W.userscripts && W.userscripts.toGeoJSONGeometry && s.geometry)
                return W.userscripts.toGeoJSONGeometry(s.geometry);
        } catch (e) {}
        return null;
    }
    function sdkSelectObj(type, id) {
        var map = { segment: 'segment', place: 'venue', houseNumber: 'houseNumber', navPoint: 'navPoint', ur: 'mapUpdateRequest' };
        var ot = map[type];
        if (!ot || !sdk || !sdk.Editing || id == null) return false;
        try { sdk.Editing.setSelection({ selection: { objectType: ot, ids: [String(id)] } }); return true; } catch (e) { return false; }
    }
    function legacySelectSeg(id) {
        try {
            var s = window.W && W.model && W.model.segments && W.model.segments.getObjectById(Number(id));
            if (!s || !W.selectionManager) return;
            try { W.selectionManager.setSelectedModels([s]); } catch (e) {}
            try { W.selectionManager.setSelectedDataModelObjects([s]); } catch (e) {}
        } catch (e) {}
    }
    function jumpToNote(n) {
        if (!n) return;
        var ref = n.bookmark || n.anchor;
        if (ref && isFinite(+ref.lat) && isFinite(+ref.lon)) {
            if (n.objectType === 'segment' && n.objectId) {
                var geo = getSegGeoJson(Number(n.objectId));
                if (!sdkCenterOnGeometry(geo)) {
                    if (!sdkMapCenter(ref.lat, ref.lon, ref.zoom)) olMapCenter(ref.lat, ref.lon, ref.zoom);
                }
            } else {
                if (!sdkMapCenter(ref.lat, ref.lon, ref.zoom)) olMapCenter(ref.lat, ref.lon, ref.zoom);
            }
        }
        if (n.objectId != null && n.objectType !== 'unknown') {
            sdkSelectObj(n.objectType, n.objectId);
            if (n.objectType === 'segment') {
                // retry a couple of times since WME selection is async
                setTimeout(function () { legacySelectSeg(n.objectId); }, 0);
                setTimeout(function () { legacySelectSeg(n.objectId); }, 150);
                setTimeout(function () { legacySelectSeg(n.objectId); }, 350);
            }
        }
        //set selected instant so the notes list doesnt flash empty
        selected = {
            type: n.objectType, id: String(n.objectId || ''),
            key: n.objectKey || (n.objectType + ':' + n.objectId),
            title: n.objectTitle || (typeLabel(n.objectType) + ' #' + n.objectId),
            anchor: n.anchor || null,
        };
        refreshAll();
    }

    //selection reading

    function normalizeType(raw) {
        var s = String(raw || '').toLowerCase();
        if (/segment/.test(s))             return 'segment';
        if (/venue|place/.test(s))         return 'place';
        if (/housenumber/.test(s))         return 'houseNumber';
        if (/navpoint/.test(s))            return 'navPoint';
        if (/mapupdate|updaterequest|ur/.test(s)) return 'ur';
        return 'unknown';
    }
    function textFromAny(v) {
        if (!v) return '';
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'number') return String(v);
        var keys = ['name', 'title', 'text', 'streetName', 'cityName', 'id'];
        for (var i = 0; i < keys.length; i++) { var r = textFromAny(v[keys[i]]); if (r) return r; }
        return '';
    }
    //returns {lat, lon} only if both values are normal numbers, otherwise null
    function validAnchor(lat, lon) {
        var la = +lat, lo = +lon;
        return (isFinite(la) && isFinite(lo)) ? { lat: la, lon: lo } : null;
    }
    function anchorFrom(obj) {
        if (!obj) return null;
        var g = obj.geometry || (obj.attributes && obj.attributes.geometry);
        try {
            if (g && g.lat != null) return validAnchor(g.lat, g.lon);
            if (g && Array.isArray(g.coordinates) && g.coordinates.length) {
                if (typeof g.coordinates[0] === 'number') return validAnchor(g.coordinates[1], g.coordinates[0]);
                var mid = g.coordinates[Math.floor(g.coordinates.length / 2)];
                if (Array.isArray(mid)) return validAnchor(mid[1], mid[0]);
            }
            //openlayers geometry fallback
            if (g && typeof g.getCentroid === 'function') {
                var c = g.getCentroid();
                if (c && W && W.userscripts && W.userscripts.toGeoJSONGeometry) {
                    var gj = W.userscripts.toGeoJSONGeometry(g);
                    if (gj && gj.coordinates) {
                        var coords = gj.coordinates;
                        if (typeof coords[0] === 'number') return validAnchor(coords[1], coords[0]);
                        var m2 = coords[Math.floor(coords.length / 2)];
                        if (Array.isArray(m2)) return validAnchor(m2[1], m2[0]);
                    }
                }
            }
        } catch (e) {}
        return null;
    }
    function buildSel(f) {
        if (!f) return null;
        var m   = f.model || f.attributes || f;
        var id  = f.id != null ? f.id : (m && m.id != null ? m.id : null);
        var tr  = (f.typeName || f.type || f.modelType || f.featureType) || (m && (m.typeName || m.type || m.modelType || m.featureType));
        var type = normalizeType(tr);
        if ((id == null || type === 'unknown') && window.__mcnLastUrId != null) { id = window.__mcnLastUrId; type = 'ur'; }
        if (id == null) return null;
        return {
            type: type, id: String(id), key: type + ':' + id,
            title: textFromAny(m && (m.name || m.title || m.streetName || m.description || m.reason)) || (typeLabel(type) + ' #' + id),
            anchor: anchorFrom(f) || anchorFrom(m) || getMapCenter(),
        };
    }
    function pickSelection() {
        if (sdk && sdk.Editing) {
            ['getSelectedFeatures', 'getSelection', 'getCurrentSelection', 'getSelected'].forEach(function (fn) {
                if (selected) return;
                try {
                    if (typeof sdk.Editing[fn] !== 'function') return;
                    var r = sdk.Editing[fn]();
                    if (!r) return;
                    var arr = Array.isArray(r) ? r : (r.features || r.objects || [r]);
                    if (arr.length) { var p = buildSel(arr[0]); if (p) selected = p; }
                } catch (e) {}
            });
            if (selected) return;
        }
        try {
            var sm = window.W && W.selectionManager;
            if (!sm) return;
            var arr = (sm.getSelectedFeatures && sm.getSelectedFeatures()) || (sm.getSelectedDataModelObjects && sm.getSelectedDataModelObjects()) || [];
            if (arr.length) { var p = buildSel(arr[0]); if (p) selected = p; }
        } catch (e) {}
    }

    //db

    function addLastTouched(key) {
        db.lastTouched = [key].concat((db.lastTouched || []).filter(function (k) { return k !== key; })).slice(0, 30);
    }
    function upsertNote(payload) {
        var id = payload.id || uid(), now = nowIso();
        var idx = db.notes.findIndex(function (n) { return n.id === id; });
        if (idx >= 0) {
            db.notes[idx] = Object.assign({}, db.notes[idx], payload, { id: id, updatedAt: now });
        } else {
            db.notes.push(Object.assign({
                id: id, createdAt: now, updatedAt: now,
                title: '', text: '', status: 'open', tags: [], color: 'default',
                objectType: 'unknown', objectId: '', objectKey: '', objectTitle: '',
                anchor: null, alarmAt: null, alarmAck: false,
            }, payload, { id: id, createdAt: now, updatedAt: now }));
        }
        addLastTouched(payload.objectKey || '');
        saveAll();
    }
    function deleteNote(id) {
        db.notes = db.notes.filter(function (n) { return n.id !== id; });
        saveAll();
    }
    function notesForCurrent() {
        if (!selected) return [];
        return db.notes.filter(function (n) { return n.objectKey === selected.key; })
            .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    }
    function parseTags(s) {
        return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20);
    }
    function tagsStr(tags) { return (tags || []).join(', '); }
    var COLOR_SORT_ORDER = ['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

    function applyFilters(arr) {
        var f = settings.filters || {};
        var q = String(f.q || '').toLowerCase();
        var filtered = arr.filter(function (n) {
            if (f.type && f.type !== 'all' && n.objectType !== f.type) return false;
            if (f.status && f.status !== 'all' && n.status !== f.status) return false;
            if (f.color && f.color !== 'all' && (n.color || 'default') !== f.color) return false;
            if (f.alarmOnly && !n.alarmAt) return false;
            if (q && ![n.title, n.text, n.objectTitle, n.objectType, n.objectId, (n.tags || []).join(' ')].join(' ').toLowerCase().includes(q)) return false;
            return true;
        });

        var mode = settings.sortMode || 'newest';
        if (mode === 'newest') {
            filtered.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
        } else if (mode === 'oldest') {
            filtered.sort(function (a, b) { return String(a.updatedAt).localeCompare(String(b.updatedAt)); });
        } else if (mode === 'color') {
            filtered.sort(function (a, b) {
                return COLOR_SORT_ORDER.indexOf(a.color || 'default') - COLOR_SORT_ORDER.indexOf(b.color || 'default');
            });
        } else if (mode === 'status') {
            filtered.sort(function (a, b) { return STATUS.indexOf(a.status) - STATUS.indexOf(b.status); });
        } else if (mode === 'alpha') {
            filtered.sort(function (a, b) { return String(a.title || '').localeCompare(String(b.title || '')); });
        } else if (mode === 'custom') {
            var order = db.customOrder || [];
            filtered.sort(function (a, b) {
                var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
                if (ia === -1 && ib === -1) return 0;
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
        }
        return filtered;
    }
    function saveCustomOrder(orderedIds) {
        db.customOrder = orderedIds;
        saveAll();
    }

    //export import stuff

    function exportJson() {
        var text = JSON.stringify({ meta: { script: SCRIPT_NAME, version: VERSION, exportedAt: nowIso() }, notes: db.notes }, null, 2);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = 'wme-notebook-export.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 2000);
    }
    function importJsonText(text) {
        try {
            var o = JSON.parse(text), arr = Array.isArray(o) ? o : (o && o.notes);
            if (!Array.isArray(arr)) throw new Error('Invalid format');
            var count = 0;
            arr.forEach(function (n) {
                if (!n || !n.objectKey) return;
                var p = Object.assign({}, n);
                if (!p.id) p.id = uid();
                p.tags   = Array.isArray(p.tags) ? p.tags : parseTags(p.tags);
                p.status = STATUS.indexOf(p.status) >= 0 ? p.status : 'open';
                upsertNote(p); count++;
            });
            refreshAll();
            alert(count + ' notes imported.');
        } catch (e) { alert('Import failed: ' + (e && e.message || e)); }
    }

    //reminders/alarmsssss

    function getDueAlarms() {
        var now = Date.now();
        return (db.notes || []).filter(function (n) {
            if (!n || !n.alarmAt || n.alarmAck) return false;
            var t2 = new Date(n.alarmAt).getTime();
            return isFinite(t2) && t2 <= now;
        }).sort(function (a, b) { return String(a.alarmAt).localeCompare(String(b.alarmAt)); });
    }
    function isMissed(n) {
        if (!prevVisitAt || !n || !n.alarmAt) return false;
        var pv = new Date(prevVisitAt).getTime(), due = new Date(n.alarmAt).getTime();
        return isFinite(pv) && isFinite(due) && pv < due;
    }
    function alarmBtnStyle(primary) {
        return 'font:600 12px system-ui;border:1px solid ' + (primary ? '#1c1917' : '#7c2d12') + ';'
            + 'background:' + (primary ? '#1c1917' : '#ffedd5') + ';color:' + (primary ? '#fef3c7' : '#6b220d') + ';'
            + 'border-radius:5px;padding:7px 14px;cursor:pointer';
    }
    function buildAlarmDom() {
        if (byId('mcn-alarm-root')) return;
        var d = document.createElement('div');
        d.id = 'mcn-alarm-root';
        d.style.cssText = 'position:fixed;inset:0;z-index:2005000;display:none;font-family:system-ui,sans-serif';
        d.innerHTML = '<div id="mcn-adim" style="position:absolute;inset:0;background:rgba(0,0,0,.65)"></div>'
            + '<div id="mcn-aslab" style="position:absolute;left:50%;top:14%;transform:translateX(-50%);width:min(420px,93vw);'
            + 'background:linear-gradient(180deg,#faf5eb,#e8e0d2);border:1px solid #8c4a21;border-left:6px solid #b45309;'
            + 'box-shadow:0 20px 50px rgba(0,0,0,.5);padding:18px 20px 16px;border-radius:4px">'
            + '<div id="mcn-akicker" style="font:800 9px monospace;letter-spacing:.14em;text-transform:uppercase;color:#9a3412"></div>'
            + '<div id="mcn-ah"    style="font:700 19px/1.25 Georgia,serif;margin:8px 0 3px;color:#1c1917"></div>'
            + '<div id="mcn-asub"  style="font:12px system-ui;color:#57534e;margin-bottom:6px"></div>'
            + '<div id="mcn-abody" style="max-height:100px;overflow:auto;font:13px system-ui;color:#1c1917;white-space:pre-wrap"></div>'
            + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'
            + '<button id="mcn-azum"    style="' + alarmBtnStyle(false) + '">📍 ' + t('jump') + '</button>'
            + '<button id="mcn-asnooze" style="' + alarmBtnStyle(false) + '">⏰ ' + t('snooze') + '</button>'
            + '<button id="mcn-aok"     style="' + alarmBtnStyle(true)  + '">✔ ' + t('done')   + '</button>'
            + '</div></div>';
        document.body.appendChild(d);
    }
    function showAlarm() {
        buildAlarmDom();
        if (!currentAlarmStack.length) {
            var r = byId('mcn-alarm-root'); if (r) r.style.display = 'none'; return;
        }
        var n = currentAlarmStack[currentAlarmIdx];
        if (!n) { currentAlarmStack = []; currentAlarmIdx = 0; showAlarm(); return; }
        byId('mcn-akicker').textContent = isMissed(n) ? t('alarmMissed') : t('alarmDue');
        byId('mcn-ah').textContent      = n.title || '(untitled)';
        byId('mcn-asub').textContent    = fmtDate(n.alarmAt) + (n.objectId ? ' · ' + typeLabel(n.objectType) + ' ' + n.objectId : '');
        byId('mcn-abody').textContent   = n.text || '';
        byId('mcn-alarm-root').style.display = 'block';
    }
    function ackAlarm() {
        var n = currentAlarmStack[currentAlarmIdx]; if (!n) return;
        upsertNote({ id: n.id, alarmAck: true });
        currentAlarmStack.splice(currentAlarmIdx, 1);
        if (currentAlarmIdx >= currentAlarmStack.length) currentAlarmIdx = 0;
        showAlarm(); refreshAll();
    }
    function snoozeAlarm(mins) {
        var n = currentAlarmStack[currentAlarmIdx]; if (!n) return;
        var t2 = new Date(); t2.setMinutes(t2.getMinutes() + (mins || 15));
        upsertNote({ id: n.id, alarmAt: t2.toISOString(), alarmAck: false });
        currentAlarmStack.splice(currentAlarmIdx, 1);
        if (currentAlarmIdx >= currentAlarmStack.length) currentAlarmIdx = 0;
        showAlarm(); refreshAll();
    }
    function wireAlarmBtns() {
        buildAlarmDom();
        if (alarmWired) return;
        alarmWired = true;
        byId('mcn-aok').addEventListener('click',     function () { ackAlarm(); });
        byId('mcn-asnooze').addEventListener('click', function () { snoozeAlarm(15); });
        byId('mcn-azum').addEventListener('click',    function () { var n = currentAlarmStack[currentAlarmIdx]; if (n) jumpToNote(n); });
    }
    function checkAlarms() {
        if (!ready) return;
        var due = getDueAlarms();
        if (!due.length) return;
        if (byId('mcn-alarm-root') && byId('mcn-alarm-root').style.display === 'block') return;
        currentAlarmStack = due; currentAlarmIdx = 0; showAlarm();
    }
//we love css
    function buildCss() {
        var T = th();
        return [
            '#mcn-panel{position:fixed;z-index:2002010;overflow:hidden;background:' + T.panelBg + ';color:' + T.panelColor + ';',
            'border:1px solid ' + T.panelBorder + ';border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.55);',
            'font:12px/1.45 "Segoe UI",system-ui,sans-serif;}',
            '#mcn-inner{height:100%;display:flex;flex-direction:column;overflow:hidden;}',
            '#mcn-btn{position:fixed;z-index:2002020;width:36px;height:36px;border-radius:10px;',
            'border:1px solid ' + T.panelBorder + ';background:' + T.btnBg + ';color:' + T.btnColor + ';',
            'font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.45);}',
            '#mcn-btn:hover{filter:brightness(1.1);}',
            '#mcn-hdr{display:flex;align-items:center;gap:8px;padding:9px 12px;background:' + T.hdrBg + ';',
            'border-bottom:1px solid ' + T.hdrBorder + ';cursor:move;user-select:none;}',
            '#mcn-hdr-title{font:700 11px system-ui;letter-spacing:.07em;text-transform:uppercase;color:' + T.metaColor + ';flex:1;}',
            '#mcn-hdr,#mcn-tabs,#mcn-footer{flex-shrink:0;}',
            '#mcn-tabs{display:flex;border-bottom:1px solid ' + T.hdrBorder + ';background:' + T.hdrBg + ';}',
            '.mcn-tab{flex:1;padding:7px 2px;font:600 11px system-ui;cursor:pointer;border:none;',
            'background:transparent;color:' + T.metaColor + ';border-bottom:2px solid transparent;}',
            '.mcn-tab.active{color:' + T.panelColor + ';border-bottom-color:' + T.noteHover + ';background:' + T.tabActiveBg + ';}',
            '.mcn-tab:hover{background:' + T.tabActiveBg + ';}',
            '#mcn-body{flex:1;overflow:auto;padding:10px 12px;min-height:0;}',
            '#mcn-body::-webkit-scrollbar{width:5px;}',
            '#mcn-body::-webkit-scrollbar-thumb{background:' + T.scrollThumb + ';border-radius:5px;}',
            '.mcn-sec{margin:0 0 10px;}',
            '.mcn-lab{font:700 9px system-ui;letter-spacing:.1em;text-transform:uppercase;color:' + T.labColor + ';margin:0 0 4px;display:block;}',
            '.mcn-row{display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap;}',
            '.mcn-grow{flex:1;min-width:0;}',
            '.mcn-input,.mcn-area,.mcn-sel{width:100%;box-sizing:border-box;border:1px solid ' + T.inputBorder + ';',
            'background:' + T.inputBg + ';color:' + T.inputColor + ';border-radius:8px;padding:6px 8px;font:12px system-ui;}',
            '.mcn-input:focus,.mcn-area:focus,.mcn-sel:focus{outline:none;border-color:' + T.noteHover + ';box-shadow:0 0 0 2px ' + T.noteHover + '33;}',
            '.mcn-area{min-height:60px;resize:vertical;}',
            '.mcn-btn{border:1px solid ' + T.btnBorder + ';background:' + T.btnBg + ';color:' + T.btnColor + ';',
            'border-radius:8px;padding:5px 10px;font:600 11px system-ui;cursor:pointer;white-space:nowrap;}',
            '.mcn-btn:hover{filter:brightness(1.1);}',
            '.mcn-btn.pri{background:linear-gradient(160deg,#ea580c,#b83809);border-color:#9a3412;color:#fff8f0;}',
            '.mcn-btn.dan{background:#7f1d1d;border-color:#991b1b;color:#fecaca;}',
            '.mcn-note{border-radius:10px;padding:9px 11px;margin:6px 0;transition:border-color .12s,box-shadow .12s;}',
            '.mcn-note:hover{box-shadow:0 0 0 2px ' + T.noteHover + '55;}',
            '.mcn-note h4{margin:0 0 3px;font:700 12px/1.3 system-ui;}',
            '.mcn-note .meta{font:11px/1.4 system-ui;opacity:.75;margin:2px 0;}',
            '.mcn-note .alarm-badge{color:#fbbf24!important;opacity:1!important;}',
            '.mcn-note .bm-line{color:#fb923c;font:11px system-ui;}',
            '.mcn-note .tag-line{font:11px system-ui;opacity:.65;}',
            '.mcn-note .actions{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;}',
            '.mcn-colors{display:flex;gap:5px;flex-wrap:wrap;margin:4px 0;}',
            '.mcn-cdot{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s,border-color .1s;}',
            '.mcn-cdot:hover{transform:scale(1.15);}',
            '.mcn-cdot.on{border-color:#fff!important;transform:scale(1.2);}',
            '#mcn-resizer{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;',
            'background:linear-gradient(135deg,transparent 40%,' + T.btnBorder + ' 40%,' + T.btnBorder + ' 60%,transparent 60%);}',
            '#mcn-footer{text-align:center;font:10px system-ui;padding:5px 8px;border-top:1px solid ' + T.hdrBorder + ';color:' + T.metaColor + ';}',
            '#mcn-footer a{color:inherit;text-decoration:none;opacity:.45;}',
            '#mcn-footer a:hover{opacity:.8;text-decoration:underline;}',
            '.mcn-drag-item{display:flex;align-items:flex-start;gap:6px;}',
            '.mcn-drag-handle{cursor:grab;opacity:.4;font-size:14px;padding:10px 2px 0;flex-shrink:0;user-select:none;}',
            '.mcn-drag-handle:hover{opacity:.8;}',
            '.mcn-drag-item .mcn-note{flex:1;min-width:0;}',
            '.mcn-empty{font:11px system-ui;opacity:.6;padding:8px 0;}',
            '.mcn-meta{font:11px/1.4 system-ui;opacity:.72;color:' + T.metaColor + ';}',
            '.mcn-bm-pill{color:#fb923c;}',
        ].join('');
    }
    function injectCss() {
        var el = byId('mcn-style');
        if (!el) { el = document.createElement('style'); el.id = 'mcn-style'; document.head.appendChild(el); }
        el.textContent = buildCss();
    }

    function colorPickerHtml(selectedId) {
        return '<div class="mcn-colors">'
            + Object.keys(NOTE_COLOR_HEX).map(function (id) {
                return '<span class="mcn-cdot' + (id === selectedId ? ' on' : '') + '"'
                    + ' title="' + esc(t('color_' + id)) + '"'
                    + ' data-c="' + esc(id) + '"'
                    + ' style="background:' + NOTE_COLOR_HEX[id] + '"></span>';
            }).join('') + '</div>';
    }
    function wireColorPicker(container, getVal, setVal) {
        if (!container) return;
        container.addEventListener('click', function (e) {
            var dot = e.target && e.target.closest && e.target.closest('.mcn-cdot');
            if (!dot) return;
            var v = dot.getAttribute('data-c'); if (!v) return;
            setVal(v);
            container.querySelectorAll('.mcn-cdot').forEach(function (d) { d.classList.remove('on'); });
            dot.classList.add('on');
        });
    }

    function noteCardHtml(n, collapsible) {
        var hex         = NOTE_COLOR_HEX[n.color || 'default'] || '#78716c';
        var isExpanded  = !!expandedCards[n.id];
        var showDetails = !collapsible || isExpanded;

        var details = ''
            + (n.alarmAt ? '<div class="meta alarm-badge">⏰ ' + esc(fmtDate(n.alarmAt)) + '</div>' : '')
            + (n.text    ? '<div style="margin-top:5px;font:12px system-ui;white-space:pre-wrap;line-height:1.5">' + esc(n.text) + '</div>' : '')
            + (n.bookmark ? '<div class="bm-line">🔖 ' + esc(String(n.bookmark.lat || '')) + ', ' + esc(String(n.bookmark.lon || '')) + (n.bookmark.zoom ? ' · z' + n.bookmark.zoom : '') + '</div>' : '')
            + (n.tags && n.tags.length ? '<div class="tag-line">' + esc(tagsStr(n.tags)) + '</div>' : '')
            + '<div class="actions">'
            + '<button class="mcn-btn" data-act="jump" data-id="' + esc(n.id) + '">📍 ' + esc(t('jump')) + '</button>'
            + '<button class="mcn-btn" data-act="edit" data-id="' + esc(n.id) + '">✏️ ' + esc(t('edit')) + '</button>'
            + '<button class="mcn-btn dan" data-act="del" data-id="' + esc(n.id) + '">' + esc(t('del')) + '</button>'
            + '</div>';

        return '<div class="mcn-note" data-note-id="' + esc(n.id) + '"'
            + ' style="background:' + hex + '18;border:1px solid ' + hex + '66;color:inherit">'
            + '<div style="display:flex;align-items:center;gap:6px;cursor:pointer" data-act="toggle" data-id="' + esc(n.id) + '">'
            + '<div style="flex:1;min-width:0">'
            + '<h4 style="margin:0">' + (n.alarmAt && !n.alarmAck ? '🔔 ' : '') + esc(n.title || '(untitled)') + '</h4>'
            + '<div class="meta">' + esc(typeLabel(n.objectType)) + ' · ' + esc(n.objectId) + ' · ' + esc(statusLabel(n.status)) + '</div>'
            + '</div>'
            + (collapsible ? '<span style="font-size:11px;opacity:.6;flex-shrink:0">' + (isExpanded ? '\u25B2' : '\u25BC') + '</span>' : '')
            + '</div>'
            + '<div class="mcn-card-body" style="' + (showDetails ? '' : 'display:none') + '">' + details + '</div>'
            + '</div>';
    }

    //scoped query helper
    //all render functions use this instead of byId() so floating panel
    //and sidebar tab can share the same element names without conflicts.

    function q(container, sel) { return container.querySelector(sel); }

    //Tab: Create

    function renderCurrentObjHtml() {
        if (!selected) return '<div class="mcn-empty">' + esc(t('noObj')) + '</div>';

        var anchor = selected.anchor && validAnchor(selected.anchor.lat, selected.anchor.lon)
            ? selected.anchor
            : getMapCenter();

        var bm     = anchor ? makeBookmark(anchor) : null;
        var hasCoords = anchor && isFinite(anchor.lat) && isFinite(anchor.lon);

        return '<div><b>' + esc(typeLabel(selected.type)) + '</b> · <code>' + esc(selected.id) + '</code></div>'
            + '<div class="mcn-meta">' + esc(selected.title || '') + '</div>'
            + (hasCoords
                ? '<div class="mcn-meta">' + esc(anchor.lat.toFixed(5)) + ', ' + esc(anchor.lon.toFixed(5)) + '</div>'
                : '<div class="mcn-meta" style="color:#f87171">⚠️ Koordinaten nicht verf\u00FCgbar — bitte Objekt auf der Karte ausw\u00E4hlen.</div>')
            + (bm && hasCoords
                ? '<div class="mcn-meta mcn-bm-pill">🔖 ' + esc(bm.lat.toFixed(5)) + ', ' + esc(bm.lon.toFixed(5))
                    + (bm.zoom ? ' · z' + bm.zoom : '')
                    + ' <button class="mcn-btn mcn-bm-goto-btn">' + esc(t('goToMap')) + '</button></div>'
                : '');
    }

    function renderTabCreate(container) {
        var notes = notesForCurrent();
        container.innerHTML = ''
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('objTitle') + '</span>'
            + '<div>' + renderCurrentObjHtml() + '</div></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('noteTitle') + '</span>'
            + '<input data-f="q-title" class="mcn-input" placeholder="' + esc(t('noteTitle')) + '" value="' + esc(quickDraft.title) + '"/></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('noteText') + '</span>'
            + '<textarea data-f="q-text" class="mcn-area" placeholder="' + esc(t('noteText')) + '... (Ctrl+Enter)">' + esc(quickDraft.text) + '</textarea></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('color') + '</span>'
            + '<div data-f="q-color">' + colorPickerHtml(quickNoteColor) + '</div></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('alarm') + '</span>'
            + '<input data-f="q-alarm" class="mcn-input" type="datetime-local" value="' + esc(quickDraft.alarmAt) + '"/></div>'
            + '<div class="mcn-row">'
            + '<select data-f="q-status" class="mcn-sel mcn-grow"></select>'
            + '<input data-f="q-tags" class="mcn-input mcn-grow" placeholder="' + esc(t('tags')) + '" value="' + esc(quickDraft.tags) + '"/>'
            + '</div>'
            + '<div class="mcn-row" style="margin-top:6px">'
            + '<button data-f="q-save"    class="mcn-btn pri">💾 ' + esc(t('save')) + '</button>'
            + '<button data-f="q-refresh" class="mcn-btn">↻ ' + esc(t('refresh')) + '</button>'
            + '<button data-f="q-del-obj" class="mcn-btn dan">' + esc(t('deleteObj')) + '</button>'
            + '</div>'
            + '<div class="mcn-sec" style="margin-top:8px">'
            + '<span class="mcn-lab">' + esc(t('tabNotes')) + ' — ' + esc(t('objTitle')) + '</span>'
            + '<div data-f="cur-notes">'
            + (notes.length ? notes.map(function (n) { return noteCardHtml(n, true); }).join('') : '<div class="mcn-empty">' + esc(t('noNotes')) + '</div>')
            + '</div></div>';

        var $ = function (f) { return q(container, '[data-f="' + f + '"]'); };

        fillSelEl($('q-status'), STATUS, statusLabel, quickDraft.status || 'open');
        wireColorPicker($('q-color'), function () { return quickNoteColor; }, function (v) { quickNoteColor = v; quickDraft.color = v; });

        //auto-save draftfields
        function saveDraft() {
            quickDraft.title   = $('q-title').value || '';
            quickDraft.text    = $('q-text').value  || '';
            quickDraft.tags    = $('q-tags').value  || '';
            quickDraft.status  = $('q-status').value || 'open';
            quickDraft.alarmAt = $('q-alarm').value || '';
        }
        ['q-title', 'q-text', 'q-tags', 'q-alarm'].forEach(function (f) {
            var el = $(f); if (el) el.addEventListener('input', saveDraft);
        });
        $('q-status').addEventListener('change', saveDraft);

        $('q-save').addEventListener('click', function () {
            if (!selected) { alert(t('noObj')); return; }
            var txt = (quickDraft.text  || '').trim();
            var ttl = (quickDraft.title || '').trim() || txt.slice(0, 52) + (txt.length > 52 ? '...' : '');
            if (!txt && !ttl) { alert(t('noteText')); return; }
            upsertNote({
                title: ttl, text: txt,
                status: quickDraft.status || 'open',
                tags: parseTags(quickDraft.tags || ''),
                color: quickNoteColor || 'default',
                objectType: selected.type, objectId: selected.id,
                objectKey: selected.key, objectTitle: selected.title,
                anchor: selected.anchor || null,
                bookmark: makeBookmark(selected.anchor || null),
                alarmAt: localToIso(quickDraft.alarmAt || '') || null, alarmAck: false,
            });
            quickDraft = { title: '', text: '', tags: '', status: 'open', color: 'default', alarmAt: '' };
            quickNoteColor = 'default';
            refreshAll();
        });
        $('q-text').addEventListener('keydown', function (e) { if (e.ctrlKey && e.key === 'Enter') $('q-save').click(); });
        $('q-refresh').addEventListener('click', function () { selected = null; pickSelection(); refreshAll(); });
        $('q-del-obj').addEventListener('click', function () {
            if (!selected) { alert(t('noObj')); return; }
            var a = notesForCurrent();
            if (!a.length) { alert(t('noNotes')); return; }
            if (!confirm(t('confirmDelObj'))) return;
            db.notes = db.notes.filter(function (n) { return n.objectKey !== selected.key; });
            if (noteEditId && !db.notes.some(function (n) { return n.id === noteEditId; })) { noteEditId = null; editNoteColor = 'default'; }
            saveAll(); refreshAll();
        });

        var bmBtn = container.querySelector('.mcn-bm-goto-btn');
        if (bmBtn && selected) {
            var bm = makeBookmark(selected.anchor || null);
            if (bm) bmBtn.addEventListener('click', function () { if (!sdkMapCenter(bm.lat, bm.lon, bm.zoom)) olMapCenter(bm.lat, bm.lon, bm.zoom); });
        }
        $('cur-notes').addEventListener('click', onCardClick);
    }

    //Tab: Edit

    function renderTabEdit(container) {
        var $ = function (f) { return q(container, '[data-f="' + f + '"]'); };

        if (!noteEditId) {
            container.innerHTML = '<div class="mcn-empty" style="padding:16px 0">' + esc(t('editEmpty')) + '</div>';
            return;
        }
        var n = db.notes.find(function (x) { return x.id === noteEditId; });
        if (!n) {
            noteEditId = null; editNoteColor = 'default';
            container.innerHTML = '<div class="mcn-empty" style="padding:16px 0">' + esc(t('editEmpty')) + '</div>';
            return;
        }

        container.innerHTML = ''
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('noteTitle') + '</span>'
            + '<input data-f="e-title" class="mcn-input" value="' + esc(n.title || '') + '"/></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('noteText') + '</span>'
            + '<textarea data-f="e-text" class="mcn-area">' + esc(n.text || '') + '</textarea></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('color') + '</span>'
            + '<div data-f="e-color">' + colorPickerHtml(editNoteColor) + '</div></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('alarm') + '</span>'
            + '<input data-f="e-alarm" class="mcn-input" type="datetime-local" value="' + esc(isoToLocal(n.alarmAt)) + '"/></div>'
            + '<div class="mcn-row">'
            + '<select data-f="e-status" class="mcn-sel mcn-grow"></select>'
            + '<input data-f="e-tags" class="mcn-input mcn-grow" placeholder="' + esc(t('tags')) + '" value="' + esc(tagsStr(n.tags)) + '"/>'
            + '</div>'
            + '<div class="mcn-row" style="margin-top:8px">'
            + '<button data-f="e-save"   class="mcn-btn pri">✔ ' + esc(t('update'))  + '</button>'
            + '<button data-f="e-cancel" class="mcn-btn">' + esc(t('cancel')) + '</button>'
            + '<button data-f="e-del"    class="mcn-btn dan">' + esc(t('del'))    + '</button>'
            + '</div>';

        fillSelEl($('e-status'), STATUS, statusLabel, n.status || 'open');
        wireColorPicker($('e-color'), function () { return editNoteColor; }, function (v) { editNoteColor = v; });

        $('e-save').addEventListener('click', function () {
            var nn = db.notes.find(function (x) { return x.id === noteEditId; }); if (!nn) return;
            var alIso = localToIso($('e-alarm').value || '');
            upsertNote({
                id: nn.id,
                title: ($('e-title').value || '').trim(),
                text:  ($('e-text').value  || '').trim(),
                status: $('e-status').value || 'open',
                tags: parseTags($('e-tags').value || ''),
                color: editNoteColor || 'default',
                objectType: nn.objectType, objectId: nn.objectId,
                objectKey: nn.objectKey,   objectTitle: nn.objectTitle,
                anchor: nn.anchor || null,
                bookmark: nn.bookmark || makeBookmark(nn.anchor || null),
                alarmAt: alIso || null,
                alarmAck: alIso ? ((!nn.alarmAt || nn.alarmAt !== alIso) ? false : nn.alarmAck) : false,
            });
            noteEditId = null; editNoteColor = 'default';
            refreshAll();
        });
        $('e-cancel').addEventListener('click', function () { noteEditId = null; editNoteColor = 'default'; refreshAll(); });
        $('e-del').addEventListener('click', function () {
            if (!confirm(t('confirmDel'))) return;
            deleteNote(noteEditId); noteEditId = null; editNoteColor = 'default';
            refreshAll();
        });
    }

    //Tab: Notes

    function renderTabNotes(container) {
        var T = th();
        container.innerHTML = ''
            + '<div class="mcn-sec">'
            + '<input data-f="search" class="mcn-input" placeholder="' + esc(t('searchPh')) + '"/>'
            + '<div class="mcn-row" style="margin-top:5px">'
            + '<select data-f="ft" class="mcn-sel mcn-grow"></select>'
            + '<select data-f="fs" class="mcn-sel mcn-grow"></select>'
            + '</div><div class="mcn-row">'
            + '<select data-f="fc" class="mcn-sel mcn-grow"></select>'
            + '<label style="display:flex;align-items:center;gap:5px;font:12px system-ui;color:' + T.panelColor + '">'
            + '<input data-f="fa" type="checkbox"/> ' + esc(t('filterAlarm')) + '</label>'
            + '</div>'
            + '<div class="mcn-row" style="margin-top:4px">'
            + '<select data-f="sort" class="mcn-sel mcn-grow"></select>'
            + '</div>'
            + '<div class="mcn-row">'
            + '<button data-f="export" class="mcn-btn">📤 ' + esc(t('exportBtn')) + '</button>'
            + '<button data-f="import" class="mcn-btn">📥 ' + esc(t('importBtn')) + '</button>'
            + '<input data-f="importer" type="file" accept="application/json" style="display:none"/>'
            + '</div></div>'
            + '<div data-f="notes-list"></div>';

        var $ = function (f) { return q(container, '[data-f="' + f + '"]'); };
        var f = settings.filters || {};

        fillSelEl($('ft'), ['all', 'segment', 'place', 'houseNumber', 'navPoint', 'ur', 'unknown'], typeLabel, 'all');
        fillSelEl($('fs'), ['all'].concat(STATUS), statusLabel, 'all');
        fillSelEl($('fc'), ['all'].concat(Object.keys(NOTE_COLOR_HEX)), function (k) { return k === 'all' ? t('color_all') : t('color_' + k); }, 'all');
        fillSelEl($('sort'), ['newest', 'oldest', 'color', 'status', 'alpha', 'custom'],
            function (k) { return t('sort' + k.charAt(0).toUpperCase() + k.slice(1)); },
            settings.sortMode || 'newest');
        $('search').value = f.q      || '';
        $('ft').value     = f.type   || 'all';
        $('fs').value     = f.status || 'all';
        $('fc').value     = f.color  || 'all';
        $('fa').checked   = !!f.alarmOnly;

        var nl = $('notes-list');

        function renderList() {
            var isCustom = settings.sortMode === 'custom';
            var all = applyFilters(db.notes || []).slice(0, settings.compact ? 50 : 150);
            if (!all.length) { nl.innerHTML = '<div class="mcn-empty">' + esc(t('noMatches')) + '</div>'; return; }

            nl.innerHTML = all.map(function (n) {
                var card = noteCardHtml(n, false);
                if (!isCustom) return card;
                // Wrap in draggable container with handle
                return '<div class="mcn-drag-item" draggable="true" data-drag-id="' + esc(n.id) + '">'
                    + '<div class="mcn-drag-handle" title="Drag to reorder">\u2630</div>'
                    + card + '</div>';
            }).join('');

            if (isCustom) wireDragSort(nl);
        }
        renderList();

        var updateFilter = debounce(function () {
            settings.filters.q         = $('search').value || '';
            settings.filters.type      = $('ft').value     || 'all';
            settings.filters.status    = $('fs').value     || 'all';
            settings.filters.color     = $('fc').value     || 'all';
            settings.filters.alarmOnly = !!$('fa').checked;
            saveAll(); renderList();
        }, 120);

        $('search').addEventListener('input', updateFilter);
        ['ft', 'fs', 'fc', 'fa'].forEach(function (f2) { $(f2).addEventListener('change', updateFilter); });
        $('sort').addEventListener('change', function () {
            settings.sortMode = $('sort').value; saveAll(); renderList();
        });

        $('export').addEventListener('click', exportJson);
        $('import').addEventListener('click', function () { $('importer').click(); });
        $('importer').addEventListener('change', function () {
            var file = $('importer').files && $('importer').files[0]; if (!file) return;
            var r = new FileReader();
            r.onload = function () { importJsonText(String(r.result || '')); $('importer').value = ''; };
            r.readAsText(file, 'utf-8');
        });
        nl.addEventListener('click', onCardClick);
    }

    function wireDragSort(list) {
        var dragging = null;

        list.querySelectorAll('.mcn-drag-item').forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragging = item;
                item.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', function () {
                item.style.opacity = '';
                dragging = null;
                // Persist new order
                var ids = [];
                list.querySelectorAll('.mcn-drag-item').forEach(function (el) {
                    ids.push(el.getAttribute('data-drag-id'));
                });
                saveCustomOrder(ids);
            });
            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!dragging || dragging === item) return;
                var rect = item.getBoundingClientRect();
                var after = e.clientY > rect.top + rect.height / 2;
                list.insertBefore(dragging, after ? item.nextSibling : item);
            });
        });
    }

    //Tab: Settings

    function renderTabSettings(container) {
        var T = th();
        container.innerHTML = ''
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('language') + '</span>'
            + '<select data-f="lang" class="mcn-sel">'
            + '<option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option>'
            + '</select></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('theme') + '</span>'
            + '<select data-f="theme" class="mcn-sel">'
            + '<option value="dark">'  + t('theme_dark')  + '</option>'
            + '<option value="black">' + t('theme_black') + '</option>'
            + '<option value="gray">'  + t('theme_gray')  + '</option>'
            + '<option value="light">' + t('theme_light') + '</option>'
            + '<option value="warm">'  + t('theme_warm')  + '</option>'
            + '</select></div>'
            + '<div class="mcn-sec"><span class="mcn-lab">' + t('uiMode') + '</span>'
            + '<select data-f="mode" class="mcn-sel">'
            + '<option value="float">'   + esc(t('uiModeFloat'))   + '</option>'
            + '<option value="sidebar">' + esc(t('uiModeSidebar')) + '</option>'
            + '</select></div>'
            + '<div class="mcn-sec">'
            + '<label style="display:flex;align-items:center;gap:8px;font:12px system-ui;color:' + T.panelColor + '">'
            + '<input data-f="compact" type="checkbox"/> ' + esc(t('compactMode')) + '</label></div>'
            + '<div class="mcn-row">'
            + '<button data-f="resetpos" class="mcn-btn">↺ ' + esc(t('resetPos')) + '</button>'
            + '</div>';

        var $ = function (f) { return q(container, '[data-f="' + f + '"]'); };
        $('lang').value      = settings.language || 'en';
        $('theme').value     = settings.theme    || 'dark';
        $('mode').value      = settings.uiMode   || 'float';
        $('compact').checked = !!settings.compact;

        $('lang').addEventListener('change',    function () { settings.language = $('lang').value;  saveAll(); rebuildPanel(); });
        $('theme').addEventListener('change',   function () { settings.theme    = $('theme').value; saveAll(); injectCss(); rebuildPanel(); });
        $('mode').addEventListener('change',    function () { settings.uiMode   = $('mode').value;  saveAll(); applyUiMode(); });
        $('compact').addEventListener('change', function () { settings.compact  = $('compact').checked; saveAll(); });
        $('resetpos').addEventListener('click', function () { settings.ui = { x: 16, y: 84, w: 380, h: 580 }; saveAll(); clampToViewport(); });
    }

    //fillSelEl helper

    function fillSelEl(el, values, labelFn, selected2) {
        if (!el) return;
        el.innerHTML = '';
        values.forEach(function (v) {
            var o = document.createElement('option');
            o.value = v;
            o.textContent = typeof labelFn === 'function' ? labelFn(v) : (labelFn[v] || v);
            el.appendChild(o);
        });
        el.value = selected2 || values[0];
    }

    //renderers

    function renderActiveTab(container) {
        if (!container) return;
        container.innerHTML = '';
        if      (activeTab === 'create')   renderTabCreate(container);
        else if (activeTab === 'notes')    renderTabNotes(container);
        else if (activeTab === 'edit')     renderTabEdit(container);
        else if (activeTab === 'settings') renderTabSettings(container);
    }

    function renderPanel() {
        var body = byId('mcn-body'); if (!body) return;
        renderActiveTab(body);
    }
    function renderSidebarBody() {
        var sbody = byId('mcn-sbody'); if (!sbody) return;
        renderActiveTab(sbody);
    }
    function refreshAll() {
        renderPanel();
        renderSidebarBody();
    }

    function setTab(tab) {
        activeTab = tab;
        //update floating tab bar
        ['create', 'notes', 'edit', 'settings'].forEach(function (tname) {
            var el = byId('mcn-tab-' + tname);
            if (el) el.classList.toggle('active', tname === tab);
        });
        //update sidebar tab bar
        if (sidebarTabPane) {
            var T = th();
            sidebarTabPane.querySelectorAll('.mcn-stab-btn').forEach(function (btn) {
                var active = btn.getAttribute('data-tab') === tab;
                btn.style.borderBottomColor = active ? T.noteHover : 'transparent';
                btn.style.background        = active ? T.tabActiveBg : 'transparent';
            });
        }
        refreshAll();
    }

    function startEdit(id) {
        var n = db.notes.find(function (x) { return x.id === id; }); if (!n) return;
        noteEditId = n.id; editNoteColor = n.color || 'default';
        setTab('edit');
    }


    function onCardClick(ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest('[data-act]');
        if (!btn) return;
        ev.stopPropagation();

        var id  = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        var n   = db.notes.find(function (x) { return x.id === id; });

        if (act === 'toggle') {
            expandedCards[id] = !expandedCards[id];
            var card  = ev.target.closest('.mcn-note[data-note-id]');
            if (card) {
                var body  = card.querySelector('.mcn-card-body');
                var arrow = card.querySelector('[data-act="toggle"] span');
                if (body)  body.style.display = expandedCards[id] ? '' : 'none';
                if (arrow) arrow.innerHTML     = expandedCards[id] ? '\u25B2' : '\u25BC';
            }
            return;
        }

        if (!n) return;
        if      (act === 'jump') jumpToNote(n);
        else if (act === 'edit') startEdit(id);
        else if (act === 'del') {
            if (confirm(t('confirmDel'))) {
                deleteNote(id);
                if (noteEditId === id) { noteEditId = null; editNoteColor = 'default'; }
                refreshAll();
            }
        }
    }

    //sidebar - scripttab

    function renderSidebarContent(pane) {
        if (!pane) return;
        var T = th();

        pane.style.cssText = 'padding:0;height:100%;box-sizing:border-box;overflow:hidden;'
            + 'background:' + T.panelBg + ';color:' + T.panelColor + ';'
            + 'font:12px/1.45 "Segoe UI",system-ui,sans-serif;';
        pane.innerHTML = '';

        var inner = document.createElement('div');
        inner.style.cssText = 'height:100%;display:flex;flex-direction:column';

        //tab bar
        var tabBar = document.createElement('div');
        tabBar.style.cssText = 'display:flex;flex-shrink:0;border-bottom:1px solid ' + T.hdrBorder + ';background:' + T.hdrBg + ';';
        ['create', 'notes', 'edit', 'settings'].forEach(function (tab) {
            var lbls = { create: t('tabCreate'), notes: t('tabNotes'), edit: t('tabEdit'), settings: t('tabSettings') };
            var active = activeTab === tab;
            var btn = document.createElement('button');
            btn.textContent = lbls[tab] || tab;
            btn.className = 'mcn-stab-btn';
            btn.setAttribute('data-tab', tab);
            btn.style.cssText = 'flex:1;padding:7px 2px;font:600 11px system-ui;cursor:pointer;border:none;'
                + 'border-bottom:2px solid ' + (active ? T.noteHover : 'transparent') + ';'
                + 'background:' + (active ? T.tabActiveBg : 'transparent') + ';color:' + T.panelColor + ';';
            btn.addEventListener('click', function () { setTab(tab); });
            tabBar.appendChild(btn);
        });
        inner.appendChild(tabBar);

        //scrollable body
        var body = document.createElement('div');
        body.id = 'mcn-sbody';
        body.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 10px;';
        inner.appendChild(body);

        var footer = document.createElement('div');
        footer.style.cssText = 'text-align:center;font:10px system-ui;padding:4px 0;flex-shrink:0;'
            + 'border-top:1px solid ' + T.hdrBorder + ';color:' + T.metaColor + ';';
        footer.innerHTML = '<a href="https://github.com/HDJACK" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;opacity:.4">' + esc(t('footer')) + '</a>';
        inner.appendChild(footer);

        pane.appendChild(inner);
        sidebarTabPane = pane;

        renderActiveTab(body);
    }

    function refreshSidebarTab() {
        if (sidebarTabPane) renderSidebarContent(sidebarTabPane);
    }

    //floating panel

    function clampToViewport() {
        var panel = byId('mcn-panel'); if (!panel) return;
        var w = panel.offsetWidth  || settings.ui.w || 380;
        var h = panel.offsetHeight || settings.ui.h || 580;
        settings.ui.x = clamp(settings.ui.x, 6, Math.max(6, window.innerWidth  - w - 6));
        settings.ui.y = clamp(settings.ui.y, 6, Math.max(6, window.innerHeight - h - 6));
        panel.style.left = settings.ui.x + 'px';
        panel.style.top  = settings.ui.y + 'px';
        var btn = byId('mcn-btn');
        if (btn) { btn.style.left = clamp(settings.ui.x - 42, 4, Math.max(4, window.innerWidth - 42)) + 'px'; btn.style.top = settings.ui.y + 'px'; }
    }
    function applyPanelSize() {
        var panel = byId('mcn-panel'); if (!panel) return;
        panel.style.width  = clamp(settings.ui.w || 380, 300, Math.max(320, window.innerWidth  - 12)) + 'px';
        panel.style.height = clamp(settings.ui.h || 580, 300, Math.max(320, window.innerHeight - 12)) + 'px';
        clampToViewport();
        panel.style.display = settings.collapsed ? 'none' : 'block';
        var btn = byId('mcn-btn');
        if (btn) btn.style.display = settings.uiMode === 'sidebar' ? 'none' : 'flex';
    }
    function applyUiMode() {
        var panel = byId('mcn-panel'), btn = byId('mcn-btn');
        if (settings.uiMode === 'sidebar') {
            if (panel) panel.style.display = 'none';
            if (btn)   btn.style.display   = 'none';
            refreshSidebarTab();
        } else {
            if (btn) btn.style.display = 'flex';
            settings.collapsed = false;
            applyPanelSize();
            renderPanel();
            refreshSidebarTab();
        }
    }
    function rebuildPanel() {
        injectCss();
        var old = byId('mcn-panel'); if (old) old.remove();
        buildFloatingPanel();
        if (settings.uiMode === 'sidebar') {
            var p = byId('mcn-panel'); if (p) p.style.display = 'none';
            var b = byId('mcn-btn');   if (b) b.style.display = 'none';
        } else {
            renderPanel();
            applyPanelSize();
        }
        refreshSidebarTab();
    }

    function buildFloatingPanel() {
        if (byId('mcn-panel')) return;
        var panel = document.createElement('div');
        panel.id = 'mcn-panel';
        panel.style.width  = clamp(settings.ui.w || 380, 300, Math.max(320, window.innerWidth  - 12)) + 'px';
        panel.style.height = clamp(settings.ui.h || 580, 300, Math.max(320, window.innerHeight - 12)) + 'px';
        panel.style.left   = settings.ui.x + 'px';
        panel.style.top    = settings.ui.y + 'px';

        var TABS = ['create', 'notes', 'edit', 'settings'];
        var tabBtns = TABS.map(function (tab) {
            return '<button class="mcn-tab' + (activeTab === tab ? ' active' : '') + '" id="mcn-tab-' + tab + '">' + t('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)) + '</button>';
        }).join('');

        //mcn-inner is a flex column so it fills the panel
        panel.innerHTML = ''
            + '<div id="mcn-inner">'
            + '<div id="mcn-hdr"><div id="mcn-hdr-title">📒 ' + SCRIPT_NAME + '</div>'
            + '<button class="mcn-btn" id="mcn-close-btn" title="Close">\u2715</button></div>'
            + '<div id="mcn-tabs">' + tabBtns + '</div>'
            + '<div id="mcn-body"></div>'
            + '<div id="mcn-footer"><a href="https://github.com/HDJACK" target="_blank" rel="noopener">' + t('footer') + '</a></div>'
            + '</div>'
            + '<div id="mcn-resizer"></div>';

        document.body.appendChild(panel);

        TABS.forEach(function (tab) {
            byId('mcn-tab-' + tab).addEventListener('click', function () { setTab(tab); });
        });
        byId('mcn-close-btn').addEventListener('click', function () {
            settings.collapsed = true;
            var b = byId('mcn-btn'); if (b) b.textContent = '📘';
            applyPanelSize(); saveAll();
        });

        //drag header
        byId('mcn-hdr').addEventListener('mousedown', function (e) {
            if (e.target && e.target.closest('button')) return;
            _drag.on = true; _drag.x = e.clientX; _drag.y = e.clientY; _drag.ox = settings.ui.x; _drag.oy = settings.ui.y;
            e.preventDefault();
        });
        //resize handle
        byId('mcn-resizer').addEventListener('mousedown', function (e) {
            _resize.on = true; _resize.x = e.clientX; _resize.y = e.clientY;
            _resize.ow = panel.offsetWidth; _resize.oh = panel.offsetHeight;
            e.preventDefault();
        });

        renderPanel();
    }

    function buildToggleBtn() {
        if (byId('mcn-btn')) return;
        var btn = document.createElement('button');
        btn.id    = 'mcn-btn';
        btn.title = 'Map Change Notebook';
        btn.textContent = settings.collapsed ? '📘' : '🗒️';
        btn.style.display = settings.uiMode === 'sidebar' ? 'none' : 'flex';
        btn.style.left = clamp(settings.ui.x - 42, 4, Math.max(4, window.innerWidth - 42)) + 'px';
        btn.style.top  = settings.ui.y + 'px';

        btn.addEventListener('click', function (e) {
            if (Math.abs(e.clientX - _bdrag.sx) > 5 || Math.abs(e.clientY - _bdrag.sy) > 5) return;
            settings.collapsed = !settings.collapsed;
            btn.textContent = settings.collapsed ? '📘' : '🗒️';
            applyPanelSize(); saveAll();
        });
        btn.addEventListener('mousedown', function (e) {
            _bdrag.on = true; _bdrag.sx = e.clientX; _bdrag.sy = e.clientY;
            _bdrag.x = e.clientX; _bdrag.y = e.clientY; _bdrag.ox = settings.ui.x; _bdrag.oy = settings.ui.y;
            e.preventDefault();
        });
        document.body.appendChild(btn);
    }

    //global drag / resize listeners
    document.addEventListener('mousemove', function (e) {
        if (_drag.on) {
            settings.ui.x = _drag.ox + (e.clientX - _drag.x);
            settings.ui.y = _drag.oy + (e.clientY - _drag.y);
            clampToViewport();
        }
        if (_bdrag.on) {
            settings.ui.x = _bdrag.ox + (e.clientX - _bdrag.x);
            settings.ui.y = _bdrag.oy + (e.clientY - _bdrag.y);
            clampToViewport();
        }
        if (_resize.on) {
            settings.ui.w = clamp(_resize.ow + (e.clientX - _resize.x), 300, Math.max(320, window.innerWidth - 12));
            settings.ui.h = clamp(_resize.oh + (e.clientY - _resize.y), 300, Math.max(320, window.innerHeight - 12));
            applyPanelSize();
        }
    });
    document.addEventListener('mouseup', function () {
        if (_drag.on || _bdrag.on || _resize.on) { _drag.on = false; _bdrag.on = false; _resize.on = false; saveAll(); }
    });
    window.addEventListener('resize', function () { clampToViewport(); });

    //WME events

    function wireEvents() {
        if (!sdk || !sdk.Events) return;
        var onChange = function () { selected = null; pickSelection(); refreshAll(); };
        try { sdk.Events.on({ eventName: 'wme-selection-changed',     eventHandler: onChange }); } catch (e) {}
        try { sdk.Events.on({ eventName: 'wme-feature-editor-opened', eventHandler: onChange }); } catch (e) {}
        try {
            sdk.Events.on({
                eventName: 'wme-update-request-panel-opened',
                eventHandler: function (e) {
                    var d = e && (e.detail != null ? e.detail : e), id = null;
                    ['mapUpdateRequestId', 'updateRequestId', 'id', 'urId'].some(function (k) {
                        var v = d && d[k];
                        if (v != null && (typeof v === 'number' || /^\d+$/.test(String(v)))) { id = String(v); return true; }
                    });
                    if (id) window.__mcnLastUrId = id;
                    selected = null; pickSelection(); refreshAll();
                },
            });
        } catch (e) {}
    }

    // --- Init ---

    async function initScript() {
        if (typeof window.getWmeSdk !== 'function') {
            console.error('[' + SCRIPT_NAME + '] getWmeSdk not available');
            return;
        }

        sdk = window.getWmeSdk({ scriptId: SCRIPT_ID, scriptName: SCRIPT_NAME });
        sdkReady = true;

        var sidebar = await sdk.Sidebar.registerScriptTab();
        sidebar.tabLabel.textContent = '📒';
        sidebar.tabLabel.title       = SCRIPT_NAME + ' v' + VERSION;
        sidebarTabPane   = sidebar.tabPane;
        sdkTabRegistered = true;

        if (!ready) {
            prevVisitAt = settings.lastVisitAt || null;
            ready = true;
            injectCss();
            buildToggleBtn();
            buildFloatingPanel();
            wireAlarmBtns();
            selected = null; pickSelection();
        }

        if (settings.uiMode === 'sidebar') {
            var p = byId('mcn-panel'); if (p) p.style.display = 'none';
            var b = byId('mcn-btn');   if (b) b.style.display = 'none';
        } else {
            renderPanel();
            applyPanelSize();
        }

        renderSidebarContent(sidebarTabPane);
        wireEvents();

        setTimeout(function () { checkAlarms(); settings.lastVisitAt = nowIso(); saveAll(); }, 800);
        if (alarmTimer) clearInterval(alarmTimer);
        alarmTimer = setInterval(checkAlarms, 45000);

        log('v' + VERSION + ' ready');
    }

    function boot() {
        if (!window.SDK_INITIALIZED || typeof window.SDK_INITIALIZED.then !== 'function') {
            console.error('[' + SCRIPT_NAME + '] SDK_INITIALIZED missing — floating only');
            if (!ready) {
                prevVisitAt = settings.lastVisitAt || null;
                ready = true;
                injectCss(); buildToggleBtn(); buildFloatingPanel();
                wireAlarmBtns(); selected = null; pickSelection();
                renderPanel(); applyPanelSize();
            }
            return;
        }
        window.SDK_INITIALIZED
            .then(initScript)
            .catch(function (err) { console.error('[' + SCRIPT_NAME + '] init failed', err); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
