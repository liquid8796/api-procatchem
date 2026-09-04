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

import { t } from '../core/i18n.js';
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
    this._planResult = h('div.tool-result', {});
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
      'aria-label': t('Link graph rows'),
    }));
    this._scriptBox = /** @type {HTMLTextAreaElement} */ (h('textarea.input.tool-textarea', {
      rows: 6,
      spellcheck: 'false',
      placeholder: t('Paste a .lua script that still calls moveToMap()'),
      'aria-label': t('Script to convert'),
    }));

    replaceChildren(this._dialog, [
      h('header.tool-head', {}, [
        h('h2.tool-title', { text: t('Link graph') }),
        h('button.icon-btn', {
          type: 'button', text: '×', title: t('Close'), 'aria-label': t('Close'),
          onClick: () => this._dialog.close(),
        }),
      ]),

      h('p.tool-lead', {
        text: this._app.linkGraph.isEmpty
          ? t('Nothing loaded. The bot writes maps-cache/link_graph.txt as it walks between maps.')
          : t('{maps} maps, {edges} connections, {cells} warp cells.', {
            maps: stats.maps, edges: stats.edges, cells: stats.cells,
          }),
      }),

      this._renderSection(t('Edit by hand'), [
        h('p.tool-hint', {
          text: t('One connection per line: from map, x, y, to map — separated by tabs.'),
        }),
        this._pasteBox,
        h('div.tool-actions', {}, [
          h('button.btn.btn-lcd', {
            type: 'button', text: t('Add these rows'),
            onClick: () => this._applyPaste((text) => this._app.mergeLinkGraph(text)),
          }),
          h('button.btn.btn-lcd.btn-quiet', {
            type: 'button', text: t('Replace everything'),
            onClick: () => this._applyPaste((text) => this._app.replaceLinkGraph(text)),
          }),
          h('button.btn.btn-lcd.btn-quiet', {
            type: 'button', text: t('Export link_graph.txt'),
            onClick: () => this._app.exportLinkGraph(),
          }),
        ]),
      ]),

      this._renderSection(t('Check a route'), [
        h('p.tool-hint', { text: t('The same search the builder runs when it plans a Pokécenter loop.') }),
        h('div.tool-row', {}, [
          h('input.input', {
            id: 'route-from', type: 'text', list: MAP_LIST_ID,
            placeholder: t('From'), 'aria-label': t('Route start'),
          }),
          h('input.input', {
            id: 'route-to', type: 'text', list: MAP_LIST_ID,
            placeholder: t('To'), 'aria-label': t('Route end'),
          }),
          h('button.btn.btn-lcd', {
            type: 'button', text: t('Find'), onClick: () => this._findRoute(),
          }),
        ]),
        this._mapDatalist(),
        this._routeResult,
        h('div.tool-actions', {}, [
          h('button.btn.btn-lcd.btn-quiet', {
            type: 'button',
            text: t('Check the route I have configured'),
            onClick: () => this._checkConfiguredRoute(),
          }),
        ]),
        this._planResult,
      ]),

      this._renderSection(t('Repair an older script'), [
        h('p.tool-hint', {
          text: t('moveToMap() is retired: the host aborts any script that calls it. '
            + 'Each call is replaced with the warp cell that leads there, wherever the '
            + 'script says which map it is standing on.'),
        }),
        this._scriptBox,
        h('div.tool-actions', {}, [
          h('button.btn.btn-lcd', {
            type: 'button', text: t('Convert'), onClick: () => this._convert(),
          }),
        ]),
        this._convertResult,
      ]),
    ]);

    replaceChildren(this._routeResult, []);
    replaceChildren(this._planResult, []);
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
      this._app.toast(t('Nothing pasted yet.'), 'error');
      return;
    }
    if (apply(text)) this._render();
  }

  /**
   * Walk every leg the current configuration plans, and cross-check them.
   *
   * The clock can move a run onto another period from wherever it happens to be
   * standing, so it is not enough for each leg to work on its own: every spot
   * has to be able to reach every Pokécenter. That is the failure that only
   * shows up hours later, when the bot stops moving at dusk.
   */
  _checkConfiguredRoute() {
    const plan = this._app.result?.plan;
    if (!plan || plan.kind !== 'route') {
      this._showResult(this._planResult, 'error', t('Switch the route style to "Pokécenter loop" first.'));
      return;
    }
    if (plan.problems.length) {
      replaceChildren(this._planResult, plan.problems.map(
        (problem) => h('p.tool-error', { text: problem }),
      ));
      return;
    }

    const graph = this._app.linkGraph;
    /** @type {Node[]} */
    const rows = [];
    for (const leg of plan.legs) {
      const label = leg.guard
        ? t('{when}: {farm} ← {centre}', {
          when: leg.guard.replace('()', ''), farm: leg.farmMap, centre: leg.pokecenterMap,
        })
        : t('All day: {farm} ← {centre}', { farm: leg.farmMap, centre: leg.pokecenterMap });
      rows.push(h('p.tool-ok', {
        text: leg.toFarm.length
          ? t('{label} — {count} hops out', { label, count: leg.toFarm.length })
          : t('{label} — same map, no walking', { label }),
      }));
    }

    for (const from of plan.legs) {
      for (const to of plan.legs) {
        if (from.pokecenterMap === to.pokecenterMap) continue;
        // What settles it is the table the script will read, not what the graph
        // could work out given a search the script has no way to run.
        if (to.toHeal.some((hop) => hop.from === from.farmMap)) continue;
        rows.push(h('p.tool-error', {
          text: t('No way from "{from}" to "{to}" — the run is stuck when the clock switches.', {
            from: from.farmMap, to: to.pokecenterMap,
          }),
        }));
      }
    }

    // Only worth saying when there was actually something to cross-check.
    if (plan.legs.length > 1 && rows.length === plan.legs.length) {
      rows.push(h('p.tool-ok', { text: t('Every spot can reach every Pokécenter.') }));
    }
    replaceChildren(this._planResult, rows);
  }

  _findRoute() {
    const from = /** @type {HTMLInputElement} */ (must('#route-from', this._dialog)).value.trim();
    const to = /** @type {HTMLInputElement} */ (must('#route-to', this._dialog)).value.trim();
    const graph = this._app.linkGraph;

    if (!from || !to) {
      this._showResult(this._routeResult, 'error', t('Name both ends of the route.'));
      return;
    }
    for (const [label, name] of [['Start', from], ['Destination', to]]) {
      if (!graph.hasMap(name)) {
        this._showResult(this._routeResult, 'error', t('{end} "{name}" is not in the link graph.', {
          end: t(label), name,
        }));
        return;
      }
    }

    const path = graph.findRoute(from, to);
    if (!path) {
      this._showResult(this._routeResult, 'error', t('No path from "{from}" to "{to}".', { from, to }));
      return;
    }
    if (path.length === 1) {
      this._showResult(this._routeResult, 'ok', t('Both ends are the same map — no travel needed.'));
      return;
    }

    const hops = graph.hopsFor(path);
    replaceChildren(this._routeResult, [
      h('p.tool-ok', {
        text: hops.length === 1 ? t('one hop:') : t('{count} hops:', { count: hops.length }),
      }),
      h('ol.tool-hops', {}, hops.map((hop) => h('li', {}, [
        h('code', { text: `moveToCell(${hop.x}, ${hop.y})` }),
        h('span', { text: ` ${t('on {from} → {to}', { from: hop.from, to: hop.to })}` }),
      ]))),
    ]);
  }

  _convert() {
    const source = this._scriptBox?.value ?? '';
    if (!source.trim()) {
      this._showResult(this._convertResult, 'error', t('Paste a script first.'));
      return;
    }
    if (this._app.linkGraph.isEmpty) {
      this._showResult(this._convertResult, 'error', t('Load a link graph before converting.'));
      return;
    }

    const result = convertMoveToMap(source, this._app.linkGraph);
    if (!result.converted && !result.skipped.length) {
      this._showResult(this._convertResult, 'ok', t('No moveToMap() calls in that script — nothing to do.'));
      return;
    }

    const output = /** @type {HTMLTextAreaElement} */ (h('textarea.input.tool-textarea', {
      rows: 8, spellcheck: 'false', readonly: true, 'aria-label': t('Converted script'),
    }));
    output.value = result.lua;

    const replaced = result.converted === 1
      ? t('Replaced one call.')
      : t('Replaced {count} calls.', { count: result.converted });
    replaceChildren(this._convertResult, [
      h('p.tool-ok', {
        text: replaced
          + (result.skipped.length ? ` ${t('{count} left alone:', { count: result.skipped.length })}` : ''),
      }),
      result.skipped.length
        ? h('ul.tool-notes', {}, result.skipped.map((note) => h('li', {
          text: `${t('Line {line}, moveToMap("{target}"):', { line: note.line, target: note.target })} ${note.reason}.`,
        })))
        : null,
      output,
      h('div.tool-actions', {}, [
        h('button.btn.btn-lcd', {
          type: 'button',
          text: t('Copy'),
          onClick: () => this._app.copyText(result.lua, t('Converted script copied.')),
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
