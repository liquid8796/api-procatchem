/**
 * The builder application.
 *
 * Wiring only: it owns the {@link Store}, renders the panels, regenerates the
 * preview whenever state changes, and handles the file/clipboard actions. All
 * script logic lives in `generators/`, all validation in `lint/`.
 */

import { Store } from '../core/store.js';
import { createDefaultConfig, normaliseConfig } from '../domain/config.js';
import { LinkGraph } from '../domain/link-graph.js';
import { generateScript, parseConfigHeader } from '../generators/index.js';
import { runLint } from '../lint/rules.js';
import {
  consumeFocusRequest,
  h,
  must,
  prefersReducedMotion,
  rafThrottle,
  replaceChildren,
} from './dom.js';
import { renderHighlightedLua } from './highlight.js';
import { PANELS } from './panels.js';

const DRAFT_KEY = 'procatchem-script-builder-draft-v1';
const GRAPH_KEY = 'procatchem-script-builder-linkgraph-v1';
const PREVIEW_KEY = 'procatchem-script-builder-preview-hidden-v1';
const TOAST_MS = 2600;
const SEVERITY_ICON = { error: '✕', warning: '!', info: 'i' };

export class BuilderApp {
  /**
   * @param {{ panels: HTMLElement, output: HTMLElement, lint: HTMLElement,
   *           status: HTMLElement, graph: HTMLElement, toasts: HTMLElement }} mounts
   */
  constructor(mounts) {
    this._mounts = mounts;
    this._store = new Store(loadDraft());
    this._linkGraph = loadGraph();
    /** @type {import('../generators/index.js').GenerationResult | null} */
    this._result = null;
    this._refresh = rafThrottle(() => this._render());
  }

  /** Render once and start listening for changes. */
  start() {
    this._store.subscribe(() => {
      saveDraft(this._store.state);
      this._refresh();
    });
    this._render();
  }

  // ---------------------------------------------------------------- rendering

  _render() {
    let generation;
    try {
      generation = generateScript(this._store.state, this._linkGraph);
    } catch (error) {
      this._renderFatal(error);
      return;
    }
    this._result = generation;

    this._renderPanels(generation.mode);
    this._renderOutput(generation);
    this._renderLint(generation);
    this._renderGraphStatus();
  }

  /**
   * A generator bug must not leave the page blank and silent.
   *
   * @param {Error} error
   */
  _renderFatal(error) {
    this._result = null;
    replaceChildren(this._mounts.lint, [
      h('div.finding.finding-error', {}, [
        h('span.finding-icon', { text: '✕' }),
        h('span.finding-text', { text: `Generation failed: ${error.message}` }),
      ]),
    ]);
    // Surface the stack for a bug report rather than swallowing it.
    console.error('Script generation failed', error);
  }

  /** @param {import('../generators/mode-registry.js').FarmMode} mode */
  _renderPanels(mode) {
    const config = this._store.state;
    const active = document.activeElement;
    // An explicit request wins: a control that reordered its own rows knows
    // better than "whatever happened to be focused" which element to return to.
    const requested = consumeFocusRequest();
    const focusPath = requested ?? (active instanceof HTMLElement ? active.id || null : null);
    const selectionStart = !requested && active instanceof HTMLInputElement
      ? active.selectionStart
      : null;

    replaceChildren(this._mounts.panels, PANELS
      .filter((panel) => !panel.visibleWhen || panel.visibleWhen(config, mode))
      .map((panel, index) => h('section.panel', { id: `panel-${panel.id}`, style: `--i:${index}` }, [
        h('header.panel-head', {}, [
          h('span.panel-icon', { 'aria-hidden': 'true', text: panel.icon }),
          h('div.panel-titles', {}, [
            h('h2.panel-title', { text: panel.title }),
            h('p.panel-sub', { text: panel.subtitle }),
          ]),
        ]),
        h('div.panel-body', {}, panel.build(this._store, mode)),
      ])));

    // Re-rendering the panel list drops focus; put the caret back so typing
    // into a text field is not interrupted on every keystroke.
    if (!focusPath) return;
    const restored = document.getElementById(focusPath);
    if (!(restored instanceof HTMLElement)) return;
    restored.focus({ preventScroll: true });
    if (restored instanceof HTMLInputElement && selectionStart !== null && restored.type !== 'number') {
      try {
        restored.setSelectionRange(selectionStart, selectionStart);
      } catch {
        // Some input types forbid selection ranges; focus alone is enough.
      }
    }
  }

