/**
 * Quick build — the short form.
 *
 * The full builder has around sixty settings, which is right for the run you
 * have already thought about and wrong for the one you want going in the next
 * two minutes. This asks the dozen questions that decide almost every run,
 * assembles a complete configuration from the answers, and drops it into the
 * main form — where every one of those sixty settings is still there to adjust.
 *
 * It writes a configuration rather than a script: nothing here is a second
 * generator, and there is no shape it can express that the form cannot.
 */

import { t } from '../core/i18n.js';
import { Store } from '../core/store.js';
import {
  EV_STATS,
  FARM_ACTIONS,
  FISHING_ACTION,
  ROTATION_MODES,
  TARGET_ACTIONS,
  createDefaultConfig,
  normaliseConfig,
} from '../domain/config.js';
import { modeRegistry } from '../generators/mode-registry.js';
import { h, keepingFocus, replaceChildren } from './dom.js';
import { renderFields } from './fields.js';

/** Rotations worth offering without the list editors that back the other two. */
const QUICK_ROTATIONS = ['off', 'weakest', 'highest', 'ev'];

/** @returns {object} the answers a fresh form starts from */
function blankAnswers() {
  const defaults = createDefaultConfig();
  return {
    mode: 'hunt',
    route: {
      kind: 'here',
      farmMap: '',
      pokecenterMap: '',
      farmAction: 'moveToGrass',
      farmArgs: '',
      farmRod: 'Super Rod',
    },
    mounts: { land: [], water: [] },
    target: {
      names: [],
      shiny: true,
      notCaught: false,
      levelMin: null,
      levelMax: null,
      onMatch: 'catch',
    },
    battle: {
      weakenMode: defaults.battle.weaken.mode,
      weakenPercent: defaults.battle.weaken.percent,
      statusMoves: ['Spore'],
      requireStatus: true,
    },
    team: {
      rotationMode: 'off',
      evStat: 'SPD',
      evTarget: 252,
      leadAbility: '',
      healBelowUsable: 2,
      leadItem: '',
    },
    safety: { breaks: true },
  };
}

/**
 * The questions, in the order they get asked.
 *
 * @returns {import('./fields.js').Field[]}
 */
