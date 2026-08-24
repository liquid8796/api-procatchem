/**
 * The language dropdown, top right — the builder's twin of the control on the
 * API reference page. It shares that page's stylesheet (assets/i18n/i18n.css)
 * and its keyboard contract: an APG select-only combobox where DOM focus stays
 * on the trigger and `aria-activedescendant` names the option under the cursor.
 *
 * It only *selects* a language. Applying one is the i18n module's job, and the
 * subscribers registered there re-render whatever they own.
 */

import { currentLanguage, languages, onLanguageChange, setLanguage } from '../core/i18n.js';
import { h } from './dom.js';

const LIST_ID = 'builder-lang-list';
const OPTION_ID_PREFIX = 'builder-lang-opt-';
/** How long a typeahead buffer stays open, matching native select behaviour. */
const TYPEAHEAD_RESET_MS = 700;

/** Build the switcher and mount it on the body. */
export function installLanguageSwitcher() {
  const entries = languages();
  if (entries.length < 2) return; // Nothing to switch to.

  const picker = h('div.lang-picker', {});
  const trigger = h('button.lang-trigger', {
    type: 'button',
    id: 'builder-lang-trigger',
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': 'false',
    'aria-controls': LIST_ID,
    'aria-label': 'Language / Ngôn ngữ',
    title: 'Language / Ngôn ngữ',
  });
  const label = h('span.lang-current', {});
  trigger.append(
    h('span.lang-ball', { 'aria-hidden': 'true' }),
    label,
    h('span.lang-caret', { 'aria-hidden': 'true' }),
  );

  const list = h('ul.lang-list', {
    id: LIST_ID,
    role: 'listbox',
    'aria-label': 'Language / Ngôn ngữ',
  }, [
    h('li.lang-list-head', { role: 'presentation', 'aria-hidden': 'true', text: 'LANGUAGE' }),
  ]);

  let activeIndex = 0;
  let typed = '';
  let typedTimer = 0;

  const options = entries.map((entry, index) => {
    const el = h('li.lang-option', {
      id: OPTION_ID_PREFIX + entry.code,
      role: 'option',
      'aria-selected': 'false',
      onClick: () => {
        if (entry.code !== currentLanguage()) setLanguage(entry.code);
        closeList(true);
      },
    }, [
      h('span.opt-ball', { 'aria-hidden': 'true' }),
      h('span.opt-label', { text: entry.label }),
      h('span.opt-code', { 'aria-hidden': 'true', text: entry.code.toUpperCase() }),
    ]);
    list.appendChild(el);
    return { code: entry.code, label: entry.label, el, index };
  });

  const isOpen = () => picker.classList.contains('is-open');

  /** @param {number} index already clamped into range by the caller */
  const setActive = (index) => {
    activeIndex = index;
    for (const option of options) {
      const on = option.index === index;
      option.el.classList.toggle('is-active', on);
      if (!on) continue;
      trigger.setAttribute('aria-activedescendant', option.el.id);
      // Only when the panel actually scrolls: nudging a non-scrolling ancestor
      // would jump the page instead.
      if (list.scrollHeight > list.clientHeight && option.el.scrollIntoView) {
        option.el.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const indexOfCurrent = () => Math.max(
    0,
    options.findIndex((option) => option.code === currentLanguage()),
  );

  const onDocumentPointerDown = (event) => {
    if (!picker.contains(event.target)) closeList(false);
  };

  const openList = () => {
    if (isOpen()) return;
    picker.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    setActive(indexOfCurrent());
    // Registered only while open. The trigger sits inside the picker, so the
    // very click that opened the list cannot immediately close it again.
    document.addEventListener('mousedown', onDocumentPointerDown);
  };

  /** @param {boolean} returnFocus pass false when focus is leaving anyway */
  const closeList = (returnFocus) => {
    if (!isOpen()) return;
    picker.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('mousedown', onDocumentPointerDown);
    if (returnFocus !== false) trigger.focus();
  };

  const commitActive = () => {
    const option = options[activeIndex];
    if (option && option.code !== currentLanguage()) setLanguage(option.code);
  };

  /** Jump to the next option whose label starts with the buffered letters. */
  const typeahead = (character) => {
    clearTimeout(typedTimer);
    typed += character.toLowerCase();
    typedTimer = setTimeout(() => { typed = ''; }, TYPEAHEAD_RESET_MS);

    // A single letter starts searching after the cursor so repeated presses
    // cycle through the matches; a longer buffer re-searches from the cursor.
    const from = typed.length > 1 ? 0 : 1;
    for (let offset = 0; offset < options.length; offset += 1) {
      const i = (activeIndex + offset + from) % options.length;
      if (options[i].label.toLowerCase().startsWith(typed)) {
        setActive(i);
        return;
      }
    }
  };

  trigger.addEventListener('keydown', (event) => {
    const key = event.key;

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
        setActive(Math.min(activeIndex + 1, options.length - 1));
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
        setActive(options.length - 1);
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
  });

  trigger.addEventListener('click', () => {
    if (isOpen()) closeList(true);
    else openList();
  });
  trigger.addEventListener('blur', () => closeList(false));

  // Pressing anywhere inside the panel — an option, the caption, the padding —
  // must not blur the trigger, or the list would close before the click that
  // chose an option ever lands. A native select behaves the same way.
  list.addEventListener('mousedown', (event) => event.preventDefault());

  /** Reflect the language in use on the trigger and in the list. */
  const sync = () => {
    const code = currentLanguage();
    for (const option of options) {
      const selected = option.code === code;
      option.el.classList.toggle('is-selected', selected);
      option.el.setAttribute('aria-selected', String(selected));
      if (selected) label.textContent = option.label;
    }
  };

  picker.append(trigger, list);
  document.body.appendChild(picker);
  onLanguageChange(sync);
  sync();
}
