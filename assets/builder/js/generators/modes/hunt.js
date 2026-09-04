/**
 * Hunt mode: engage only the wild Pokémon that match the target filters, and
 * do whatever the filter says they are for — usually catching them.
 */

import { emitCatchSequence, emitTargetAction, emitTargetPredicate } from '../battle.js';

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
    // Knocking a target out, fleeing it, or stopping on it needs no ball ladder,
    // and an unused tryCatch() would drag in weakening moves nobody asked for.
    if (context.config.target.onMatch === 'catch') emitCatchSequence(writer, context);
  },

  emitEngagement(writer, context) {
    writer.block('if isTarget() then', (inner) => {
      emitTargetAction(inner, context.config);
    });
  },
};