function quickFields() {
  const needsCell = (a) => a.route.farmAction === 'moveToCell' || a.route.farmAction === FISHING_ACTION;
  const travels = (a) => a.route.kind === 'route';
  const catching = (a) => a.mode === 'hunt' && a.target.onMatch === 'catch';

  return [
    {
      type: 'select',
      path: 'mode',
      label: 'What is this run for',
      options: modeRegistry.all()
        // Custom rules is the opposite of a quick form: it is the form.
        .filter((mode) => mode.id !== 'rules')
        .map((mode) => ({ value: mode.id, label: `${t(mode.label)} — ${t(mode.tagline)}` })),
    },
    {
      type: 'segmented',
      path: 'route.kind',
      label: 'Where',
      options: [
        { value: 'here', label: 'Right here', hint: 'Whatever map you are standing on' },
        { value: 'route', label: 'Pokécenter loop', hint: 'Walk out, farm, walk back to heal' },
      ],
    },
    {
      type: 'text',
      path: 'route.farmMap',
      label: 'Hunting map',
      placeholder: 'Viridian Forest',
      visibleWhen: travels,
    },
    {
      type: 'text',
      path: 'route.pokecenterMap',
      label: 'Pokécenter map',
      placeholder: 'Pokecenter Viridian',
      visibleWhen: travels,
    },
    {
      type: 'select',
      path: 'route.farmAction',
      label: 'How encounters are found',
      options: FARM_ACTIONS.map((action) => ({
        value: action.id,
        label: `${t(action.label)} — ${t(action.hint)}`,
      })),
    },
    {
      type: 'text',
      path: 'route.farmArgs',
      label: 'Cell to stand on',
      placeholder: '12, 30',
      visibleWhen: needsCell,
    },
    {
      type: 'text',
      path: 'route.farmRod',
      label: 'Rod to cast',
      placeholder: 'Super Rod',
      visibleWhen: (a) => a.route.farmAction === FISHING_ACTION,
    },
    {
      type: 'text',
      path: 'route.farmArgs',
      label: 'Item to use',
      placeholder: 'Repel',
      visibleWhen: (a) => a.route.farmAction === 'useItem',
    },
    {
      type: 'chips',
      path: 'mounts.land',
      label: 'Mounts, best first',
      placeholder: 'Arcanine Mount, Bicycle',
      hint: 'The first one in your bag is the one used.',
    },
    {
      type: 'toggle',
      path: 'target.shiny',
      label: 'Shiny Pokémon',
      visibleWhen: (a) => a.mode === 'hunt',
    },
    {
      type: 'toggle',
      path: 'target.notCaught',
      label: 'Anything new to the Pokédex',
      visibleWhen: (a) => a.mode === 'hunt',
    },
    {
      type: 'chips',
      path: 'target.names',
      label: 'Named Pokémon',
      placeholder: 'Larvitar, Chansey',
      visibleWhen: (a) => a.mode === 'hunt',
    },
    {
      type: 'number',
      path: 'target.levelMin',
      label: 'Minimum level',
      placeholder: 'any',
      min: 1,
      max: 100,
      nullable: true,
      visibleWhen: (a) => a.mode === 'hunt',
    },
    {
      type: 'number',
      path: 'target.levelMax',
      label: 'Maximum level',
      placeholder: 'any',
      min: 1,
      max: 100,
      nullable: true,
      visibleWhen: (a) => a.mode === 'hunt',
    },
    {
      type: 'segmented',
      path: 'target.onMatch',
      label: 'What a match is for',
      options: TARGET_ACTIONS.map((action) => ({
        value: action.id,
        label: t(action.label),
        hint: t(action.hint),
      })),
      visibleWhen: (a) => a.mode === 'hunt',
    },
    {
      type: 'segmented',
      path: 'battle.weakenMode',
      label: 'Weaken it first',
      options: [
        { value: 'falseSwipe', label: 'False Swipe', hint: 'Down to 1 HP, never a faint' },
        { value: 'percent', label: 'Weak attacks', hint: 'Down to a percentage' },
        { value: 'off', label: 'Not at all', hint: 'Throw at full health' },
      ],
      visibleWhen: catching,
    },
    {
      type: 'number',
      path: 'battle.weakenPercent',
      label: 'Stop attacking at HP %',
      min: 1,
      max: 99,
      visibleWhen: (a) => catching(a) && a.battle.weakenMode === 'percent',
    },
    {
      type: 'chips',
      path: 'battle.statusMoves',
      label: 'Sleep or paralysis moves',
      placeholder: 'Spore, Hypnosis',
      hint: 'Tried in order; whichever team member still has PP is switched in.',
      visibleWhen: catching,
    },
    {
      type: 'toggle',
      path: 'battle.requireStatus',
      label: 'Only throw once it is asleep',
      visibleWhen: catching,
    },
    {
      type: 'select',
      path: 'team.rotationMode',
      label: 'Rotate the team',
      options: ROTATION_MODES
        .filter((entry) => QUICK_ROTATIONS.includes(entry.id))
        .map((entry) => ({ value: entry.id, label: `${t(entry.label)} — ${t(entry.hint)}` })),
    },
    {
      type: 'select',
      path: 'team.evStat',
      label: 'EV to cap',
      options: EV_STATS.map((stat) => ({ value: stat.id, label: t(stat.label) })),
      visibleWhen: (a) => a.team.rotationMode === 'ev' || a.mode === 'ev',
    },
    {
      type: 'number',
      path: 'team.evTarget',
      label: 'EV target',
      min: 1,
      max: 252,
      visibleWhen: (a) => a.team.rotationMode === 'ev',
    },
    {
      type: 'text',
      path: 'team.leadAbility',
      label: 'Ability to keep in slot 1',
      placeholder: 'Synchronize',
      hint: 'Synchronize keeps working even after it faints, which is why it leads.',
    },
    {
      type: 'text',
      path: 'team.leadItem',
      label: 'Item the lead should hold',
      placeholder: 'none',
      suggestions: 'heldItems',
    },
    {
      type: 'number',
      path: 'team.healBelowUsable',
      label: 'Go and heal when this many can still fight',
      placeholder: 'never',
      min: 1,
      max: 6,
      nullable: true,
    },
    {
      type: 'toggle',
      path: 'safety.breaks',
      label: 'Take randomised breaks',
      hint: 'Parks the bot somewhere quiet now and then instead of farming without pause.',
    },
  ];
}

