/**
 * EV mode: fight only the wild Pokémon whose effort-value yield is exactly the
 * stat you are training, and run from everything else.
 */

import { luaString } from '../../core/lua-writer.js';
import { emitKnockoutSequence } from '../battle.js';

/** @type {import('../mode-registry.js').FarmMode} */
export const evMode = {
  id: 'ev',
  label: 'Farm EV',
  icon: '▲',
  tagline: 'Fight only clean EV yields',
  description:
    'Uses isOpponentEffortValue() so the team only ever gains the stat you picked. '
    + 'Encounters that would pollute the spread are skipped.',
  traits: {
    usesTargetFilters: false,
    usesWeaken: false,
    usesBalls: false,
    usesEvStat: true,
    engagesEveryEncounter: false,
  },

  emitHelpers(writer, context) {
    const stat = String(context.config.ev.stat || 'SPD').trim().toUpperCase();
    writer.useHost('isOpponentEffortValue');
    writer.comment('True only when the opponent yields this stat and nothing else.');
    writer.fn('yieldsWantedEv()', (w) => {
      w.line(`return isOpponentEffortValue(${luaString(stat)})`);
    }, { local: true });
    writer.blank();
    emitKnockoutSequence(writer);
  },

  emitEngagement(writer) {
    writer.block('if yieldsWantedEv() then', (inner) => {
      inner.line('return knockOut()');
    });
  },
};
