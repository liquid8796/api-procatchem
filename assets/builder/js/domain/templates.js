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
    id: 'ghostSoak',
    label: 'Ghost hunt, Soak first',
    description: 'Soak turns the Ghost into a Water type so False Swipe stops missing, then the usual ladder.',
    build: () => from({
      meta: {
        name: 'Ghost Hunt',
        description: 'Soaks Ghosts so False Swipe connects.',
        fileName: 'ghost_hunt.lua',
      },
      mode: 'hunt',
      route: { kind: 'here', farmAction: 'moveToNormalGround' },
      target: { shiny: true, notCaught: true, requireAll: false },
      battle: {
        // Normal moves do nothing to a Ghost, so the type has to go first.
        helperMoves: [{ move: 'Soak', trigger: 'oppType', type: 'Ghost', names: [], slot: 1, ability: '' }],
        weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
        status: { moves: ['Hypnosis'], requireBeforeBall: true },
      },
      team: { healBelowUsable: 2, keepMoves: ['False Swipe', 'Soak'] },
    }),
  },

  {
    id: 'skillSwap',
    label: 'Skill Swap the ability away',
    description: 'Hands the wild Pokémon a harmless ability before anything else, for the ones that punish a long fight.',
    build: () => from({
      meta: {
        name: 'Skill Swap Hunt',
        description: 'Neutralises the opponent ability before catching.',
        fileName: 'skill_swap_hunt.lua',
      },
      mode: 'hunt',
      route: { kind: 'here', farmAction: 'moveToGrass' },
      target: { shiny: true, requireAll: false },
      battle: {
        helperMoves: [
          { move: 'Skill Swap', trigger: 'oppName', type: '', names: ['Gengar'], slot: 1, ability: '' },
        ],
        weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
        status: { moves: ['Spore'], requireBeforeBall: false },
      },
      team: { leadAbility: 'Magic Guard', keepMoves: ['Skill Swap', 'False Swipe'] },
    }),
  },

  {
    id: 'thiefFarm',
    label: 'Item farm with Thief',
    description: 'Steals the held item from everything that walks past, then leaves without a fight.',
    build: () => from({
      meta: {
        name: 'Item Farm',
        description: 'Thieves held items and runs.',
        fileName: 'item_farm.lua',
      },
      // Stealing and leaving is a two-step battle, not a catch, so this is
      // written as a rule: take the item on the first turn, run on the second.
      mode: 'rules',
      route: { kind: 'here', farmAction: 'moveToGrass' },
      battle: { onOther: 'run' },
      team: { secondAbility: 'Frisk', keepMoves: ['Thief'] },
      rules: [
        {
          id: 'template-rule-thief',
          label: 'Take the item',
          // No conditions: every wild Pokémon is worth one turn of Thief.
          match: { op: 'or', negate: false, items: [] },
          fallback: 'run',
          steps: [
            createStep({ action: 'useMove', move: 'Thief', slot: 'auto', once: true }),
            createStep({ action: 'run' }),
          ],
        },
      ],
    }),
  },

  {
    id: 'abilityHunt',
    label: 'Ability hunt with Trace',
    description: 'A Trace lead reads the wild ability out loud; the filter listens for the ones you want.',
    build: () => from({
      meta: {
        name: 'Ability Hunt',
        description: 'Hunts a specific ability using a Trace lead.',
        fileName: 'ability_hunt.lua',
      },
      mode: 'hunt',
      route: { kind: 'here', farmAction: 'moveToGrass' },
      target: {
        shiny: false, notCaught: false, names: [], requireAll: false,
        abilities: ['Contrary', 'Mold Breaker'],
      },
      battle: {
        weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
        status: { moves: ['Spore'], requireBeforeBall: true },
      },
      // Synchronize keeps working from slot 1 even when it faints, so slot 2 is
      // where the Pokémon that actually fights — and reads the ability — goes.
      team: { leadAbility: 'Synchronize', secondAbility: 'Trace', healBelowUsable: 2 },
    }),
  },

  {
    id: 'doubleSleep',
    label: 'Two layers of sleep',
    description: 'Spore first, Hypnosis when the Spore carrier runs dry, and back to the Pokécenter when both do.',
    build: () => from({
      meta: {
        name: 'Double Sleep Hunt',
        description: 'Keeps a backup sleep move for when the first runs out of PP.',
        fileName: 'double_sleep_hunt.lua',
      },
      mode: 'hunt',
      route: { kind: 'here', farmAction: 'moveToGrass' },
      target: { shiny: true, notCaught: true, requireAll: false },
      battle: {
        weaken: { mode: 'falseSwipe', move: 'False Swipe', percent: 30 },
        // Tried in order; whichever team member still has PP is switched in.
        status: { moves: ['Spore', 'Hypnosis'], requireBeforeBall: true },
      },
      team: {
        healBelowUsable: 2,
        healOnPPOut: true,
        keepMoves: ['Spore', 'Hypnosis', 'False Swipe'],
      },
    }),
  },

  {
    id: 'evChain',
    label: 'EV chain across the team',
    description: 'Three Pokémon, three spreads, worked in order — the run stops itself when the last one is done.',
    build: () => from({
      meta: {
        name: 'EV Chain',
        description: 'Trains a queue of Pokémon, each to its own spread.',
        fileName: 'ev_chain.lua',
      },
      mode: 'ev',
      route: { kind: 'here', farmAction: 'moveToGrass', endBehaviour: 'stop', endMessage: 'Every spread is done.' },
      team: {
        healBelowUsable: 2,
        rotation: {
          mode: 'uidEv',
          stat: 'ATK',
          target: 252,
          ids: [],
          // Names rather than unique ids, so the table reads as a plan rather
          // than as a row of numbers. The same Pokémon twice means two stats.
          goals: [
            createEvGoal({ id: 'Larvitar', stat: 'ATK', target: 252 }),
            createEvGoal({ id: 'Larvitar', stat: 'HP', target: 252 }),
            createEvGoal({ id: 'Ralts', stat: 'SPATK', target: 252 }),
            createEvGoal({ id: 'Magikarp', stat: 'SPD', target: 252 }),
          ],
        },
      },
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
