/**
 * The link-graph workbench.
 *
 * Everything that operates on the map graph rather than on the script being
 * built: editing it by hand, saving it back out, checking that a route the
 * builder will need actually exists, and repairing an older script that still
 * calls the retired `moveToMap()`.
 *
 * It lives in a dialog because none of it is part of describing a run — you
 * open it, fix the map data, and go back to the form.
 */

import { convertMoveToMap } from '../domain/lua-rewrite.js';
import { h, must, replaceChildren } from './dom.js';

/** Datalist of the maps currently in the graph, for the route finder. */
const MAP_LIST_ID = 'link-graph-maps';

export class LinkGraphTools {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {import('./app.js').BuilderApp} app
   */
  constructor(dialog, app) {
    this._dialog = dialog;
    this._app = app;
    /** @type {HTMLTextAreaElement | null} */
    this._pasteBox = null;
    /** @type {HTMLTextAreaElement | null} */
    this._scriptBox = null;
    this._routeResult = h('div.tool-result', {});
    this._convertResult = h('div.tool-result', {});
  }

  /** Draw the dialog contents and show it. */
  open() {
    this._render();
    // `showModal` traps focus and adds the backdrop; a plain `show` would let
    // the form behind it keep taking keystrokes.
    this._dialog.showModal();
  }

  _render() {
    const stats = this._app.linkGraph.stats();
    this._pasteBox = /** @type {HTMLTextAreaElement} */ (h('textarea.input.tool-textarea', {
      rows: 5,
      spellcheck: 'false',
      placeholder: 'Viridian City\t12\t3\tViridian Forest',
      'aria-label': 'Link graph rows',
    }));
    this._scriptBox = /** @type {HTMLTextAreaElement} */ (h('textarea.input.tool-textarea', {
      rows: 6,
      spellcheck: 'false',
      placeholder: 'Paste a .lua script that still calls moveToMap()',
      'aria-label': 'Script to convert',
    }));

    replaceChildren(this._dialog, [
      h('header.tool-head', {}, [
        h('h2.tool-title', { text: 'Link graph' }),
        h('button.icon-btn', {
          type: 'button', text: '×', title: 'Close', 'aria-label': 'Close',
          onClick: () => this._dialog.close(),
        }),
      ]),

      h('p.tool-lead', {
        text: this._app.linkGraph.isEmpty
          ? 'Nothing loaded. The bot writes maps-cache/link_graph.txt as it walks between maps.'
          : `${stats.maps} maps, ${stats.edges} connections, ${stats.cells} warp cells.`,
      }),

      this._renderSection('Edit by hand', [
        h('p.tool-hint', {
          text: 'One connection per line: from map, x, y, to map — separated by tabs.',
        }),
        this._pasteBox,
        h('div.tool-actions', {}, [
          h('button.btn.btn-lcd', {
            type: 'button', text: 'Add these rows',
            onClick: () => this._applyPaste((text) => this._app.mergeLinkGraph(text)),
          }),
          h('button.btn.btn-lcd.btn-quiet', {
            type: 'button', text: 'Replace everything',
            onClick: () => this._applyPaste((text) => this._app.replaceLinkGraph(text)),
          }),
          h('button.btn.btn-lcd.btn-quiet', {
            type: 'button', text: 'Export link_graph.txt',
            onClick: () => this._app.exportLinkGraph(),
          }),
        ]),
      ]),

      this._renderSection('Check a route', [
        h('p.tool-hint', { text: 'The same search the builder runs when it plans a Pokécenter loop.' }),
        h('div.tool-row', {}, [
          h('input.input', {
            id: 'route-from', type: 'text', list: MAP_LIST_ID,
            placeholder: 'From', 'aria-label': 'Route start',
          }),
          h('input.input', {
            id: 'route-to', type: 'text', list: MAP_LIST_ID,
            placeholder: 'To', 'aria-label': 'Route end',
          }),
          h('button.btn.btn-lcd', {
            type: 'button', text: 'Find', onClick: () => this._findRoute(),
          }),
        ]),
        this._mapDatalist(),
        this._routeResult,
      ]),

      this._renderSection('Repair an older script', [
        h('p.tool-hint', {
          text: 'moveToMap() is retired: the host aborts any script that calls it. '
            + 'Each call is replaced with the warp cell that leads there, wherever the '
            + 'script says which map it is standing on.',
        }),
        this._scriptBox,
        h('div.tool-actions', {}, [
          h('button.btn.btn-lcd', {
            type: 'button', text: 'Convert', onClick: () => this._convert(),
          }),
        ]),
        this._convertResult,
      ]),
    ]);

    replaceChildren(this._routeResult, []);
    replaceChildren(this._convertResult, []);
  }

