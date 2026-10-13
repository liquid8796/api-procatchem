/**
 * Unit tests for the map link graph.
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';

const SAMPLE = [
  'PROCATCHEM-LINKGRAPH\tv2',
  'Pokecenter Viridian\t9\t14\tViridian City\t0\t0\tconfirmed\t2026-10-13T00:00:00Z',
  'Viridian City\t23\t8\tPokecenter Viridian\t0\t0\tconfirmed\t2026-10-13T00:00:00Z',
  'Viridian City\t12\t3\tViridian Forest\t0\t0\tconfirmed\t2026-10-13T00:00:00Z',
  'Viridian Forest\t14\t46\tViridian City\t0\t0\tconfirmed\t2026-10-13T00:00:00Z',
  'Viridian Forest\t11\t2\tPewter City\t0\t0\tconfirmed\t2026-10-13T00:00:00Z',
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
    ['A\t1\t2\tB\t0\t0\tconfirmed\t2026-10-13T00:00:00Z', 'garbage line', 'C\tnot-a-number\t2\tD', 'E\t3'].join('\n'),
  );
  assert.equal(stats.skipped, 3);
  assert.equal(graph.edgeCount, 1);
});

test('spaced v1 rows import as unverified and do not route', () => {
  const { graph, stats } = LinkGraph.parse('Viridian City   12 3   Viridian Forest');
  assert.equal(stats.skipped, 0);
  assert.equal(graph.hopCell('Viridian City', 'Viridian Forest'), null);
  assert.equal(stats.unverified, 1);
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
    ['A\t1\t1\tB\t0\t0\tconfirmed\t2026-10-13T00:00:00Z', 'B\t1\t1\tC\t0\t0\tconfirmed\t2026-10-13T00:00:00Z', 'C\t1\t1\tD\t0\t0\tconfirmed\t2026-10-13T00:00:00Z', 'A\t2\t2\tD\t0\t0\tconfirmed\t2026-10-13T00:00:00Z'].join('\n'),
  );
  assert.deepEqual(graph.findRoute('A', 'D'), ['A', 'D']);
});

test('hopsFor turns a path into moveToCell coordinates', () => {
  const { graph } = LinkGraph.parse(SAMPLE);
  const path = graph.findRoute('Pokecenter Viridian', 'Viridian Forest');
  assert.deepEqual(graph.hopsFor(path).map(({ from, to, x, y }) => ({ from, to, x, y })), [
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
  assert.equal(graph.addLink('A', 5, 5, 'B', 0, 0, true), true);
  assert.equal(graph.addLink('A', 5, 5, 'B', 0, 0, true), true);
  assert.equal(graph.addLink('A', 1, 9, 'B', 0, 0, true), true);
  assert.equal(graph.cellCount, 2);
  assert.equal(graph.edgeCount, 1);
  // Lowest x wins, so output is deterministic across reloads.
  assert.equal(graph.hopCell('A', 'B'), null, 'two warp cells to one map are ambiguous');
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
  assert.equal(graph.addLink('A', -3, -7, 'B', 0, 0, true), true);
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

const V2 = [
  'PROCATCHEM-LINKGRAPH\tv2',
  'Mt. Moon 1F\t12\t4\tMt. Moon 1F\t58\t33\tconfirmed\t2026-10-13T04:03:00.1234567Z',
  'Mt. Moon 1F\t28\t9\tMt. Moon 1F\t21\t20\tconfirmed\t2026-10-13T04:04:00.1234567Z',
  'Mt. Moon 1F\t38\t63\tRoute 3\t84\t16\tconfirmed\t2026-10-13T04:05:00.1234567Z',
  'Route 3\t84\t16\tMt. Moon 1F\t38\t63\tlegacy-unknown\t0001-01-01T00:00:00.0000000Z',
].join('\n');

test('v2: same-name cave warp edges preserve destination spawn and timestamp', () => {
  const { graph, stats } = LinkGraph.parse(V2);
  assert.equal(stats.skipped, 0);
  assert.equal(stats.cells, 4);
  assert.equal(stats.confirmed, 3);
  assert.equal(stats.unverified, 1);
  assert.equal(stats.sameMap, 2);
  const same = graph.allEdges().filter((edge) => edge.from === edge.to);
  assert.equal(same.length, 2);
  assert.deepEqual(same.map((e) => [e.toX,e.toY]), [[58,33], [21,20]]);
  const parsed = LinkGraph.parse(graph.toText());
  assert.equal(parsed.stats.skipped, 0);
  assert.deepEqual(parsed.graph.allEdges(), graph.allEdges());
  assert.match(graph.toText(), /PROCATCHEM-LINKGRAPH\tv2/);
});

test('v2: cave self-links cannot be collapsed into a name-based Lua route', () => {
  const { graph } = LinkGraph.parse(V2);
  assert.equal(graph.hasSameMapWarp('Mt. Moon 1F'), true);
  assert.equal(graph.findRoute('Mt. Moon 1F', 'Route 3'), null);
  assert.equal(graph.hopCell('Mt. Moon 1F', 'Route 3'), null);
  assert.equal(graph.findRoute('Mt. Moon 1F', 'Mt. Moon 1F'), null);
});

test('v1 migration: unknown destination spawn is never reported as a safe route', () => {
  const { graph, stats } = LinkGraph.parse(
    'PROCATCHEM-LINKGRAPH\tv1\nA\t2\t3\tB\nB\t4\t5\tA');
  assert.equal(stats.skipped, 0);
  assert.equal(stats.unverified, 2);
  assert.equal(graph.hopCell('A', 'B'), null);
  assert.equal(graph.findRoute('A', 'B'), null);
  assert.match(graph.toText(), /A\t2\t3\tB\t-1\t-1\tlegacy-unknown/);
});

test('v2: confirmed arrival upgrades a legacy source cell without duplication', () => {
  const { graph } = LinkGraph.parse('A\t2\t3\tB');
  graph.addLink('A', 2, 3, 'B', 10, 11, true, '2026-10-13T00:00:00Z');
  assert.equal(graph.cellCount, 1);
  assert.equal(graph.stats().confirmed, 1);
  assert.deepEqual(graph.hopCell('A','B'), {x:2,y:3});
  graph.addLink('A', 2, 3, 'B');
  assert.equal(graph.stats().confirmed, 1, 'importing v1 must not downgrade confirmed v2');
  assert.equal(LinkGraph.parse(graph.toText()).graph.stats().confirmed, 1);
});

test('v2: distinct source cells to same named destination must not guess an exit', () => {
  const graph = new LinkGraph();
  graph.addLink('A', 2, 3, 'B', 10, 11, true);
  graph.addLink('A', 8, 9, 'B', 15, 16, true);
  assert.equal(graph.cellCount, 2);
  assert.equal(graph.hopCell('A', 'B'), null);
  assert.equal(graph.findRoute('A', 'B'), null);
});

test('v2: malformed 8-column rows must not corrupt destination map names', () => {
  const { graph, stats } = LinkGraph.parse(
    'PROCATCHEM-LINKGRAPH\tv2\nA\t2\t3\tB\t10\t11\tconfirmed\t2026-10-13T00:00:00Z'
    + '\nA\t2\t3\tOther\t10\t11\tbogus\t2026-10-13T00:00:00Z');
  assert.equal(stats.skipped, 1);
  assert.deepEqual(graph.mapNames(), ['A','B']);
});

test('merge v2 source over migrated v1 retains the confirmed destination', () => {
  const legacy = 'PROCATCHEM-LINKGRAPH\tv1\nA\t8\t7\tB';
  const observed = 'PROCATCHEM-LINKGRAPH\tv2\nA\t8\t7\tB\t19\t22\tconfirmed\t2026-10-13T01:02:03Z';
  const { graph, stats } = LinkGraph.parse(legacy + '\n' + observed);
  assert.equal(stats.cells, 1);
  assert.equal(stats.confirmed, 1);
  assert.deepEqual(graph.hopCell('A', 'B'), { x: 8, y: 7 });
  assert.deepEqual([graph.allEdges()[0].toX, graph.allEdges()[0].toY], [19, 22]);
});
