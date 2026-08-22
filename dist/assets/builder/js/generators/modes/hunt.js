/**
 * Hunt mode: engage only the wild Pokémon that match the target filters, and
 * catch them.
 */

import { emitCatchSequence, emitTargetPredicate } from '../battle.js';

/** @type {import('../mode-registry.js').FarmMode} */
export const huntMode = {
  id: 'hunt',
  label: 'Hunt',
  icon: '◓',
  tagline: 'Catch what matches your filters',
  description:
    'Filters every wild encounter, weakens the ones you want, and works down a ball ladder. '
    + 'Everything else is dealt with by the fallback policy.',
  traits: {
    usesTargetFilters: true,
    usesWeaken: true,
    usesBalls: true,
    usesEvStat: false,
    engagesEveryEncounter: false,
  },

  emitHelpers(writer, context) {
    emitTargetPredicate(writer, context.config);
    emitCatchSequence(writer, context);
  },

  emitEngagement(writer) {
    writer.block('if isTarget() then', (inner) => {
      inner.line('return tryCatch()');
    });
  },
};
