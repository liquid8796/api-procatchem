/**
 * Gold mode: knock out every wild encounter and track the money earned.
 *
 * Mechanically the same fight loop as EXP mode; it differs in what the session
 * summary reports, which the shared counters already handle.
 */

import { emitKnockoutSequence } from '../battle.js';

/** @type {import('../mode-registry.js').FarmMode} */
export const goldMode = {
  id: 'gold',
  label: 'Farm gold',
  icon: '¥',
  tagline: 'Fight for money and track the profit',
  description:
    'Fights everything and reports the money earned since the script started. '
    + 'Best on maps with high-payout wild Pokémon or held items worth selling.',
  traits: {
    usesTargetFilters: false,
    usesWeaken: false,
    usesBalls: false,
    usesEvStat: false,
    engagesEveryEncounter: true,
  },

  emitHelpers(writer) {
    emitKnockoutSequence(writer);
  },

  emitEngagement(writer) {
    writer.comment('Every knock-out adds to the payout.');
    writer.line('return knockOut()');
  },
};
