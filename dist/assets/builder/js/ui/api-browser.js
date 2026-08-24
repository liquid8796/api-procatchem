/**
 * A searchable view of the Lua API, inside the builder.
 *
 * The reference page next door is the place to read about a function; this is
 * the place to *find* one while you are filling in a step or a condition — so
 * it is deliberately terse: name, signature, arguments, what comes back, and a
 * button that copies the name into the clipboard.
 */

import { t } from '../core/i18n.js';
import { API_ENTRIES, API_GROUPS, API_VERSION } from '../domain/api-catalog.js';
import { h, must, replaceChildren } from './dom.js';

/** How many results to draw before asking the reader to narrow the search. */
const MAX_RESULTS = 60;

/** Reference-page anchors are the lower-cased operation id. */
const REFERENCE_URL = 'index.html';

export class ApiBrowser {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {import('./app.js').BuilderApp} app
   */
  constructor(dialog, app) {
    this._dialog = dialog;
    this._app = app;
    this._query = '';
    this._group = '';
    /** @type {string | null} */
    this._selected = null;
    this._list = h('div.api-list', {});
    this._detail = h('div.api-detail', {});
  }

  /** Draw the dialog and show it. */
  open() {
    this._render();
    this._dialog.showModal();
    must('#api-search', this._dialog).focus();
  }

  _render() {
    replaceChildren(this._dialog, [
      h('header.tool-head', {}, [
        h('h2.tool-title', { text: t('Lua API · {count} functions', { count: API_ENTRIES.length }) }),
        h('button.icon-btn', {
          type: 'button', text: '×', title: t('Close'), 'aria-label': t('Close'),
          onClick: () => this._dialog.close(),
        }),
      ]),

      h('div.tool-row.api-filters', {}, [
        h('input.input', {
          id: 'api-search',
          type: 'search',
          value: this._query,
          placeholder: t('Search by name or description…'),
          'aria-label': t('Search the API'),
          onInput: (event) => {
            this._query = event.target.value;
            this._renderResults();
          },
        }),
        h('select.input.select', {
          'aria-label': t('Filter by group'),
          onChange: (event) => {
            this._group = event.target.value;
            this._renderResults();
          },
        }, [
          h('option', { value: '', text: t('Every group') }),
          ...API_GROUPS.map((group) => h('option', {
            value: group, selected: group === this._group, text: t(group),
          })),
        ]),
      ]),

      h('div.api-body', {}, [this._list, this._detail]),
      h('p.tool-hint', { text: t('Generated from openapi.yaml, API {version}.', { version: API_VERSION }) }),
    ]);

    this._renderResults();
  }

  _renderResults() {
    const matches = search(this._query, this._group);

    if (!matches.length) {
      replaceChildren(this._list, [h('p.tool-hint', { text: t('Nothing matches that.') })]);
      replaceChildren(this._detail, []);
      return;
    }
    // Keep a selection that is still on screen; otherwise show the top hit, so
    // the detail pane is never blank while results exist.
    if (!matches.some((entry) => entry.name === this._selected)) {
      this._selected = matches[0].name;
    }

    replaceChildren(this._list, [
      ...matches.slice(0, MAX_RESULTS).map((entry) => h('button.api-item', {
        type: 'button',
        class: entry.name === this._selected ? 'is-active' : '',
        'aria-pressed': String(entry.name === this._selected),
        onClick: () => {
          this._selected = entry.name;
          this._renderResults();
        },
      }, [
        h('span.api-item-name', { text: entry.name }),
        h('span.api-item-group', { text: t(entry.group) }),
      ])),
      matches.length > MAX_RESULTS
        ? h('p.tool-hint', {
          text: t('…and {count} more. Narrow the search.', { count: matches.length - MAX_RESULTS }),
        })
        : null,
    ]);

    this._renderDetail(matches.find((entry) => entry.name === this._selected));
  }

  /** @param {import('../domain/api-catalog.js').ApiEntry | undefined} entry */
  _renderDetail(entry) {
    if (!entry) {
      replaceChildren(this._detail, []);
      return;
    }

    replaceChildren(this._detail, [
      h('h3.api-name', { text: entry.name }),
      h('p.api-kind', { text: `${t(describeKind(entry.kind))} · ${t(entry.group)}` }),
      h('pre.api-signature', {}, [h('code', { text: entry.signature })]),
      h('p.api-summary', { text: entry.summary }),

      entry.params.length
        ? h('div.api-params', {}, [
          h('h4.api-subhead', { text: t('Arguments') }),
          h('ul', {}, entry.params.map((param) => h('li', {}, [
            h('code', { text: param.name }),
            h('span.api-type', { text: param.type }),
            param.required ? null : h('span.api-optional', { text: t('optional') }),
            param.description ? h('span', { text: ` — ${param.description}` }) : null,
          ]))),
        ])
        : h('p.api-summary', { text: t('Takes no arguments.') }),

      h('p.api-returns', {
        text: entry.returns === 'void' ? t('Returns nothing.') : t('Returns {type}.', { type: entry.returns }),
      }),

      h('div.tool-actions', {}, [
        h('button.btn.btn-lcd', {
          type: 'button',
          text: t('Copy the name'),
          onClick: () => this._app.copyText(entry.name, t('Copied {name}.', { name: entry.name })),
        }),
        h('a.btn.btn-lcd.btn-quiet', {
          href: `${REFERENCE_URL}#${entry.name.toLowerCase()}`,
          target: '_blank',
          rel: 'noopener',
          text: t('Open the full reference'),
        }),
      ]),
    ]);
  }
}

/**
 * @param {string} kind
 * @returns {string}
 */
function describeKind(kind) {
  switch (kind) {
    case 'callback': return 'Your script implements this';
    case 'field': return 'A field your script sets';
    case 'action': return 'An action — at most one per frame';
    default: return 'A query — call it as often as you like';
  }
}

/**
 * Rank matches so a name hit always beats a description hit.
 *
 * @param {string} query
 * @param {string} group
 * @returns {import('../domain/api-catalog.js').ApiEntry[]}
 */
function search(query, group) {
  const needle = query.trim().toLowerCase();
  const pool = group ? API_ENTRIES.filter((entry) => entry.group === group) : API_ENTRIES;
  if (!needle) return [...pool];

  /** @type {Array<{ entry: object, rank: number }>} */
  const ranked = [];
  for (const entry of pool) {
    const name = entry.name.toLowerCase();
    if (name === needle) ranked.push({ entry, rank: 0 });
    else if (name.startsWith(needle)) ranked.push({ entry, rank: 1 });
    else if (name.includes(needle)) ranked.push({ entry, rank: 2 });
    else if (entry.summary.toLowerCase().includes(needle)) ranked.push({ entry, rank: 3 });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
    .map((match) => match.entry);
}
