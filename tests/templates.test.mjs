/**
 * Starter templates must be complete, runnable configurations — a template
 * that generates a broken script is worse than a blank form.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { normaliseConfig } from '../assets/builder/js/domain/config.js';
import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { TEMPLATES, findTemplate } from '../assets/builder/js/domain/templates.js';
import { generateScript } from '../assets/builder/js/generators/index.js';
import { runLint } from '../assets/builder/js/lint/rules.js';

const { graph } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
].join('\n'));

/**
 * Fill in the values a template deliberately leaves to the player — map names
 * and unique ids — so the planners have something to work with.
 *
 * @param {object} config
 * @returns {object}
 */
function withPlayerValues(config) {
  if (config.route.kind === 'route') {
    config.route.farmMap = 'Viridian Forest';
    config.route.pokecenterMap = 'Pokecenter Viridian';
  }
  config.team.rotation.goals = config.team.rotation.goals.map((goal, index) => ({
    ...goal,
    id: goal.id || String(100 + index),
  }));
  return config;
}

test('every template has an id, a label, and a description', () => {
  assert.ok(TEMPLATES.length >= 4, 'too few templates to be a useful starting point');
  const ids = new Set();
  for (const template of TEMPLATES) {
    assert.ok(template.id, 'a template has no id');
    assert.equal(ids.has(template.id), false, `duplicate template id: ${template.id}`);
    ids.add(template.id);
    assert.ok(template.label.length > 0, `${template.id}: no label`);
    assert.ok(template.description.length > 10, `${template.id}: description too thin to help`);
  }
});

test('every template survives normalisation unchanged in shape', () => {
  for (const template of TEMPLATES) {
    const built = template.build();
    const normalised = normaliseConfig(built);
    assert.equal(normalised.mode, built.mode, `${template.id}: mode was rewritten`);
    assert.equal(
      normalised.route.endBehaviour,
      built.route.endBehaviour,
      `${template.id}: end behaviour was rewritten, so it is not a valid value`,
    );
  }
});

test('every template generates a script whose calls all resolve', () => {
  for (const template of TEMPLATES) {
    const config = normaliseConfig(withPlayerValues(template.build()));
    const result = generateScript(config, graph);
    assert.deepEqual(result.unknownCalls, [], `${template.id}: unresolved calls`);
    assert.deepEqual(result.retiredCalls, [], `${template.id}: calls a retired function`);
  }
});

test('no template starts you off with a lint error', () => {
  for (const template of TEMPLATES) {
    const config = normaliseConfig(withPlayerValues(template.build()));
    const result = generateScript(config, graph);
    const errors = runLint({
      config,
      plan: result.plan,
      mode: result.mode,
      zones: result.zones,
      team: result.team,
      unknownCalls: result.unknownCalls,
      retiredCalls: result.retiredCalls,
    }).filter((finding) => finding.level === 'error');

    assert.deepEqual(
      errors.map((finding) => finding.message),
      [],
      `${template.id}: loading this template shows an error straight away`,
    );
  }
});

test('building a template twice gives two independent configurations', () => {
  const [first, second] = [TEMPLATES[0].build(), TEMPLATES[0].build()];
  first.meta.name = 'changed';
  first.target.names.push('Larvitar');
  assert.notEqual(second.meta.name, 'changed');
  assert.deepEqual(second.target.names, []);
});

test('findTemplate resolves by id and reports a miss as null', () => {
  assert.equal(findTemplate(TEMPLATES[0].id)?.label, TEMPLATES[0].label);
  assert.equal(findTemplate('no-such-template'), null);
});
