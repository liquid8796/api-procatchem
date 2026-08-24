/**
 * Replacing the retired `moveToMap()` in a script the builder did not write.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { LinkGraph } from '../assets/builder/js/domain/link-graph.js';
import { convertMoveToMap } from '../assets/builder/js/domain/lua-rewrite.js';

const { graph } = LinkGraph.parse([
  'PROCATCHEM-LINKGRAPH\tv1',
  'Viridian City\t12\t3\tViridian Forest',
  'Viridian Forest\t14\t46\tViridian City',
  'Viridian City\t23\t8\tPokecenter Viridian',
].join('\n'));

/** @param {string[]} lines */
const src = (...lines) => lines.join('\n');

test('a call inside an explicit map test is replaced', () => {
  const result = convertMoveToMap(src(
    'function onPathAction()',
    '    if getMapName() == "Viridian City" then',
    '        return moveToMap("Viridian Forest")',
    '    end',
    'end',
  ), graph);

  assert.equal(result.converted, 1);
  assert.deepEqual(result.skipped, []);
  assert.match(result.lua, /return moveToCell\(12, 3\)/);
  assert.doesNotMatch(result.lua, /moveToMap/);
});

test('the aliased form is understood too', () => {
  const result = convertMoveToMap(src(
    'function onPathAction()',
    '    local map = getMapName()',
    '    if map == "Viridian Forest" then',
    '        return moveToMap("Viridian City")',
    '    end',
    'end',
  ), graph);

  assert.equal(result.converted, 1);
  assert.match(result.lua, /return moveToCell\(14, 46\)/);
});

test('a call with no map in scope is left alone and reported', () => {
  const result = convertMoveToMap('return moveToMap("Viridian Forest")', graph);

  assert.equal(result.converted, 0);
  assert.equal(result.lua, 'return moveToMap("Viridian Forest")');
  assert.deepEqual(result.skipped, [{
    line: 1,
    target: 'Viridian Forest',
    reason: 'the script does not say which map it is on here',
  }]);
});

test('a pair the graph does not know is left alone and reported', () => {
  const result = convertMoveToMap(src(
    'if getMapName() == "Viridian City" then',
    '    return moveToMap("Pewter City")',
    'end',
  ), graph);

  assert.equal(result.converted, 0);
  assert.match(result.skipped[0].reason, /no warp cell from "Viridian City" to "Pewter City"/);
});

test('a map assertion stops applying once its block closes', () => {
  const result = convertMoveToMap(src(
    'if getMapName() == "Viridian City" then',
    '    moveToMap("Viridian Forest")',
    'end',
    'moveToMap("Viridian Forest")',
  ), graph);

  assert.equal(result.converted, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].line, 4);
});

test('the innermost assertion wins', () => {
  const result = convertMoveToMap(src(
    'if getMapName() == "Viridian City" then',
    '    if getMapName() == "Viridian Forest" then',
    '        moveToMap("Viridian City")',
    '    end',
    '    moveToMap("Viridian Forest")',
    'end',
  ), graph);

  assert.equal(result.converted, 2);
  assert.match(result.lua, /moveToCell\(14, 46\)/);
  assert.match(result.lua, /moveToCell\(12, 3\)/);
});

test('a "not this map" test does not pin the map down', () => {
  const result = convertMoveToMap(src(
    'if getMapName() ~= "Viridian City" then',
    '    moveToMap("Viridian Forest")',
    'end',
  ), graph);

  assert.equal(result.converted, 0);
  assert.match(result.skipped[0].reason, /does not say which map/);
});

test('a comparison against some other string does not pin the map down', () => {
  const result = convertMoveToMap(src(
    'local wanted = "Larvitar"',
    'if getOpponentName() == "Viridian City" then',
    '    moveToMap("Viridian Forest")',
    'end',
  ), graph);

  assert.equal(result.converted, 0);
});

test('keywords inside comments and strings do not close a block early', () => {
  const result = convertMoveToMap(src(
    'if getMapName() == "Viridian City" then',
    '    log("end of the line") -- if this were counted the scope would close',
    '    moveToMap("Viridian Forest")',
    'end',
  ), graph);

  assert.equal(result.converted, 1);
});

test('several calls on one line are all replaced', () => {
  const result = convertMoveToMap(
    'if getMapName() == "Viridian City" then x = moveToMap("Viridian Forest") or moveToMap("Pokecenter Viridian") end',
    graph,
  );

  assert.equal(result.converted, 2);
  assert.match(result.lua, /moveToCell\(12, 3\) or moveToCell\(23, 8\)/);
});

test('a script with no calls comes back untouched', () => {
  const source = 'function onPathAction()\n    return moveToGrass()\nend';
  const result = convertMoveToMap(source, graph);

  assert.equal(result.converted, 0);
  assert.deepEqual(result.skipped, []);
  assert.equal(result.lua, source);
});

test('an empty graph converts nothing rather than throwing', () => {
  const result = convertMoveToMap(
    'if getMapName() == "Viridian City" then moveToMap("Viridian Forest") end',
    new LinkGraph(),
  );
  assert.equal(result.converted, 0);
  assert.equal(result.skipped.length, 1);
});
