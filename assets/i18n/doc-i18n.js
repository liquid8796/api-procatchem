/**
 * Language switcher for the API reference page.
 *
 * Classic script on purpose: the docs are expected to open straight from the
 * filesystem (see README), where ES modules and fetch() are blocked by the
 * browser but plain <script src> is not.
 *
 * Adding a language: write assets/i18n/<code>.js registering itself into
 * `window.PROCATCHEM_I18N` (see vi.js for the shape) and add one <script> tag
 * to index.html. This file enumerates the registry and needs no change.
 *
 * How a pack is applied: its `dict` is keyed by the *normalized English
 * innerHTML* of each translatable element. Applying walks a fixed set of
 * selectors, stashes the English original in a data attribute, and swaps the
 * content. Anything absent from the pack simply stays English, so a partial
 * translation can never render as a blank.
 *
 * Switching always restores English first and then applies the target pack.
 * That is what makes going straight from one translation to another correct:
 * the dictionary keys only ever match against the original English.
 *
 * Category headings need special handling: the page's own script prepends a
 * type chip <span> inside every h1, so those are translated by replacing the
 * text node only, never the innerHTML.
 */
(function () {
  'use strict';

  var REGISTRY = window.PROCATCHEM_I18N || {};
  var SOURCE_CODE = 'en';
  var SOURCE_LABEL = 'English';
  var STORE_KEY = 'procatchem-doc-lang';
  var EN_ATTR = 'data-i18n-en';
  var CAT_ATTR = 'data-i18n-cat';

  /**
   * Everything translated through the innerHTML dictionary. Kept identical to
   * the extraction pass that produces a pack, so keys always line up.
   */
  var SELECTORS = [
    'main .doc > p:not(.source-key):not(.signature)',
    'main .doc h3',
    'main .doc th',
    'main .doc td',
    'main .doc span.muted',
    'main .doc p.signature strong',
    'section.intro p',
    'section.intro h2',
    '.hero .stat span',
    '.hero .hp-label',
    '.hero-cta a',
    '.hero-cta .cta-note',
    '.brand-sub',
    '.builder-link .bl-title',
    '.builder-link .bl-sub',
    // Category links in the sidebar nav hold the same plain-text names the
    // cats map covers, so the generic dictionary handles them too.
    '.nav-tag-header > a',
    '.nav-tag > a'
  ].join(',');

  /**
   * Registered packs that are complete enough to use, in label order so the
   * dropdown reads predictably however the script tags happen to be ordered.
   */
  function collectPacks() {
    var found = [];
    for (var code in REGISTRY) {
      if (!Object.prototype.hasOwnProperty.call(REGISTRY, code)) continue;
      var pack = REGISTRY[code];
      if (!pack || !pack.dict) continue;
      pack.code = pack.code || code;
      pack.label = pack.label || code.toUpperCase();
      found.push(pack);
    }
    found.sort(function (a, b) { return a.label.localeCompare(b.label); });
    return found;
  }

  var packs = collectPacks();
  if (!packs.length) return; // Nothing to switch to; leave the page untouched.

  var descriptionMeta = document.querySelector('meta[name="description"]');
  var source = {
    title: document.title,
    description: descriptionMeta ? descriptionMeta.getAttribute('content') : null,
    searchPlaceholder: null
  };

  function findPack(code) {
    for (var i = 0; i < packs.length; i++) {
      if (packs[i].code === code) return packs[i];
    }
    return null;
  }

  function norm(html) {
    return html.trim().replace(/\s+/g, ' ');
  }

  function eachCategoryTextNode(callback) {
    var headings = document.querySelectorAll('section.tag-section h1');
    for (var i = 0; i < headings.length; i++) {
      var nodes = headings[i].childNodes;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 3 && nodes[j].nodeValue.trim()) {
          callback(headings[i], nodes[j]);
        }
      }
    }
  }

  function applyPack(pack) {
    var swapped = document.querySelectorAll(SELECTORS);
    for (var i = 0; i < swapped.length; i++) {
      var el = swapped[i];
      var translated = pack.dict[norm(el.innerHTML)];
      if (translated) {
        if (!el.hasAttribute(EN_ATTR)) el.setAttribute(EN_ATTR, el.innerHTML);
        el.innerHTML = translated;
      }
    }

    var cats = pack.cats || {};
    eachCategoryTextNode(function (heading, node) {
      var translated = cats[norm(node.nodeValue)];
      if (translated) {
        if (!heading.hasAttribute(CAT_ATTR)) heading.setAttribute(CAT_ATTR, node.nodeValue);
        node.nodeValue = translated;
      }
    });

    var search = document.getElementById('search');
    if (search && pack.searchPlaceholder) {
      if (source.searchPlaceholder === null) source.searchPlaceholder = search.placeholder;
      search.placeholder = pack.searchPlaceholder;
    }

    var meta = pack.meta || {};
    if (meta.title) document.title = meta.title;
    if (descriptionMeta && meta.description) {
      descriptionMeta.setAttribute('content', meta.description);
    }
    document.documentElement.lang = pack.code;
  }

  function restoreSource() {
    var swapped = document.querySelectorAll('[' + EN_ATTR + ']');
    for (var i = 0; i < swapped.length; i++) {
      swapped[i].innerHTML = swapped[i].getAttribute(EN_ATTR);
      swapped[i].removeAttribute(EN_ATTR);
    }

    var headings = document.querySelectorAll('[' + CAT_ATTR + ']');
    for (var h = 0; h < headings.length; h++) {
      var original = headings[h].getAttribute(CAT_ATTR);
      var nodes = headings[h].childNodes;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 3 && nodes[j].nodeValue.trim()) {
          nodes[j].nodeValue = original;
          break;
        }
      }
      headings[h].removeAttribute(CAT_ATTR);
    }

    var search = document.getElementById('search');
    if (search && source.searchPlaceholder !== null) {
      search.placeholder = source.searchPlaceholder;
    }

    document.title = source.title;
    if (descriptionMeta && source.description !== null) {
      descriptionMeta.setAttribute('content', source.description);
    }
    document.documentElement.lang = SOURCE_CODE;
  }

  function readSaved() {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch (_) {
      return null;
    }
  }

  function save(code) {
    try {
      localStorage.setItem(STORE_KEY, code);
    } catch (_) {
      // Remembering the choice is a convenience; the switcher still works.
    }
  }

  /**
   * @param {string} code a registered language code, or the source code
   * @param {boolean} [persist] pass false when restoring a saved choice on load
   */
  function setLanguage(code, persist) {
    var pack = findPack(code);
    var target = pack ? pack.code : SOURCE_CODE;

    // Always back to English first: dictionary keys are English, so applying a
    // pack on top of another translation would match nothing.
    restoreSource();
    if (pack) applyPack(pack);

    document.documentElement.setAttribute('data-doc-lang', target);
    if (persist !== false) save(target);

    var select = document.getElementById('doc-lang-select');
    if (select && select.value !== target) select.value = target;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '.lang-picker{position:fixed;top:16px;right:24px;z-index:60;',
      // Padding plus the select line-height keeps the hit area at ~46px, above
      // the 44px touch-target guideline, without making the pill look heavy.
      '  display:flex;align-items:center;gap:8px;padding:10px 12px 10px 14px;',
      '  background:#fff;border:2px solid var(--shell-ink,#20242B);border-radius:999px;',
      '  box-shadow:0 3px 0 var(--shell-ink,#20242B)}',
      '.lang-picker::before{content:"";width:13px;height:13px;border-radius:50%;flex:none;',
      '  background:conic-gradient(from 140deg,#6890F0,#78C850,#F2C94C,#E3350D,#6890F0);',
      '  border:2px solid var(--shell-ink,#20242B)}',
      '.lang-select{appearance:none;-webkit-appearance:none;cursor:pointer;',
      '  border:0;background-color:transparent;padding:0 17px 0 0;line-height:22px;',
      '  font:800 12.5px/22px var(--ff-body,sans-serif);color:var(--shell-ink,#20242B);',
      '  background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),',
      '   linear-gradient(135deg,currentColor 50%,transparent 50%);',
      '  background-position:calc(100% - 8px) 55%,calc(100% - 4px) 55%;',
      '  background-size:4px 4px,4px 4px;background-repeat:no-repeat}',
      '.lang-select:focus-visible{outline:3px dashed var(--gold,#F2C94C);outline-offset:4px}',
      // Press Start 2P has no Vietnamese diacritics, and that will hold for most
      // non-Latin packs too; fall back to the body face whenever a translation
      // is active so accents render instead of dropping out.
      'html:not([data-doc-lang="en"]) .tag-section h1{font-family:var(--ff-body);',
      '  font-weight:800;font-size:24px;letter-spacing:.01em}',
      'html:not([data-doc-lang="en"]) .hero-eyebrow{font-family:var(--ff-body);',
      '  font-weight:800;font-size:13px;letter-spacing:.14em;text-transform:uppercase}',
      // The hero headline is the one block the picker could reach on a narrow
      // screen, so keep its text clear of the control.
      '@media(max-width:980px){.lang-picker{top:10px;right:12px;padding:9px 11px 9px 13px}',
      '  .lang-select{font-size:12px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function buildSwitcher() {
    injectStyles();

    var picker = document.createElement('div');
    picker.className = 'lang-picker';

    var select = document.createElement('select');
    select.className = 'lang-select';
    select.id = 'doc-lang-select';
    select.setAttribute('aria-label', 'Language / Ngôn ngữ');
    select.title = 'Language / Ngôn ngữ';

    var options = [{ code: SOURCE_CODE, label: SOURCE_LABEL }].concat(packs);
    for (var i = 0; i < options.length; i++) {
      var option = document.createElement('option');
      option.value = options[i].code;
      option.textContent = options[i].label;
      select.appendChild(option);
    }

    select.addEventListener('change', function () {
      setLanguage(select.value);
    });

    picker.appendChild(select);
    document.body.appendChild(picker);
    return select;
  }

  var switcher = buildSwitcher();
  // A saved code whose pack is no longer shipped falls back to English.
  var saved = readSaved();
  var initial = findPack(saved) ? saved : SOURCE_CODE;
  switcher.value = initial;
  setLanguage(initial, false);
})();
