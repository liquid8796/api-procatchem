/**
 * Translation for the parts of builder.html that JavaScript never re-renders:
 * the sidebar chrome, the hero, the preview bar, and a handful of labelling
 * attributes. Everything dynamic goes through `t()` at its render site instead.
 *
 * The English original is stashed in a data attribute on first use, so
 * switching languages always translates from the source text — the dictionary
 * keys are English — and switching back to English restores it exactly.
 *
 * Deliberately not translated here: the "Script Builder" name, the version
 * badge, and the noscript fallback (it only renders when this script cannot).
 */

import { currentPack, t } from '../core/i18n.js';

const EN_ATTR = 'data-i18n-en';

/** Elements whose whole innerHTML is one translatable string. */
const HTML_SELECTORS = [
  '.side-h',
  '.side-block .side-note:not(#template-about)',
  '#btn-quick', '#btn-api-browser', '#btn-structure', '#btn-handbook',
  '#btn-load-graph', '#btn-graph-tools', '#btn-clear-graph',
  '#btn-template', '#btn-import', '#btn-export', '#btn-reset',
  '.side-back',
  '.hero-eyebrow', '.hero-tag', '.hero-note',
  '.screen-name',
  '#btn-hide-preview', '#btn-copy', '#btn-download',
  '.diag-h',
  '.preview-toggle-text',
  '.drop-veil span',
].join(',');

/**
 * Elements where only the first non-empty text node is translated, because a
 * child element (the version badge, a nav icon) must be left alone.
 */
const TEXT_NODE_SELECTORS = '.brand-sub, .side-nav a';

/** Attributes that label static elements for assistive tech or tooltips. */
const ATTR_TARGETS = [
  ['#graph-dialog', 'aria-label'],
  ['#api-dialog', 'aria-label'],
  ['#structure-dialog', 'aria-label'],
  ['#handbook-dialog', 'aria-label'],
  ['#template-picker', 'aria-label'],
  ['#btn-hide-preview', 'title'],
  ['nav.side-nav', 'aria-label'],
];

/** @type {{ title: string, description: string } | null} */
let sourceMeta = null;

/** Collapse the whitespace the source markup wraps with, as the docs page does. */
function norm(text) {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Re-translate every static string for the active language.
 * Subscribe this to language changes and call it once at boot.
 */
export function applyStaticText() {
  for (const el of document.querySelectorAll(HTML_SELECTORS)) {
    if (!el.hasAttribute(EN_ATTR)) el.setAttribute(EN_ATTR, norm(el.innerHTML));
    el.innerHTML = t(el.getAttribute(EN_ATTR));
  }

  for (const el of document.querySelectorAll(TEXT_NODE_SELECTORS)) {
    const node = firstTextNode(el);
    if (!node) continue;
    if (!el.hasAttribute(EN_ATTR)) el.setAttribute(EN_ATTR, norm(node.nodeValue));
    node.nodeValue = t(el.getAttribute(EN_ATTR));
  }

  for (const [selector, attr] of ATTR_TARGETS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const stash = `${EN_ATTR}-${attr}`;
    if (!el.hasAttribute(stash)) el.setAttribute(stash, el.getAttribute(attr) ?? '');
    el.setAttribute(attr, t(el.getAttribute(stash)));
  }

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (!sourceMeta) {
    sourceMeta = {
      title: document.title,
      description: descriptionMeta?.getAttribute('content') ?? '',
    };
  }
  const meta = currentPack()?.meta ?? sourceMeta;
  document.title = meta.title;
  descriptionMeta?.setAttribute('content', meta.description);
}

/**
 * @param {Element} el
 * @returns {Text | null}
 */
function firstTextNode(el) {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) return node;
  }
  return null;
}