  /**
   * @param {string} title
   * @param {Array<Node | null>} children
   * @returns {HTMLElement}
   */
  _renderSection(title, children) {
    return h('section.tool-section', {}, [h('h3.tool-subtitle', { text: title }), ...children]);
  }

  /** @returns {HTMLElement} */
  _mapDatalist() {
    return h('datalist', { id: MAP_LIST_ID }, this._app.linkGraph.mapNames().map(
      (name) => h('option', { value: name }),
    ));
  }

  /**
   * @param {(text: string) => boolean} apply
   */
  _applyPaste(apply) {
    const text = this._pasteBox?.value ?? '';
    if (!text.trim()) {
      this._app.toast('Nothing pasted yet.', 'error');
      return;
    }
    if (apply(text)) this._render();
  }

  _findRoute() {
    const from = /** @type {HTMLInputElement} */ (must('#route-from', this._dialog)).value.trim();
    const to = /** @type {HTMLInputElement} */ (must('#route-to', this._dialog)).value.trim();
    const graph = this._app.linkGraph;

    if (!from || !to) {
      this._showResult(this._routeResult, 'error', 'Name both ends of the route.');
      return;
    }
    for (const [label, name] of [['Start', from], ['Destination', to]]) {
      if (!graph.hasMap(name)) {
        this._showResult(this._routeResult, 'error', `${label} "${name}" is not in the link graph.`);
        return;
      }
    }

    const path = graph.findRoute(from, to);
    if (!path) {
      this._showResult(this._routeResult, 'error', `No path from "${from}" to "${to}".`);
      return;
    }
    if (path.length === 1) {
      this._showResult(this._routeResult, 'ok', 'Both ends are the same map — no travel needed.');
      return;
    }

    const hops = graph.hopsFor(path);
    replaceChildren(this._routeResult, [
      h('p.tool-ok', { text: `${hops.length} hop${hops.length === 1 ? '' : 's'}:` }),
      h('ol.tool-hops', {}, hops.map((hop) => h('li', {}, [
        h('code', { text: `moveToCell(${hop.x}, ${hop.y})` }),
        h('span', { text: ` on ${hop.from} → ${hop.to}` }),
      ]))),
    ]);
  }

  _convert() {
    const source = this._scriptBox?.value ?? '';
    if (!source.trim()) {
      this._showResult(this._convertResult, 'error', 'Paste a script first.');
      return;
    }
    if (this._app.linkGraph.isEmpty) {
      this._showResult(this._convertResult, 'error', 'Load a link graph before converting.');
      return;
    }

    const result = convertMoveToMap(source, this._app.linkGraph);
    if (!result.converted && !result.skipped.length) {
      this._showResult(this._convertResult, 'ok', 'No moveToMap() calls in that script — nothing to do.');
      return;
    }

    const output = /** @type {HTMLTextAreaElement} */ (h('textarea.input.tool-textarea', {
      rows: 8, spellcheck: 'false', readonly: true, 'aria-label': 'Converted script',
    }));
    output.value = result.lua;

    replaceChildren(this._convertResult, [
      h('p.tool-ok', {
        text: `Replaced ${result.converted} call${result.converted === 1 ? '' : 's'}.`
          + (result.skipped.length ? ` ${result.skipped.length} left alone:` : ''),
      }),
      result.skipped.length
        ? h('ul.tool-notes', {}, result.skipped.map((note) => h('li', {
          text: `Line ${note.line}, moveToMap("${note.target}"): ${note.reason}.`,
        })))
        : null,
      output,
      h('div.tool-actions', {}, [
        h('button.btn.btn-lcd', {
          type: 'button',
          text: 'Copy',
          onClick: () => this._app.copyText(result.lua, 'Converted script copied.'),
        }),
      ]),
    ]);
  }

  /**
   * @param {HTMLElement} target
   * @param {'ok' | 'error'} tone
   * @param {string} message
   */
  _showResult(target, tone, message) {
    replaceChildren(target, [h(tone === 'ok' ? 'p.tool-ok' : 'p.tool-error', { text: message })]);
  }
}