  /** @param {import('../generators/index.js').GenerationResult} generation */
  _renderOutput(generation) {
    renderHighlightedLua(this._mounts.output, generation.document);

    const lineCount = generation.document.split('\n').length;
    const verified = generation.unknownCalls.length === 0 && generation.retiredCalls.length === 0;

    replaceChildren(this._mounts.status, [
      h('span.stat-pill', {}, [
        h('b', { text: String(generation.hostCalls.length) }),
        h('span', { text: 'API calls' }),
      ]),
      h('span.stat-pill', {}, [
        h('b', { text: String(lineCount) }),
        h('span', { text: 'lines' }),
      ]),
      h('span.stat-pill', {
        class: verified ? 'stat-ok' : 'stat-bad',
        title: verified
          ? 'Every function this script calls exists in the Lua API.'
          : `Unresolved: ${[...generation.unknownCalls, ...generation.retiredCalls].join(', ')}`,
      }, [
        h('b', { text: verified ? '✓' : '✕' }),
        h('span', { text: verified ? 'API verified' : 'API mismatch' }),
      ]),
    ]);

    if (!prefersReducedMotion()) {
      const screen = this._mounts.output.closest('.screen');
      if (screen) {
        screen.classList.remove('flash');
        // Force a reflow so the animation restarts on every regeneration.
        void screen.offsetWidth;
        screen.classList.add('flash');
      }
    }
  }

  /** @param {import('../generators/index.js').GenerationResult} generation */
  _renderLint(generation) {
    const findings = runLint({
      config: this._store.state,
      plan: generation.plan,
      mode: generation.mode,
      zones: generation.zones,
      team: generation.team,
      unknownCalls: generation.unknownCalls,
      retiredCalls: generation.retiredCalls,
    });

    if (!findings.length) {
      replaceChildren(this._mounts.lint, [
        h('div.finding.finding-ok', {}, [
          h('span.finding-icon', { text: '✓' }),
          h('span.finding-text', { text: 'No problems found — this script is ready to run.' }),
        ]),
      ]);
      return;
    }

    replaceChildren(this._mounts.lint, findings.map((item) => {
      const jump = item.panel ? document.getElementById(`panel-${item.panel}`) : null;
      return h(jump ? 'button.finding' : 'div.finding', {
        class: `finding-${item.level}`,
        type: jump ? 'button' : undefined,
        title: jump ? 'Jump to the setting' : undefined,
        onClick: jump
          ? () => {
            jump.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
            jump.classList.remove('pulse');
            void jump.offsetWidth;
            jump.classList.add('pulse');
          }
          : undefined,
      }, [
        h('span.finding-icon', { text: SEVERITY_ICON[item.level] ?? '•' }),
        h('span.finding-text', { text: item.message }),
      ]);
    }));
  }

  _renderGraphStatus() {
    const graph = this._linkGraph;
    const loaded = !graph.isEmpty;
    const stats = graph.stats();

    replaceChildren(this._mounts.graph, [
      h('span.graph-dot', { class: loaded ? 'is-on' : '', 'aria-hidden': 'true' }),
      h('span.graph-text', {
        text: loaded
          ? `Link graph: ${stats.maps} maps, ${stats.cells} warp cells`
          : 'No link graph loaded — Pokécenter routes are unavailable',
      }),
    ]);
  }

  // ------------------------------------------------------------------ actions

  /** Copy the generated script to the clipboard. */
  async copy() {
    if (!this._result) return;
    await this.copyText(this._result.document, 'Script copied to the clipboard.');
  }

