/**
 * Language state for the Script Builder.
 *
 * The builder rebuilds its whole UI from state on every change, so translation
 * happens where strings reach the DOM: render sites call {@link t} and a
 * language switch simply re-renders. Data modules (panels, config lists,
 * condition kinds, templates) stay English — they are logic, and the English
 * string doubles as the dictionary key.
 *
 * A pack's `dict` maps exact English source strings to translations. Anything
 * missing simply stays English, so a partial pack can never blank the page.
 * Strings with dynamic parts carry `{token}` placeholders that are filled in
 * *after* lookup, so the key is stable however the values change.
 *
 * The choice is stored under the same key the API reference page uses:
 * picking a language on either page covers both.
 *
 * Adding a language: write assets/builder/js/i18n/<code>.js exporting a pack
 * (see vi.js for the shape) and add it to {@link PACKS}. Nothing else changes.
 */

import { ja } from '../i18n/ja.js';
import { vi } from '../i18n/vi.js';
import { zh } from '../i18n/zh.js';

/** English is the source text, not a pack. */
const SOURCE = Object.freeze({ code: 'en', label: 'English' });

/** Registered packs, in label order so the switcher reads predictably. */
const PACKS = Object.freeze([ja, vi, zh].sort((a, b) => a.label.localeCompare(b.label)));

/** Same key as the API reference page, so one choice covers both pages. */
const STORE_KEY = 'procatchem-doc-lang';

/** @type {object | null} the active pack, or null for English */
let active = null;

/** @type {Set<() => void>} */
const listeners = new Set();

/** @returns {Array<{ code: string, label: string }>} English first, then packs */
export function languages() {
  return [SOURCE, ...PACKS.map((pack) => ({ code: pack.code, label: pack.label }))];
}

/** @returns {string} the active language code */
export function currentLanguage() {
  return active ? active.code : SOURCE.code;
}

/** @returns {object | null} the active pack, or null while English is shown */
export function currentPack() {
  return active;
}

/**
 * Translate one string.
 *
 * @param {string} text the English source string, `{token}` placeholders included
 * @param {Record<string, unknown>} [params] values for the placeholders
 * @returns {string}
 */
export function t(text, params) {
  const translated = active?.dict[text] ?? text;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (token, key) => (
    key in params ? String(params[key]) : token
  ));
}

/**
 * Switch languages and notify subscribers so they can re-render.
 *
 * @param {string} code a code from {@link languages}; anything else is English
 * @param {boolean} [persist] pass false when restoring the saved choice on load
 */
export function setLanguage(code, persist = true) {
  active = PACKS.find((pack) => pack.code === code) ?? null;
  const target = currentLanguage();

  // Guarded so translated modules stay importable from Node tests, which have
  // no DOM. There the language simply stays English.
  if (typeof document !== 'undefined') {
    document.documentElement.lang = target;
    // The same attribute the reference page sets; the shared i18n.css keys its
    // pixel-font fallback off it.
    document.documentElement.setAttribute('data-doc-lang', target);
  }
  if (persist) save(target);

  for (const listener of listeners) listener();
}

/**
 * Run `fn` after every language switch. Subscribers re-render whatever they
 * own; there is no unsubscribe because all of them live as long as the page.
 *
 * @param {() => void} fn
 */
export function onLanguageChange(fn) {
  listeners.add(fn);
}

/** @param {string} code */
function save(code) {
  try {
    localStorage.setItem(STORE_KEY, code);
  } catch {
    // Remembering the choice is a convenience; switching still works.
  }
}

/** @returns {string | null} */
function readSaved() {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

// Restore the saved choice before anything renders. Module evaluation runs
// before main.js constructs the app, so the first render is already translated.
if (typeof document !== 'undefined') {
  setLanguage(readSaved() ?? SOURCE.code, false);
}
