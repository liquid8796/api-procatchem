/**
 * Custom-rules mode: the battle plan is whatever the rules editor describes,
 * rather than the fixed weaken → status → ball pipeline of hunt mode.
 */

import { emitRuleDispatch, emitRules, planRules } from '../rules.js';

/** @type {import('../mode-registry.js').FarmMode} */
export const rulesMode = {
  id: 'rules',
  label: 'Custom rules',
  icon: '⚙',
  tagline: 'Write the battle logic yourself',
  description:
    'Build your own rules from nested conditions and ordered steps. Use it when the '
    + 'fixed pipelines cannot express what you need.',
  traits: {
    usesTargetFilters: false,
    usesWeaken: false,
    usesBalls: false,
    usesEvStat: false,
    engagesEveryEncounter: false,
  },

  analyse(config) {
    const plan = planRules(config);
    return {
      slotHelpers: plan.usesMoveHelper,
      statusHelper: false,
      trapFlag: plan.usesTrapFlag,
      onceFlags: plan.usesOnce,
      conditionHelpers: plan.conditionHelpers,
    };
  },

  emitHelpers(writer, context) {
    emitRules(writer, planRules(context.config));
  },

  emitEngagement(writer, context) {
    emitRuleDispatch(writer, planRules(context.config));
  },
};
