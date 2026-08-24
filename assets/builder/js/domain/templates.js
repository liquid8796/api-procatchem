/**
 * Starter configurations.
 *
 * A blank form is a poor place to learn what the builder can express, and most
 * runs are a variation on a handful of shapes. Each template is a complete,
 * lintable configuration: load one, change the map and the Pokémon, and it is
 * ready to generate.
 *
 * Templates deliberately leave map names blank where the answer depends on the
 * player's link graph, so the lint points at the one field that still needs an
 * answer instead of silently producing a route to somewhere they have not been.
 */

import { createDefaultConfig, createEvGoal, createStep } from './config.js';

/**
 * @typedef {object} Template
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {() => object} build returns a fresh configuration
 */

/**
 * Apply overrides onto a fresh default configuration.
 *
 * Deliberately shallow per section: a template says what it changes, and
 * everything it does not mention stays at the documented default.
 *
 * @param {Record<string, object>} sections
 * @returns {object}
 */
function from(sections) {
  const config = createDefaultConfig();
  for (const [section, values] of Object.entries(sections)) {
    if (section === 'rules' || section === 'mode') {
      config[section] = values;
      continue;
    }
    Object.assign(config[section], values);
  }
  return config;
}

/** @type {readonly Template[]} */
export const TEMPLATES = Object.freeze([
  {
    id: 'shinyGrass',
    label: 'Shiny hunt in grass',
    description: 'Walk grass on one map, False Swipe and sleep anything shiny, work down a ball ladder.',
    build: () => from({
      meta: { name: 'Shiny Grass Hunt', description: 'Hunts shinies in tall grass.', fileName: 'shiny_grass_hunt.lua' },
      mode: 'hunt',
      route: { kind: 'here', farmAction: 'moveToGrass' },
      target: { shiny: true, notCaught: false, names: [], requireAll: false },
      battle: {
        weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
        status: { moves: ['Spore', 'Hypnosis'], requireBeforeBall: true },
      },
      team: { healBelowUsable: 2, healOnPPOut: true, leadAbility: 'Synchronize', keepMoves: ['False Swipe'] },
      safety: { breaks: { enabled: true, everyMin: 15, everyMax: 45, lengthMin: 30, lengthMax: 180 } },
    }),
  },

  {
    id: 'shinyFishing',
    label: 'Shiny hunt while fishing',
    description: 'Stand on one tile, cast a rod, and catch whatever comes up shiny.',
    build: () => from({
      meta: { name: 'Shiny Fishing', description: 'Fishes one tile for shinies.', fileName: 'shiny_fishing.lua' },
      mode: 'hunt',
      route: { kind: 'here', farmAction: 'fish', farmArgs: '12, 30', farmRod: 'Super Rod', surfFix: false },
      target: { shiny: true, requireAll: false },
      battle: {
        weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
        status: { moves: ['Spore'], requireBeforeBall: false },
      },
      // Fishing keeps the bot on one tile, so the water mount matters more than
      // the land one.
      mounts: { water: ['Lapras Mount'], applyOnStart: true },
    }),
  },

  {
    id: 'pokecenterLoop',
    label: 'EXP grind with a Pokécenter loop',
    description: 'Fight everything, rotate the lowest-level Pokémon in, and walk back to heal.',
    build: () => from({
      meta: { name: 'EXP Grind', description: 'Levels the team on a Pokécenter loop.', fileName: 'exp_grind.lua' },
      mode: 'exp',
      route: { kind: 'route', farmAction: 'moveToGrass', endBehaviour: 'pcLoop' },
      team: {
        healBelowUsable: 2,
        healOnPPOut: false,
        rotation: { mode: 'weakest', stat: 'ATK', target: 252, ids: [], goals: [] },
      },
      safety: { breaks: { enabled: true, everyMin: 20, everyMax: 60, lengthMin: 60, lengthMax: 240 } },
    }),
  },

  {
    id: 'evTable',
    label: 'EV training from a table',
    description: 'Fight only clean EV yields, working down a list of Pokémon that each want a different spread.',
    build: () => from({
      meta: { name: 'EV Session', description: 'Trains several spreads in one run.', fileName: 'ev_session.lua' },
      mode: 'ev',
      route: { kind: 'here', farmAction: 'moveToGrass', endBehaviour: 'stop', endMessage: 'EV targets reached.' },
      team: {
        healBelowUsable: 2,
        rotation: {
          mode: 'uidEv',
          stat: 'ATK',
          target: 252,
          ids: [],
          goals: [createEvGoal({ stat: 'ATK', target: 252 }), createEvGoal({ stat: 'SPD', target: 252 })],
        },
      },
    }),
  },

  {
    id: 'goldFarm',
    label: 'Gold farm',
    description: 'Knock out everything with the strongest Pokémon and report what the session earned.',
    build: () => from({
      meta: { name: 'Gold Farm', description: 'Fights for money.', fileName: 'gold_farm.lua' },
      mode: 'gold',
      route: { kind: 'route', farmAction: 'moveToGrass' },
      team: {
        healBelowUsable: 3,
        rotation: { mode: 'highest', stat: 'ATK', target: 252, ids: [], goals: [] },
        leadItem: 'Amulet Coin',
      },
      logging: { counters: true, announceShiny: true },
    }),
  },

  {
    id: 'rulesExample',
    label: 'Custom rules, worked example',
    description: 'A three-rule battle plan: catch a target, escape a trap, fight anything else.',
    build: () => from({
      meta: { name: 'Custom Rules', description: 'Hand-written battle logic.', fileName: 'custom_rules.lua' },
      mode: 'rules',
      route: { kind: 'here', farmAction: 'moveToGrass' },
      rules: [
        {
          id: 'template-rule-target',
          label: 'Worth catching',
          match: {
            op: 'or',
            negate: false,
            items: [
              { kind: 'shiny', params: {}, negate: false },
              { kind: 'notCaught', params: {}, negate: false },
            ],
          },
          fallback: 'nothing',
          steps: [
            createStep({
              action: 'useMove',
              move: 'False Swipe',
              slot: 'auto',
              when: {
                op: 'and',
                negate: false,
                items: [{ kind: 'oppHp', params: { cmp: '>', value: 1 }, negate: false }],
              },
            }),
            createStep({
              action: 'useMove',
              move: 'Spore',
              slot: 'auto',
              when: {
                op: 'and',
                negate: false,
                items: [{ kind: 'oppStatus', params: { status: '' }, negate: false }],
              },
            }),
            createStep({ action: 'throwBalls', balls: ['Ultra Ball', 'Great Ball', 'Pokeball'] }),
          ],
        },
        {
          id: 'template-rule-taunt',
          label: 'Taunted',
          match: {
            op: 'and',
            negate: false,
            items: [{
              kind: 'heardText',
              params: { on: ['was taunted'], off: ['shook off the taunt'], turns: 0 },
              negate: false,
            }],
          },
          fallback: 'attack',
          steps: [
            createStep({
              action: 'chain',
              chain: [
                { action: 'attack', value: '' },
                { action: 'run', value: '' },
              ],
            }),
          ],
        },
        {
          id: 'template-rule-other',
          label: 'Anything else',
          match: { op: 'or', negate: false, items: [] },
          fallback: 'run',
          steps: [createStep({ action: 'run' })],
        },
      ],
    }),
  },
]);

/**
 * @param {string} id
 * @returns {Template | null}
 */
export function findTemplate(id) {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}