/**
 * Turn the answers into a full configuration.
 *
 * @param {object} answers
 * @returns {object}
 */
export function configFromAnswers(answers) {
  const config = createDefaultConfig();

  config.mode = answers.mode;
  config.meta.name = answers.mode === 'hunt' ? 'Quick Hunt' : 'Quick Run';
  config.meta.description = 'Assembled from the quick build.';
  config.meta.fileName = answers.mode === 'hunt' ? 'quick_hunt.lua' : 'quick_run.lua';

  Object.assign(config.route, {
    kind: answers.route.kind,
    farmMap: answers.route.farmMap,
    pokecenterMap: answers.route.pokecenterMap,
    farmAction: answers.route.farmAction,
    farmArgs: answers.route.farmArgs,
    farmRod: answers.route.farmRod,
  });

  config.mounts.land = answers.mounts.land;
  config.mounts.water = answers.mounts.water;

  Object.assign(config.target, {
    names: answers.target.names,
    shiny: answers.target.shiny,
    notCaught: answers.target.notCaught,
    levelMin: answers.target.levelMin,
    levelMax: answers.target.levelMax,
    onMatch: answers.target.onMatch,
  });

  config.battle.weaken.mode = answers.battle.weakenMode;
  config.battle.weaken.percent = answers.battle.weakenPercent;
  config.battle.status.moves = answers.battle.statusMoves;
  config.battle.status.requireBeforeBall = answers.battle.requireStatus;

  config.team.rotation.mode = answers.team.rotationMode;
  config.team.rotation.stat = answers.team.evStat;
  config.team.rotation.target = answers.team.evTarget;
  config.team.leadAbility = answers.team.leadAbility;
  config.team.leadItem = answers.team.leadItem;
  config.team.healBelowUsable = answers.team.healBelowUsable;
  // The EV encounter filter reads this rather than the rotation.
  config.ev.stat = answers.team.evStat;

  config.safety.breaks.enabled = answers.safety.breaks;

  return normaliseConfig(config);
}

export class QuickBuild {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {import('./app.js').BuilderApp} app
   */
  constructor(dialog, app) {
    this._dialog = dialog;
    this._app = app;
    this._store = new Store(blankAnswers());
    // Every answer can change which of the later questions apply, so the form
    // is redrawn on each change — the same way the main panels work.
    this._store.subscribe(() => this._renderBody());
    this._body = h('div.quick-body', {});
  }

  /** Draw the dialog and show it. */
  open() {
    replaceChildren(this._dialog, [
      h('header.tool-head', {}, [
        h('h2.tool-title', { text: t('Quick build') }),
        h('button.icon-btn', {
          type: 'button',
          text: '×',
          title: t('Close'),
          'aria-label': t('Close'),
          onClick: () => this._dialog.close(),
        }),
      ]),
      h('p.tool-hint', {
        text: t('Answer what matters and the rest takes sensible defaults. The full form '
          + 'opens with your answers in it, so nothing here is a decision you are stuck with.'),
      }),
      this._body,
      h('div.tool-row.quick-actions', {}, [
        h('button.btn.btn-primary', {
          type: 'button',
          text: t('Build it'),
          onClick: () => this._commit(),
        }),
        h('button.btn.btn-lcd.btn-quiet', {
          type: 'button',
          text: t('Start the answers again'),
          onClick: () => this._store.replace(blankAnswers()),
        }),
      ]),
    ]);
    this._renderBody();
    this._dialog.showModal();
  }

  _renderBody() {
    // Same rebuild-from-state as the main form, so it needs the same caret
    // rescue: without it every keystroke in a text field would drop focus.
    keepingFocus(() => {
      replaceChildren(this._body, [renderFields(quickFields(), this._store, { idPrefix: 'q' })]);
    });
  }

  _commit() {
    if (!confirm(t('Replace everything in the form with these answers?'))) return;
    this._app.replaceConfig(configFromAnswers(this._store.state));
    this._dialog.close();
    this._app.toast(t('Built. Everything is in the form below.'), 'ok');
  }
}
