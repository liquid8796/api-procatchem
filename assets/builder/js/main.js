/**
 * Entry point: mount the builder and bind the toolbar.
 */

import { TEMPLATES } from './domain/templates.js';
import { ApiBrowser } from './ui/api-browser.js';
import { BuilderApp } from './ui/app.js';
import { h, must, prefersReducedMotion, replaceChildren } from './ui/dom.js';
import { LinkGraphTools } from './ui/link-graph-tools.js';
import { StructureDiagram } from './ui/structure-diagram.js';
import { installThemeToggle } from './ui/theme.js';

const app = new BuilderApp({
  panels: must('#panels'),
  output: must('#code-out'),
  lint: must('#lint'),
  status: must('#code-status'),
  graph: must('#graph-status'),
  toasts: must('#toasts'),
});

app.start();
app.restorePreviewVisibility();

/**
 * @param {string} selector
 * @param {(event: Event) => void} handler
 */
function on(selector, handler) {
  must(selector).addEventListener('click', handler);
}

on('#btn-copy', () => app.copy());
on('#btn-download', () => app.download());
on('#btn-export', () => app.exportConfig());
on('#btn-reset', () => {
  if (confirm('Reset every setting back to the defaults?')) app.reset();
});
on('#btn-clear-graph', () => app.clearLinkGraph());

const graphTools = new LinkGraphTools(
  /** @type {HTMLDialogElement} */ (must('#graph-dialog')),
  app,
);
on('#btn-graph-tools', () => graphTools.open());

const apiBrowser = new ApiBrowser(/** @type {HTMLDialogElement} */ (must('#api-dialog')), app);
on('#btn-api-browser', () => apiBrowser.open());

const structure = new StructureDiagram(
  /** @type {HTMLDialogElement} */ (must('#structure-dialog')),
  () => app.result,
  () => app.config,
);
on('#btn-structure', () => structure.open());

installThemeToggle(must('#btn-theme'));

// The template picker describes the highlighted entry, so the choice can be
// made without loading each one to find out what it does.
const templatePicker = /** @type {HTMLSelectElement} */ (must('#template-picker'));
const templateAbout = must('#template-about');
replaceChildren(templatePicker, TEMPLATES.map(
  (template) => h('option', { value: template.id, text: template.label }),
));
const describeTemplate = () => {
  const chosen = TEMPLATES.find((template) => template.id === templatePicker.value);
  templateAbout.textContent = chosen?.description ?? '';
};
templatePicker.addEventListener('change', describeTemplate);
describeTemplate();

on('#btn-template', () => {
  const chosen = TEMPLATES.find((template) => template.id === templatePicker.value);
  if (!chosen) return;
  if (confirm(`Replace everything with the "${chosen.label}" template?`)) {
    app.loadTemplate(chosen.id);
  }
});
on('#btn-toggle-preview', () => app.togglePreview());
on('#btn-hide-preview', () => app.togglePreview(true));

bindFilePicker('#btn-import', '#file-import', (file) => app.importConfig(file));
bindFilePicker('#btn-load-graph', '#file-graph', (file) => app.importLinkGraph(file));

/**
 * Wire a button to a hidden file input.
 *
 * The input is reset after each pick so choosing the same file twice still
 * fires a change event.
 *
 * @param {string} buttonSelector
 * @param {string} inputSelector
 * @param {(file: File) => void | Promise<void>} handler
 */
function bindFilePicker(buttonSelector, inputSelector, handler) {
  const button = must(buttonSelector);
  const input = /** @type {HTMLInputElement} */ (must(inputSelector));

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await handler(file);
    } catch (error) {
      app.toast(`Could not read that file: ${error.message}`, 'error');
    }
  });
}

// Accept a link_graph.txt or a generated .lua dropped anywhere on the page.
const dropZone = document.body;
let dragDepth = 0;

dropZone.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add('is-dropping');
});

dropZone.addEventListener('dragover', (event) => {
  if (hasFiles(event)) event.preventDefault();
});

dropZone.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropZone.classList.remove('is-dropping');
});

dropZone.addEventListener('drop', async (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove('is-dropping');

  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  try {
    // A .txt is a link graph; anything else is treated as a config source.
    if (/\.txt$/i.test(file.name)) await app.importLinkGraph(file);
    else await app.importConfig(file);
  } catch (error) {
    app.toast(`Could not read that file: ${error.message}`, 'error');
  }
});

/**
 * @param {DragEvent} event
 * @returns {boolean}
 */
function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

// Reveal panels as they scroll into view, unless the visitor opted out.
if (!prefersReducedMotion() && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -6% 0px' });

  const watch = () => {
    for (const panel of document.querySelectorAll('.panel:not(.in)')) {
      panel.classList.add('rv');
      observer.observe(panel);
    }
  };
  watch();
  // Panels are re-created on every render, so keep observing new ones.
  new MutationObserver(watch).observe(must('#panels'), { childList: true });
}
