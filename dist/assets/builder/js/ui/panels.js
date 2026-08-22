/**
 * Panel definitions.
 *
 * Each panel is a descriptor: an id, a heading, and a `build` function that
 * returns its contents. Most panels are nothing but a list of field
 * descriptors; only the mode picker needs custom markup. Adding a section to
 * the builder means appending one entry to {@link PANELS}.
 */

import {
  BALL_CONDITIONS,
  EV_STATS,
  FARM_ACTIONS,
  HEAL_ACTIONS,
  OTHER_POLICIES,
  TRAINER_POLICIES,
  TRAPPED_POLICIES,
  WEAKEN_MODES,
  toStringList,
} from '../domain/config.js';
import { modeRegistry } from '../generators/mode-registry.js';
import { h } from './dom.js';
import { renderFields } from './fields.js';
import { wireRadioGroup } from './radio-group.js';

/**
 * @typedef {object} Panel
 * @property {string} id
 * @property {string} title
 * @property {string} icon
 * @property {string} subtitle
 * @property {(config: object, mode: import('../generators/mode-registry.js').FarmMode) => boolean} [visibleWhen]
 * @property {(store: import('../core/store.js').Store,
 *             mode: import('../generators/mode-registry.js').FarmMode) => Node[]} build
 */

/** @param {Array<{id: string, label: string, hint?: string}>} entries */
const asOptions = (entries) => entries.map((entry) => ({
  value: entry.id,
  label: entry.label,
  hint: entry.hint,
}));

/** True when the current farm action needs a cell coordinate. */
const needsCell = (config) => config.route.farmAction === 'moveToCell';
/** True when the current farm action needs an item name. */
const needsItem = (config) => config.route.farmAction === 'useItem';

