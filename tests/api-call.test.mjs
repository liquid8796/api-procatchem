/**
 * Checking hand-written Lua against the API catalog.
 *
 * Run with: node --test tests/
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  argumentKind,
  looksLikeBareWord,
  looksLikeUnquotedText,
  resolveName,
  scanLuaCalls,
  splitArguments,
  suggestName,
  validateCall,
} from '../assets/builder/js/domain/api-call.js';

test('an empty argument list has no arguments', () => {
  assert.deepEqual(splitArguments(''), []);
  assert.deepEqual(splitArguments('   '), []);
});

test('arguments split on top-level commas only', () => {
  assert.deepEqual(splitArguments('1, 2'), ['1', '2']);
  assert.deepEqual(splitArguments('"a, b", f(1, 2), {x = 1}'), ['"a, b"', 'f(1, 2)', '{x = 1}']);
});

test('an escaped quote does not end the string', () => {
  assert.deepEqual(splitArguments('"say \\", now", 2'), ['"say \\", now"', '2']);
});

test('literal kinds are recognised, and expressions are left unknown', () => {
  assert.equal(argumentKind('"x"'), 'string');
  assert.equal(argumentKind("'x'"), 'string');
  assert.equal(argumentKind('12'), 'number');
  assert.equal(argumentKind('-3.5'), 'number');
  assert.equal(argumentKind('true'), 'boolean');
  assert.equal(argumentKind('nil'), 'nil');
  assert.equal(argumentKind('{ 1, 2 }'), 'table');
  assert.equal(argumentKind('getPlayerX()'), 'unknown');
});

test('a correct call reports nothing', () => {
  assert.deepEqual(validateCall('moveToCell', '1, 2'), []);
  assert.deepEqual(validateCall('isMorning', ''), []);
});

test('too few and too many arguments are both reported', () => {
  assert.match(validateCall('moveToCell', '1')[0].message, /needs 2 arguments, but 1 was given/);
  assert.match(validateCall('moveToCell', '1, 2, 3')[0].message, /takes 2 arguments, but 3 were given/);
});

test('a literal of the wrong type is reported, an expression is not', () => {
  assert.match(validateCall('useMove', '5')[0].message, /should be a string, but 5 is a number/);
  assert.deepEqual(validateCall('useMove', 'chosenMove'), []);
});

test('nil is accepted anywhere, because it is how an argument is skipped', () => {
  assert.deepEqual(validateCall('useMove', 'nil'), []);
});

test('unquoted text is reported as invalid Lua, not as a type mismatch', () => {
  const [problem] = validateCall('useItem', 'Ultra Ball');
  assert.equal(problem.level, 'error');
  assert.match(problem.message, /Text has to be quoted: "Ultra Ball"/);
});

test('an unknown name suggests the closest documented one', () => {
  assert.match(validateCall('moveToCel', '')[0].message, /did you mean moveToCell\(\)\?/);
  assert.match(validateCall('zzzznotathing', '')[0].message, /There is no API function called zzzznotathing\(\)\./);
});

test('a retired function is called out with its replacement', () => {
  const [problem] = validateCall('moveToMap', '"Viridian City"');
  assert.equal(problem.level, 'error');
  assert.match(problem.message, /retired.*Use moveToCell\(\) instead/s);
});

test('an undocumented host global warns rather than erroring', () => {
  const [problem] = validateCall('setBattleTimeout', '5');
  assert.equal(problem.level, 'warning');
  assert.match(problem.message, /not documented/);
});

test('a function the script defines itself is accepted', () => {
  assert.deepEqual(validateCall('myHelper', '1, 2', { localFunctions: new Set(['myHelper']) }), []);
});

test('an empty name is an error, not a crash', () => {
  assert.match(validateCall('', '')[0].message, /No function name given/);
});

test('resolveName only judges the name', () => {
  assert.equal(resolveName('moveToCell'), null, 'arity is not its business');
  assert.match(resolveName('moveToCel').message, /did you mean/);
});

test('suggestName prefers an exact match ignoring case', () => {
  assert.equal(suggestName('ISMORNING'), 'isMorning');
  assert.equal(suggestName('xy'), null, 'too short to guess from');
  assert.equal(suggestName('completelyunrelatedname'), null);
});

test('unquoted-text and bare-word detection stay apart', () => {
  assert.equal(looksLikeUnquotedText('Ultra Ball'), true);
  assert.equal(looksLikeUnquotedText('Pikachu'), false, 'one word could be a variable');
  assert.equal(looksLikeUnquotedText('"Ultra Ball"'), false);
  assert.equal(looksLikeUnquotedText('a + b'), false, 'operators mean it is an expression');

  assert.equal(looksLikeBareWord('Pikachu'), true);
  assert.equal(looksLikeBareWord('true'), false);
  assert.equal(looksLikeBareWord('"Pikachu"'), false);
  assert.equal(looksLikeBareWord('12'), false);
});

test('scanning a file finds unresolvable names and nothing else', () => {
  const source = [
    'function onPathAction()',
    '    local here = getMapNam()',
    '    log("moveToNowhere() is only text")',
    '    return helper(here)',
    'end',
    'local function helper(x) return x end',
  ].join('\n');

  const problems = scanLuaCalls(source);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /getMapNam/);
});

test('a clean script scans clean', () => {
  assert.deepEqual(scanLuaCalls('function onPathAction()\n  return moveToGrass()\nend'), []);
});

test('a long comment block cannot hide a call from the scanner or invent one', () => {
  const source = '--[==[ notAFunction() ]==]\nfunction onStart() log("hi") end';
  assert.deepEqual(scanLuaCalls(source), []);
});
