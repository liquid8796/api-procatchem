/**
 * EXP mode: knock out every wild encounter to level the team.
 */

import { emitKnockoutSequence } from '../battle.js';

/** @type {import('../mode-registry.js').FarmMode} */
export const expMode = {
  id: 'exp',
  label: 'Farm EXP',
  icon: '★',
  tagline: 'Knock out everything you meet',
  description:
    'Fights every wild encounter to the end. Pair it with a healing rule so the script '
    + 'returns to the Pokécenter before the team is wiped.',
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
    writer.comment('Every wild encounter is worth experience.');
    writer.line('return knockOut()');
  },
};