/** @type {Panel[]} */
export const PANELS = [
  {
    id: 'meta',
    title: 'Script details',
    icon: '❒',
    subtitle: 'How the script identifies itself in the tool',
    build: (store) => [renderFields([
      { type: 'text', path: 'meta.name', label: 'Script name', placeholder: 'Viridian Shiny Hunt' },
      { type: 'text', path: 'meta.author', label: 'Author', placeholder: 'Your trainer name' },
      {
        type: 'text',
        path: 'meta.description',
        label: 'Description',
        placeholder: 'What this script does',
      },
      {
        type: 'text',
        path: 'meta.fileName',
        label: 'File name',
        placeholder: 'my_hunt_script.lua',
        hint: 'Used when you download the script.',
      },
    ], store)],
  },

  {
    id: 'mode',
    title: 'Farm mode',
    icon: '◈',
    subtitle: 'What the script is trying to achieve',
    build: (store, mode) => {
      const entries = modeRegistry.all();
      const cards = h('div.mode-grid', { role: 'radiogroup', 'aria-label': 'Farm mode' },
        entries.map((entry) => {
          const active = entry.id === mode.id;
          return h('button.mode-card', {
            // A stable id lets focus survive the re-render a selection triggers,
            // which is what keeps arrow-key navigation working.
            id: `mode-${entry.id}`,
            type: 'button',
            role: 'radio',
            'aria-checked': String(active),
            class: active ? 'is-active' : '',
            dataset: { mode: entry.id },
            onClick: () => store.setIn('mode', entry.id),
          }, [
            h('span.mode-icon', { 'aria-hidden': 'true', text: entry.icon }),
            h('span.mode-name', { text: entry.label }),
            h('span.mode-tagline', { text: entry.tagline }),
            h('span.mode-desc', { text: entry.description }),
          ]);
        }));
      wireRadioGroup(cards, (index) => store.setIn('mode', entries[index].id));

      return [cards, renderFields([
        {
          type: 'select',
          path: 'ev.stat',
          label: 'Effort value to train',
          options: asOptions(EV_STATS),
          hint: 'Only Pokémon whose entire EV yield is this stat will be fought.',
          visibleWhen: () => mode.traits.usesEvStat,
        },
      ], store)];
    },
  },

  {
    id: 'route',
    title: 'Where to hunt',
    icon: '⌖',
    subtitle: 'The map loop, healing trip, and mounts',
    build: (store) => [renderFields([
      {
        type: 'segmented',
        path: 'route.kind',
        label: 'Route style',
        options: [
          { value: 'here', label: 'Stay put', hint: 'Hunt on whichever map you are standing on' },
          { value: 'route', label: 'Pokécenter loop', hint: 'Walk between a Pokécenter and the hunting map' },
        ],
      },
      {
        type: 'text',
        path: 'route.farmMap',
        label: 'Hunting map',
        placeholder: 'Viridian Forest',
        hint: 'Must appear in the loaded link graph.',
        visibleWhen: (config) => config.route.kind === 'route',
      },
      {
        type: 'text',
        path: 'route.pokecenterMap',
        label: 'Pokécenter map',
        placeholder: 'Pokecenter Viridian',
        hint: 'Where the script goes to heal.',
        visibleWhen: (config) => config.route.kind === 'route',
      },
      {
        type: 'select',
        path: 'route.farmAction',
        label: 'How to find encounters',
        options: FARM_ACTIONS.map((action) => ({
          value: action.id,
          label: `${action.label} — ${action.hint}`,
        })),
      },
      {
        type: 'text',
        path: 'route.farmArgs',
        label: 'Cell to stand on',
        placeholder: '12, 30',
        hint: 'The tile to fish or idle from.',
        visibleWhen: needsCell,
      },
      {
        type: 'text',
        path: 'route.farmArgs',
        label: 'Item to use',
        placeholder: 'Super Rod',
        hint: 'Used once per turn while standing still.',
        visibleWhen: needsItem,
      },
      {
        type: 'select',
        path: 'route.healAction',
        label: 'How to heal',
        options: asOptions(HEAL_ACTIONS),
        visibleWhen: (config) => config.route.kind === 'route',
      },
      {
        type: 'text',
        path: 'route.healArgs',
        label: 'Nurse cell',
        placeholder: '7, 9',
        visibleWhen: (config) => config.route.kind === 'route'
          && config.route.healAction === 'talkToNpcOnCell',
      },
      {
        type: 'toggle',
        path: 'route.surfFix',
        label: 'Step off the water before hunting on land',
        hint: 'Prevents the script getting stuck surfing.',
      },
      {
        type: 'chips',
        path: 'mounts.land',
        label: 'Land mounts',
        placeholder: 'Arcanine Mount, Bicycle',
        hint: 'The first one you actually own is used.',
      },
      {
        type: 'chips',
        path: 'mounts.water',
        label: 'Water mounts',
        placeholder: 'Lapras Mount',
      },
      {
        type: 'toggle',
        path: 'mounts.applyOnStart',
        label: 'Set the mount when the script starts',
        visibleWhen: (config) => Boolean(
          toStringList(config.mounts.land).length || toStringList(config.mounts.water).length,
        ),
      },
      {
        type: 'toggle',
        path: 'mounts.dismountOnFarm',
        label: 'Dismount before hunting',
        hint: 'Some maps will not spawn encounters while mounted.',
      },
    ], store)],
  },

  {
    id: 'target',
    title: 'What to catch',
    icon: '◎',
    subtitle: 'Which wild encounters are worth your time',
    visibleWhen: (config, mode) => mode.traits.usesTargetFilters,
    build: (store) => [renderFields([
      {
        type: 'segmented',
        path: 'target.requireAll',
        label: 'How filters combine',
        options: [
          { value: false, label: 'Any match', hint: 'Catch if one filter matches' },
          { value: true, label: 'All must match', hint: 'Catch only when every filter matches' },
        ],
      },
      { type: 'toggle', path: 'target.shiny', label: 'Shiny Pokémon', hint: 'Almost always worth keeping on.' },
      { type: 'toggle', path: 'target.notCaught', label: 'Anything not in your Pokédex yet' },
      {
        type: 'chips',
        path: 'target.names',
        label: 'Named Pokémon',
        placeholder: 'Larvitar, Pikachu',
      },
      {
        type: 'number', path: 'target.levelMin', label: 'Minimum level',
        placeholder: 'any', min: 1, max: 100, nullable: true,
      },
      {
        type: 'number', path: 'target.levelMax', label: 'Maximum level',
        placeholder: 'any', min: 1, max: 100, nullable: true,
      },
      {
        type: 'select',
        path: 'target.gender',
        label: 'Gender',
        options: [
          { value: '', label: 'Any gender' },
          { value: 'Male', label: 'Male only' },
          { value: 'Female', label: 'Female only' },
        ],
      },
    ], store)],
  },

  {
    id: 'battle',
    title: 'Battle plan',
    icon: '⚔',
    subtitle: 'How each encounter is handled',
    build: (store, mode) => [renderFields([
      {
        type: 'segmented',
        path: 'battle.weaken.mode',
        label: 'Weaken the target first',
        options: asOptions(WEAKEN_MODES),
        visibleWhen: () => mode.traits.usesWeaken,
      },
      {
        type: 'text',
        path: 'battle.weaken.move',
        label: 'Weakening move',
        placeholder: 'False Swipe',
        hint: 'Any team member that still has PP for it will be switched in.',
        visibleWhen: (config) => mode.traits.usesWeaken && config.battle.weaken.mode === 'falseSwipe',
      },
      {
        type: 'number',
        path: 'battle.weaken.percent',
        label: 'Stop attacking at HP %',
        min: 1, max: 99,
        visibleWhen: (config) => mode.traits.usesWeaken && config.battle.weaken.mode === 'percent',
      },
      {
        type: 'chips',
        path: 'battle.status.moves',
        label: 'Status moves',
        placeholder: 'Spore, Hypnosis',
        hint: 'Tried in order until one lands.',
        visibleWhen: () => mode.traits.usesBalls,
      },
      {
        type: 'toggle',
        path: 'battle.status.requireBeforeBall',
        label: 'Only throw balls once the target is statused',
        hint: 'Higher catch rate, more turns per encounter.',
        visibleWhen: () => mode.traits.usesBalls,
      },
      {
        type: 'ballLadder',
        path: 'battle.balls',
        label: 'Ball ladder',
        options: BALL_CONDITIONS,
        hint: 'Tried top to bottom; the first one thrown ends the turn.',
        visibleWhen: () => mode.traits.usesBalls,
      },
      {
        type: 'number',
        path: 'battle.lowHpPercent',
        label: 'Low-HP threshold for balls',
        min: 1, max: 99,
        visibleWhen: (config) => mode.traits.usesBalls
          && config.battle.balls.some((ball) => ball.condition === 'lowHp'),
      },
      {
        type: 'segmented',
        path: 'battle.onTrainer',
        label: 'When a trainer battles you',
        options: asOptions(TRAINER_POLICIES),
      },
      {
        type: 'segmented',
        path: 'battle.onOther',
        label: 'Wild Pokémon you do not want',
        options: asOptions(OTHER_POLICIES),
        visibleWhen: () => !mode.traits.engagesEveryEncounter,
      },
    ], store)],
  },

  {
    id: 'team',
    title: 'Team and healing',
    icon: '✚',
    subtitle: 'When to break off and visit the Pokécenter',
    build: (store) => [renderFields([
      {
        type: 'number',
        path: 'team.healBelowUsable',
        label: 'Heal when usable Pokémon drop below',
        placeholder: 'never',
        min: 1, max: 6, nullable: true,
        hint: 'Leave blank to keep hunting until the team is wiped.',
      },
      {
        type: 'toggle',
        path: 'team.healOnPPOut',
        label: 'Heal when the battle moves run out of PP',
        hint: 'Checks the weakening and status moves you configured.',
      },
    ], store)],
  },

  {
    id: 'safety',
    title: 'Session safety',
    icon: '⏻',
    subtitle: 'Breaks, AFK handling, and escaping traps',
    build: (store, mode) => [renderFields([
      {
        type: 'toggle',
        path: 'safety.breaks.enabled',
        label: 'Take randomised breaks',
        hint: 'Parks the bot on plain ground so it stops meeting Pokémon for a while.',
      },
      {
        type: 'number', path: 'safety.breaks.everyMin', label: 'Break every, from (minutes)',
        min: 1, max: 600, visibleWhen: (config) => config.safety.breaks.enabled,
      },
      {
        type: 'number', path: 'safety.breaks.everyMax', label: 'Break every, to (minutes)',
        min: 1, max: 600, visibleWhen: (config) => config.safety.breaks.enabled,
      },
      {
        type: 'number', path: 'safety.breaks.lengthMin', label: 'Break length, from (seconds)',
        min: 1, max: 3600, visibleWhen: (config) => config.safety.breaks.enabled,
      },
      {
        type: 'number', path: 'safety.breaks.lengthMax', label: 'Break length, to (seconds)',
        min: 1, max: 3600, visibleWhen: (config) => config.safety.breaks.enabled,
      },
      {
        type: 'number',
        path: 'safety.afkTimeout',
        label: 'AFK timeout (seconds)',
        placeholder: 'leave to the tool',
        min: 1, nullable: true,
      },
      {
        type: 'segmented',
        path: 'safety.onTrapped',
        label: 'When switching is blocked',
        hint: 'Applied to encounters this mode does not want — a target is never abandoned.',
        options: asOptions(TRAPPED_POLICIES),
        visibleWhen: () => !mode.traits.engagesEveryEncounter,
      },
      {
        type: 'toggle',
        path: 'logging.counters',
        label: 'Track encounters, shinies, and money',
        hint: 'Reported in the log when you pause the script.',
      },
      {
        type: 'toggle',
        path: 'logging.announceShiny',
        label: 'Shout in the log on a shiny encounter',
        visibleWhen: (config) => config.logging.counters,
      },
    ], store)],
  },
];