  /**
   * Copy arbitrary text, falling back to the old selection trick where the
   * async clipboard is unavailable (an insecure origin, or a file:// page).
   *
   * @param {string} text
   * @param {string} okMessage
   */
  async copyText(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast(okMessage, 'ok');
      return;
    } catch {
      // Fall through to the legacy path rather than reporting failure yet.
    }
    if (legacyCopy(text)) this.toast(okMessage, 'ok');
    else this.toast('Could not reach the clipboard — select the text and copy it manually.', 'error');
  }

  /** Download the generated script as a `.lua` file. */
  download() {
    if (!this._result) return;
    const name = sanitiseFileName(this._store.state.meta.fileName, 'script', '.lua');
    downloadText(name, this._result.document);
    this.toast(`Saved ${name}.`, 'ok');
  }

  /** Download the configuration on its own, for sharing a preset. */
  exportConfig() {
    const name = sanitiseFileName(this._store.state.meta.fileName, 'script', '.json');
    downloadText(name, JSON.stringify(this._store.state, null, 2));
    this.toast(`Saved ${name}.`, 'ok');
  }

  /**
   * Load a `.lua` produced by this builder, or a `.json` preset.
   *
   * @param {File} file
   */
  async importConfig(file) {
    const text = await file.text();
    const parsed = text.trimStart().startsWith('{')
      ? safeJsonParse(text)
      : parseConfigHeader(text);

    if (!parsed) {
      this.toast('That file has no builder configuration in it.', 'error');
      return;
    }
    this._store.replace(normaliseConfig(parsed));
    this.toast('Configuration loaded.', 'ok');
  }

  /**
   * Load a `link_graph.txt` exported by the bot's map cache.
   *
   * @param {File} file
   */
  async importLinkGraph(file) {
    this.replaceLinkGraph(await file.text());
  }

  /**
   * Replace the graph with what `text` describes.
   *
   * @param {string} text
   * @returns {boolean} whether anything usable was found
   */
  replaceLinkGraph(text) {
    const { graph, stats } = LinkGraph.parse(text);
    if (graph.isEmpty) {
      this.toast('No usable links in that text — is it maps-cache/link_graph.txt?', 'error');
      return false;
    }
    this._linkGraph = graph;
    saveGraph(graph.toText());
    this._refresh();

    const skipped = stats.skipped ? `, ${stats.skipped} lines skipped` : '';
    this.toast(`Loaded ${stats.maps} maps and ${stats.cells} warp cells${skipped}.`, 'ok');
    return true;
  }

  /**
   * Add links to what is already loaded.
   *
   * Merging goes through the serialised form so the existing graph's own
   * de-duplication decides what is genuinely new.
   *
   * @param {string} text
   * @returns {boolean} whether anything was added
   */
  mergeLinkGraph(text) {
    const before = this._linkGraph.cellCount;
    const { graph } = LinkGraph.parse(`${this._linkGraph.toText()}\n${text}`);
    const added = graph.cellCount - before;

    if (added <= 0) {
      this.toast(added === 0 ? 'Nothing new in that text.' : 'No usable links in that text.', 'error');
      return false;
    }
    this._linkGraph = graph;
    saveGraph(graph.toText());
    this._refresh();
    this.toast(`Added ${added} warp cell${added === 1 ? '' : 's'}.`, 'ok');
    return true;
  }

  /** Save the loaded graph back out as a `link_graph.txt`. */
  exportLinkGraph() {
    const text = this._linkGraph.toText();
    if (!text) {
      this.toast('Nothing to export — no link graph is loaded.', 'error');
      return;
    }
    downloadText('link_graph.txt', text);
    this.toast('Saved link_graph.txt.', 'ok');
  }

  /** @returns {LinkGraph} the graph the preview is generated against */
  get linkGraph() {
    return this._linkGraph;
  }

  /** Forget the loaded link graph. */
  clearLinkGraph() {
    this._linkGraph = new LinkGraph();
    saveGraph('');
    this._refresh();
    this.toast('Link graph cleared.', 'ok');
  }

  /**
   * Show or hide the generated-script screen.
   *
   * Only the code screen collapses: Copy, Download and Diagnostics stay on
   * screen, because hiding them would take away the actions the panel exists
   * to offer. The form column widens to use the space.
   *
   * @param {boolean} [hidden] omit to flip the current state
   * @returns {boolean} whether the screen is now hidden
   */
  togglePreview(hidden) {
    const next = hidden === undefined ? !isPreviewHidden() : Boolean(hidden);
    document.body.classList.toggle('preview-hidden', next);
    for (const button of document.querySelectorAll('#btn-toggle-preview')) {
      // The button reports whether the script is shown, not whether it is hidden.
      button.setAttribute('aria-pressed', String(!next));
      button.title = next ? 'Show the generated script' : 'Hide the generated script';
    }
    try {
      localStorage.setItem(PREVIEW_KEY, next ? '1' : '0');
    } catch {
      // Remembering the choice is a convenience, never a requirement.
    }
    return next;
  }

  /** Apply the remembered preview visibility. */
  restorePreviewVisibility() {
    this.togglePreview(isPreviewHidden());
  }

  /** Reset every setting back to the defaults. */
  reset() {
    this._store.replace(createDefaultConfig());
    this.toast('Reset to the default configuration.', 'ok');
  }

  /**
   * Show a transient message.
   *
   * @param {string} message
   * @param {'ok' | 'error'} [tone]
   */
  toast(message, tone = 'ok') {
    const node = h('div.toast', { class: `toast-${tone}`, role: 'status' }, [
      h('span.toast-icon', { 'aria-hidden': 'true', text: tone === 'ok' ? '✓' : '!' }),
      h('span', { text: message }),
    ]);
    this._mounts.toasts.appendChild(node);

    const remove = () => node.remove();
    if (prefersReducedMotion()) {
      setTimeout(remove, TOAST_MS);
      return;
    }
    setTimeout(() => {
      node.classList.add('is-leaving');
      node.addEventListener('animationend', remove, { once: true });
      // Guard against the animation never firing (e.g. a hidden tab).
      setTimeout(remove, 600);
    }, TOAST_MS);
  }
}

