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
 * The control is a hand-rolled ARIA listbox rather than a <select>, because
 * native <option> elements cannot be styled and the plain OS dropdown looked
 * nothing like the rest of the page. Styling lives in assets/i18n/i18n.css.
 * The keyboard contract below is the APG select-only combobox: DOM focus stays
 * on the trigger and `aria-activedescendant` names the option under the cursor.
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
  var LIST_ID = 'doc-lang-list';
  var OPTION_ID_PREFIX = 'doc-lang-opt-';
  /** How long a typeahead buffer stays open, matching native select behaviour. */
  var TYPEAHEAD_RESET_MS = 700;

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
    syncControl(target);
  }

  // -------------------------------------------------------------- the control

  var currentCode = SOURCE_CODE;
  /** @type {{picker: Element, trigger: Element, label: Element, options: Array}} */
  var ui;
  var activeIndex = 0;
  var typed = '';
  var typedTimer = 0;

  function isOpen() {
    return ui.picker.classList.contains('is-open');
  }

  /**
   * Move the keyboard cursor. DOM focus stays on the trigger throughout, which
   * is what `aria-activedescendant` is for.
   *
   * @param {number} index already clamped into range by the caller
   */
  function setActive(index) {
    activeIndex = index;
    for (var i = 0; i < ui.options.length; i++) {
      var on = i === index;
      ui.options[i].el.classList.toggle('is-active', on);
      if (!on) continue;
      ui.trigger.setAttribute('aria-activedescendant', ui.options[i].el.id);
      // Only when the panel actually scrolls: on a short list the nearest
      // scrollable ancestor is the page, and nudging that would jump the doc.
      var list = ui.options[i].el.parentNode;
      if (list.scrollHeight > list.clientHeight && ui.options[i].el.scrollIntoView) {
        ui.options[i].el.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function indexOfCode(code) {
    for (var i = 0; i < ui.options.length; i++) {
      if (ui.options[i].code === code) return i;
    }
    return 0;
  }

  function onDocumentPointerDown(event) {
    if (!ui.picker.contains(event.target)) closeList(false);
  }

  function openList() {
    if (isOpen()) return;
    ui.picker.classList.add('is-open');
    ui.trigger.setAttribute('aria-expanded', 'true');
    setActive(indexOfCode(currentCode));
    // Registered only while open. The trigger sits inside the picker, so the
    // very click that opened the list cannot immediately close it again.
    document.addEventListener('mousedown', onDocumentPointerDown);
  }

  /** @param {boolean} returnFocus pass false when focus is leaving anyway */
  function closeList(returnFocus) {
    if (!isOpen()) return;
    ui.picker.classList.remove('is-open');
    ui.trigger.setAttribute('aria-expanded', 'false');
    ui.trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('mousedown', onDocumentPointerDown);
    if (returnFocus !== false) ui.trigger.focus();
  }

  function commitActive() {
    var option = ui.options[activeIndex];
    if (option && option.code !== currentCode) setLanguage(option.code);
  }

  /** Jump to the next option whose label starts with the buffered letters. */
  function typeahead(character) {
    clearTimeout(typedTimer);
    typed += character.toLowerCase();
    typedTimer = setTimeout(function () { typed = ''; }, TYPEAHEAD_RESET_MS);

    // A single letter starts searching after the cursor so repeated presses
    // cycle through the matches; a longer buffer re-searches from the cursor.
    var from = typed.length > 1 ? 0 : 1;
    for (var offset = 0; offset < ui.options.length; offset++) {
      var i = (activeIndex + offset + from) % ui.options.length;
      if (ui.options[i].label.toLowerCase().indexOf(typed) === 0) {
        setActive(i);
        return;
      }
    }
  }

  function onTriggerKeydown(event) {
    var key = event.key;

    if (!isOpen()) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(Math.min(activeIndex + 1, ui.options.length - 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        return;
      case 'Home':
        event.preventDefault();
        setActive(0);
        return;
      case 'End':
        event.preventDefault();
        setActive(ui.options.length - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commitActive();
        closeList(true);
        return;
      case 'Escape':
        event.preventDefault();
        closeList(true);
        return;
      case 'Tab':
        // APG: Tab commits the cursor, then focus moves on normally.
        commitActive();
        closeList(false);
        return;
      default:
        if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          typeahead(key);
        }
    }
  }

  /** Reflect the language in use on the trigger and in the list. */
  function syncControl(code) {
    if (!ui) return;
    currentCode = code;
    for (var i = 0; i < ui.options.length; i++) {
      var option = ui.options[i];
      var selected = option.code === code;
      option.el.classList.toggle('is-selected', selected);
      option.el.setAttribute('aria-selected', String(selected));
      if (selected) ui.label.textContent = option.label;
    }
  }

  /**
   * @param {{code: string, label: string}} entry
   * @param {Element} list
   * @returns {{code: string, label: string, el: Element}}
   */
  function buildOption(entry, list) {
    var el = document.createElement('li');
    el.className = 'lang-option';
    el.id = OPTION_ID_PREFIX + entry.code;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');

    var ball = document.createElement('span');
    ball.className = 'opt-ball';
    ball.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.className = 'opt-label';
    text.textContent = entry.label;

    var code = document.createElement('span');
    code.className = 'opt-code';
    code.setAttribute('aria-hidden', 'true');
    code.textContent = entry.code.toUpperCase();

    el.appendChild(ball);
    el.appendChild(text);
    el.appendChild(code);
    list.appendChild(el);

    el.addEventListener('click', function () {
      if (entry.code !== currentCode) setLanguage(entry.code);
      closeList(true);
    });

    return { code: entry.code, label: entry.label, el: el };
  }

  function buildSwitcher() {
    var entries = [{ code: SOURCE_CODE, label: SOURCE_LABEL }].concat(packs);

    var picker = document.createElement('div');
    picker.className = 'lang-picker';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'lang-trigger';
    trigger.id = 'doc-lang-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', LIST_ID);
    trigger.setAttribute('aria-label', 'Language / Ngôn ngữ');
    trigger.title = 'Language / Ngôn ngữ';

    var ball = document.createElement('span');
    ball.className = 'lang-ball';
    ball.setAttribute('aria-hidden', 'true');

    var label = document.createElement('span');
    label.className = 'lang-current';

    var caret = document.createElement('span');
    caret.className = 'lang-caret';
    caret.setAttribute('aria-hidden', 'true');

    trigger.appendChild(ball);
    trigger.appendChild(label);
    trigger.appendChild(caret);

    var list = document.createElement('ul');
    list.className = 'lang-list';
    list.id = LIST_ID;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Language / Ngôn ngữ');

    var head = document.createElement('li');
    head.className = 'lang-list-head';
    head.setAttribute('role', 'presentation');
    head.setAttribute('aria-hidden', 'true');
    head.textContent = 'LANGUAGE';
    list.appendChild(head);

    var options = [];
    for (var i = 0; i < entries.length; i++) {
      options.push(buildOption(entries[i], list));
    }

    // Pressing anywhere inside the panel — an option, the caption, the padding
    // — must not blur the trigger, or the list would close before the click
    // that chose an option ever lands. A native select behaves the same way.
    list.addEventListener('mousedown', function (event) { event.preventDefault(); });

    picker.appendChild(trigger);
    picker.appendChild(list);
    document.body.appendChild(picker);

    trigger.addEventListener('click', function () {
      if (isOpen()) closeList(true);
      else openList();
    });
    trigger.addEventListener('keydown', onTriggerKeydown);
    trigger.addEventListener('blur', function () { closeList(false); });

    return { picker: picker, trigger: trigger, label: label, options: options };
  }

  ui = buildSwitcher();
  // A saved code whose pack is no longer shipped falls back to English.
  var saved = readSaved();
  setLanguage(findPack(saved) ? saved : SOURCE_CODE, false);
})();
