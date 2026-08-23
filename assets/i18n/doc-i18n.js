/**
 * Language switcher for the API reference page.
 *
 * Classic script on purpose: the docs are expected to open straight from the
 * filesystem (see README), where ES modules and fetch() are blocked by the
 * browser but plain <script src> is not.
 *
 * How it works: assets/i18n/vi.js publishes a translation pack keyed by the
 * *normalized English innerHTML* of each translatable element. Applying a
 * language walks a fixed set of selectors, looks each element up in the pack,
 * stashes the English original in a data attribute, and swaps the content.
 * Anything not in the pack simply stays English — a half-translated entry can
 * never render as a blank.
 *
 * Category headings need special handling: the page's own script prepends a
 * type chip <span> inside every h1, so those are translated by replacing the
 * text node only, never the innerHTML.
 */
(function () {
  'use strict';

  var PACK = window.PROCATCHEM_VI;
  if (!PACK || !PACK.dict) return;

  var STORE_KEY = 'procatchem-doc-lang';
  var EN_ATTR = 'data-i18n-en';
  var CAT_ATTR = 'data-i18n-cat';

  /**
   * Everything translated through the innerHTML dictionary. Kept identical to
   * the extraction pass that produced the pack, so keys always line up.
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

  function applyVietnamese() {
    var swapped = document.querySelectorAll(SELECTORS);
    for (var i = 0; i < swapped.length; i++) {
      var el = swapped[i];
      var translated = PACK.dict[norm(el.innerHTML)];
      if (translated) {
        if (!el.hasAttribute(EN_ATTR)) el.setAttribute(EN_ATTR, el.innerHTML);
        el.innerHTML = translated;
      }
    }

    eachCategoryTextNode(function (heading, node) {
      var translated = PACK.cats[norm(node.nodeValue)];
      if (translated) {
        if (!heading.hasAttribute(CAT_ATTR)) heading.setAttribute(CAT_ATTR, node.nodeValue);
        node.nodeValue = translated;
      }
    });

    var search = document.getElementById('search');
    if (search && PACK.searchPlaceholder) {
      if (!search.hasAttribute(EN_ATTR)) search.setAttribute(EN_ATTR, search.placeholder);
      search.placeholder = PACK.searchPlaceholder;
    }

    if (PACK.meta && PACK.meta.title) document.title = PACK.meta.title;
    var meta = document.querySelector('meta[name="description"]');
    if (meta && PACK.meta && PACK.meta.description) {
      if (!meta.hasAttribute(EN_ATTR)) meta.setAttribute(EN_ATTR, meta.getAttribute('content'));
      meta.setAttribute('content', PACK.meta.description);
    }
    document.documentElement.lang = 'vi';
    document.documentElement.setAttribute('data-doc-lang', 'vi');
  }

  function restoreEnglish() {
    var swapped = document.querySelectorAll('[' + EN_ATTR + ']');
    for (var i = 0; i < swapped.length; i++) {
      var el = swapped[i];
      if (el.id === 'search') el.placeholder = el.getAttribute(EN_ATTR);
      else if (el.tagName === 'META') el.setAttribute('content', el.getAttribute(EN_ATTR));
      else el.innerHTML = el.getAttribute(EN_ATTR);
      el.removeAttribute(EN_ATTR);
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

    if (PACK.meta && PACK.meta.originalTitle) document.title = PACK.meta.originalTitle;
    document.documentElement.lang = 'en';
    document.documentElement.setAttribute('data-doc-lang', 'en');
  }

  function readSaved() {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch (_) {
      return null;
    }
  }

  function save(lang) {
    try {
      localStorage.setItem(STORE_KEY, lang);
    } catch (_) {
      // Remembering the choice is a convenience; the toggle still works.
    }
  }

  var current = 'en';

  function setLanguage(lang) {
    if (lang === 'vi') applyVietnamese();
    else restoreEnglish();
    current = lang;
    save(lang);
    var buttons = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute('data-lang') === lang;
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-pressed', String(active));
    }
  }

  function buildToggle() {
    var host = document.querySelector('.search');
    if (!host) return;

    var style = document.createElement('style');
    style.textContent = [
      '.lang-toggle{display:flex;gap:6px;margin-top:8px}',
      '.lang-btn{flex:1;padding:11px 0;cursor:pointer;border-radius:8px;',
      '  background:#0E1B14;border:2px solid #245239;color:#5F8F74;',
      '  font:800 11px var(--ff-mono,monospace);letter-spacing:.08em;',
      '  transition:background .15s ease,color .15s ease,border-color .15s ease}',
      '.lang-btn:hover{color:#D7F5DF;border-color:#3A7A55}',
      '.lang-btn.is-active{background:#78C850;border-color:#20242B;color:#0A1811}',
      // Press Start 2P has no Vietnamese diacritics; swap the pixel headings to
      // the body face while Vietnamese is active so they render cleanly.
      'html[data-doc-lang="vi"] .tag-section h1{font-family:var(--ff-body);font-weight:800;font-size:24px;letter-spacing:.01em}',
      'html[data-doc-lang="vi"] .hero-eyebrow{font-family:var(--ff-body);font-weight:800;font-size:13px;letter-spacing:.14em;text-transform:uppercase}'
    ].join('\n');
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'lang-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language / Ngôn ngữ');

    [['en', 'English'], ['vi', 'Tiếng Việt']].forEach(function (pair) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'lang-btn';
      button.setAttribute('data-lang', pair[0]);
      button.setAttribute('aria-pressed', 'false');
      button.title = pair[1];
      button.textContent = pair[0].toUpperCase();
      button.addEventListener('click', function () {
        if (current !== pair[0]) setLanguage(pair[0]);
      });
      wrap.appendChild(button);
    });

    host.appendChild(wrap);
  }

  PACK.meta = PACK.meta || {};
  PACK.meta.originalTitle = document.title;

  buildToggle();
  setLanguage(readSaved() === 'vi' ? 'vi' : 'en');
})();