// -------------------------------------------------------------- persistence

/** @returns {boolean} whether the preview was hidden last time */
function isPreviewHidden() {
  try {
    return localStorage.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

/** @returns {object} the saved draft, or a fresh default config */
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? normaliseConfig(JSON.parse(raw)) : createDefaultConfig();
  } catch {
    // Private browsing, a quota error, or a corrupt draft: start clean.
    return createDefaultConfig();
  }
}

/** @param {object} config */
function saveDraft(config) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
  } catch {
    // Persisting the draft is a convenience, never a requirement.
  }
}

/** @returns {LinkGraph} */
function loadGraph() {
  try {
    const raw = localStorage.getItem(GRAPH_KEY);
    return raw ? LinkGraph.parse(raw).graph : new LinkGraph();
  } catch {
    return new LinkGraph();
  }
}

/** @param {string} text */
function saveGraph(text) {
  try {
    if (text) localStorage.setItem(GRAPH_KEY, text);
    else localStorage.removeItem(GRAPH_KEY);
  } catch {
    // Same as the draft: best effort only.
  }
}

// ------------------------------------------------------------------ helpers

/**
 * @param {string} text
 * @returns {object | null}
 */
function safeJsonParse(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Strip path separators and characters Windows rejects, then apply exactly one
 * extension — the user's `.lua`/`.json` suffix is replaced rather than appended
 * to, so exporting a preset named `run.json` does not produce `run.json.json`.
 *
 * @param {string} raw
 * @param {string} fallbackBase used when nothing usable remains
 * @param {string} extension including the leading dot
 * @returns {string}
 */
function sanitiseFileName(raw, fallbackBase, extension) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_');
  const base = cleaned.replace(/\.(lua|json)$/i, '').replace(/^[._]+|[._]+$/g, '');
  return `${base || fallbackBase}${extension}`;
}

/**
 * @param {string} fileName
 * @param {string} text
 */
function downloadText(fileName, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Clipboard fallback for browsers that refuse `navigator.clipboard`.
 *
 * @param {string} text
 * @returns {boolean} whether the copy succeeded
 */
function legacyCopy(text) {
  const area = h('textarea', { style: 'position:fixed;opacity:0;pointer-events:none' });
  area.value = text;
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
