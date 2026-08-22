/**
 * Unit tests for the map link graph.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';

const SAMPLE = [
  'PROCATCHEM-LINKGRAPH\tv1',
  'Pokecenter Viridian\t9\t14\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
  'Viridian Forest\t11\t2\tPewter City',
].join('\n');

test('parse reads a well-formed file', () => {
  const { graph, stats } = LinkGraph.parse(SAMPLE);
  assert.equal(stats.skipped, 0);
  assert.equal(stats.maps, 4);
  assert.equal(stats.edges, 5);
  assert.equal(graph.isEmpty, false);
});

test('parse skips the header and blank lines without counting them as errors', () => {
  const { stats } = LinkGraph.parse(`${SAMPLE}\n\n\n`);
  assert.equal(stats.skipped, 0);
});

test('parse counts malformed records instead of throwing', () => {
  const { graph, stats } = LinkGraph.parse(
    ['A\t1\t2\tB', 'garbage line', 'C\tnot-a-number\t2\tD', 'E\t3'].join('\n'),
  );
  assert.equal(stats.skipped, 3);
  assert.equal(graph.edgeCount, 1);
});

test('parse tolerates tabs flattened into runs of spaces', () => {
  const { graph, stats } = LinkGraph.parse('Viridian City   12 3   Viridian Forest');
  assert.equal(stats.skipped, 0);
  assert.deepEqual(graph.hopCell('Viridian City', 'Viridian Forest'), { x: 12, y: 3 });
});

test('parse handles an empty or nullish input', () => {
  assert.equal(LinkGraph.parse('').graph.isEmpty, true);
  assert.equal(LinkGraph.parse(null).graph.isEmpty, true);
  assert.equal(LinkGraph.parse(undefined).graph.isEmpty, true);
});

test('map lookup is case-insensitive but keeps the stored casing', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.equal(graph.hasMap('viridian CITY'), true);
  assert.equal(graph.resolveName('  viridian forest '), 'Viridian Forest');
  assert.equal(graph.resolveName('Nowhere'), null);
});

test('findRoute returns the shortest path including both endpoints', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.deepEqual(
    graph.findRoute('Pokecenter Viridian', 'Pewter City'),
    ['Pokecenter Viridian', 'Viridian City', 'Viridian Forest', 'Pewter City'],
  );
});

test('findRoute on the same map returns a single-element path', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.deepEqual(graph.findRoute('Viridian City', 'viridian city'), ['Viridian City']);
});

test('findRoute returns null for unknown or unreachable maps', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.equal(graph.findRoute('Viridian City', 'Cinnabar Island'), null);
  assert.equal(graph.findRoute('Nowhere', 'Viridian City'), null);
  assert.equal(graph.findRoute('', 'Viridian City'), null);
  // Pewter City is only ever a destination, so nothing leaves it.
  assert.equal(graph.findRoute('Pewter City', 'Viridian City'), null);
});

test('findRoute prefers the shorter of two candidate paths', () => {
  const { graph } = LinkGraph.parse(
    ['A\t1\t1\tB', 'B\t1\t1\tC', 'C\t1\t1\tD', 'A\t2\t2\tD'].join('\n'),
  );
  assert.deepEqual(graph.findRoute('A', 'D'), ['A', 'D']);
});

test('hopsFor turns a path into moveToCell coordinates', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  const path = graph.findRoute('Pokecenter Viridian', 'Viridian Forest');
  assert.deepEqual(graph.hopsFor(path), [
    { from: 'Pokecenter Viridian', to: 'Viridian City', x: 9, y: 14 },
    { from: 'Viridian City', to: 'Viridian Forest', x: 12, y: 3 },
  ]);
});

test('hopsFor on a single-map path yields no hops', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.deepEqual(graph.hopsFor(['Viridian City']), []);
});

test('hopsFor throws when an edge has no recorded cell', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.throws(
    () => graph.hopsFor(['Viridian City', 'Pewter City']),
    /No warp cell recorded/,
  );
});

test('duplicate cells are ignored but distinct ones are kept in a stable order', () => {
  const graph = new LinkGraph();
  assert.equal(graph.addLink('A', 5, 5, 'B'), true);
  assert.equal(graph.addLink('A', 5, 5, 'B'), true);
  assert.equal(graph.addLink('A', 1, 9, 'B'), true);
  assert.equal(graph.cellCount, 2);
  assert.equal(graph.edgeCount, 1);
  // Lowest x wins, so output is deterministic across reloads.
  assert.deepEqual(graph.hopCell('A', 'B'), { x: 1, y: 9 });
});

test('addLink rejects malformed records', () => {
  const graph = new LinkGraph();
  assert.equal(graph.addLink('', 1, 2, 'B'), false);
  assert.equal(graph.addLink('A', 1, 2, ''), false);
  assert.equal(graph.addLink('A', NaN, 2, 'B'), false);
  assert.equal(graph.addLink('A', 1.5, 2, 'B'), false);
  assert.equal(graph.isEmpty, true);
});

test('negative coordinates are accepted', () => {
  const graph = new LinkGraph();
  assert.equal(graph.addLink('A', -3, -7, 'B'), true);
  assert.deepEqual(graph.hopCell('A', 'B'), { x: -3, y: -7 });
});

test('neighbours lists one-hop destinations alphabetically', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.deepEqual(graph.neighbours('Viridian Forest'), ['Pewter City', 'Viridian City']);
  assert.deepEqual(graph.neighbours('Pewter City'), []);
  assert.deepEqual(graph.neighbours('Nowhere'), []);
});

test('hopCell returns null for a missing edge and copies the stored cell', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  assert.equal(graph.hopCell('Viridian City', 'Pewter City'), null);
  const cell = graph.hopCell('Viridian City', 'Viridian Forest');
  cell.x = 999;
  assert.deepEqual(graph.hopCell('Viridian City', 'Viridian Forest'), { x: 12, y: 3 });
});

test('toText round-trips through parse', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  const { graph: reparsed, stats } = LinkGraph.parse(graph.toText());
  assert.equal(stats.skipped, 0);
  assert.equal(reparsed.edgeCount, graph.edgeCount);
  assert.equal(reparsed.cellCount, graph.cellCount);
  assert.deepEqual(reparsed.mapNames(), graph.mapNames());
});

test('toText of an empty graph is empty', () => {
  assert.equal(new LinkGraph().toText(), '');
});
