/**
 * How the generated script works.
 *
 * The form explains what each setting does; this explains the shapes those
 * settings turn into, and why they are shaped that way. It is the answer to
 * "the script does something odd — is that a bug or is it deliberate?", which
 * per-field hints are too small to hold.
 *
 * Sections are data, so the reader gets a contents list for free and nothing
 * can drift out of order.
 */

import { h, replaceChildren } from './dom.js';

/**
 * @typedef {object} Section
 * @property {string} id
 * @property {string} title
 * @property {string[]} paragraphs
 * @property {string} [lua] a short worked example
 */

/**
 * @type {readonly Section[]}
 *
 * Exported so the tests can hold the quoted Lua to the generator: a worked
 * example that has drifted is worse than none.
 */
export const HANDBOOK_SECTIONS = Object.freeze([
  {
    id: 'one-action',
    title: 'One action per frame',
    paragraphs: [
      'The host calls onPathAction() outside battle and onBattleAction() inside one, over '
      + 'and over. Each call may perform at most one action — one step, one move, one item. '
      + 'Everything else about the generated script follows from that.',
      'So a sequence is not written as a list of instructions; it is written as a list of '
      + 'conditions, each of which acts and returns. The next frame starts again from the '
      + 'top and falls through whatever is already done. "Chip it to 1 HP, put it to sleep, '
      + 'then throw a ball" becomes three guarded attempts, tried in that order, every frame.',
    ],
    lua: 'if getOpponentHealth() > 1 then\n'
      + '    if useMoveFromAnySlot("False Swipe") then return true end\n'
      + 'end\n'
      + 'if not opponentStatused() then\n'
      + '    if useMoveFromAnySlot("Spore") then return true end\n'
      + 'end\n'
      + 'if useItem("Ultra Ball") then return true end',
  },
  {
    id: 'warp-cells',
    title: 'moveToMap() is retired',
    paragraphs: [
      'The host aborts any script that calls moveToMap(). Travelling from one map to the '
      + 'next is really "walk onto the tile that warps there", so the builder emits '
      + 'moveToCell(x, y) instead — one hop per map, until getMapName() reports the goal.',
      'Those tiles come from maps-cache/link_graph.txt, which the bot writes as it walks '
      + 'around. Load it in the sidebar and the builder can plan a Pokécenter loop; without '
      + 'it, only "hunt where I am standing" is available. The link-graph tools will also '
      + 'convert an older script that still calls moveToMap().',
    ],
    lua: 'local TO_FARM = {\n'
      + '    ["Pokecenter Viridian"] = { 9, 14 }, -- -> Viridian City\n'
      + '    ["Viridian City"]       = { 12, 3 }, -- -> Viridian Forest\n'
      + '}\n'
      + 'local function walk(hops)\n'
      + '    local hop = hops[getMapName()]\n'
      + '    if hop then return moveToCell(hop[1], hop[2]) end\n'
      + '    return false\n'
      + 'end',
  },
  {
    id: 'farm-loop',
    title: 'The order of the farm loop',
    paragraphs: [
      'onPathAction() always works down the same list, and the first thing that acts ends '
      + 'the frame: clear the battle flags, adjust a stop\'s mount or terrain, take a break '
      + 'if one is due, do any team upkeep, and only then hunt.',
      'Team upkeep comes before hunting on purpose. Pinning an ability, rotating the lead '
      + 'or handing over a held item each cost a frame; doing them first means the script '
      + 'never starts a battle with the wrong Pokémon in front.',
      'Whether it hunts at all is decided by teamIsReady(). When that stops holding, the '
      + '"when that condition fails" setting takes over — walk back and heal, heal on the '
      + 'spot, stop, log out, or stand still.',
    ],
  },
  {
    id: 'once-per-battle',
    title: 'Once per battle',
    paragraphs: [
      'A step marked "once" is tracked in a table called F. It is cleared in '
      + 'onPathAction(), which only runs between battles — that is what makes it the reset '
      + 'point, and why nothing has to detect when a battle ended.',
      'For a move, the flag is only set once the move actually landed. A turn spent '
      + 'switching the owner in does not consume the step, so "Skill Swap once" still '
      + 'happens even when the Pokémon that knows it was not out front.',
    ],
    lua: 'local function useOnce(flag, move)\n'
      + '    if F[flag] then return false end\n'
      + '    local acted, landed = useMoveFromAnySlot(move)\n'
      + '    if landed then F[flag] = true end\n'
      + '    return acted\n'
      + 'end',
  },
  {
    id: 'heard',
    title: 'Things the game only says out loud',
    paragraphs: [
      'Some state has no getter. There is no call that asks whether your move was taunted, '
      + 'and none that reads the opponent\'s ability. The game announces both in the battle '
      + 'log, so the builder latches a flag in onBattleMessage() and the condition reads '
      + 'the flag.',
      'A flag can clear on a second phrase — "shook off the taunt" — or expire after a '
      + 'number of turns, in which case it stores the turn it was heard on rather than a '
      + 'boolean. Either way it resets between battles, along with the once-per-battle '
      + 'table.',
      'Two conditions listening for the same phrases share one flag, so repeating a check '
      + 'across several rules costs nothing.',
    ],
    lua: 'if stringContains(message, "was taunted") then heard_was_taunted_1f3a = true end\n'
      + 'if stringContains(message, "shook off the taunt") then heard_was_taunted_1f3a = false end',
  },
  {
    id: 'trapped',
    title: 'Trapped battles',
    paragraphs: [
      'Mean Look, Wrap and friends make switching fail. The script cannot see that '
      + 'directly, so onBattleMessage() watches for the refusals and raises a `trapped` '
      + 'flag; every switch is guarded on it. Without that guard a rule would spend every '
      + 'turn attempting a switch that can never happen.',
      'What to do about it is a setting, and it only applies to encounters the mode did '
      + 'not want. A target is never abandoned: running from the shiny you were trying to '
      + 'catch is worse than waiting out the trap.',
    ],
  },
  {
    id: 'zones',
    title: 'Zones, stops, and the time of day',
    paragraphs: [
      'A farm zone is two opposite corners, worked with moveToRectangle(). A zone that is '
      + 'a single row or column would leave the bot standing still, so those are patrolled '
      + 'end to end with moveToCell() instead.',
      'Stops are maps along the way that need the mount or the terrain changed before the '
      + 'route continues. They adjust state rather than run an arbitrary action, because '
      + 'an action has no completion signal — the script would repeat it forever. Being '
      + 'mounted, or being on land, is something the next frame can check.',
      'Time-of-day hunting gives each period its own hunting map and its own pair of hop '
      + 'tables, chosen at runtime by isMorning() / isNoon() / isNight().',
    ],
  },
  {
    id: 'verified',
    title: 'What "API verified" means',
    paragraphs: [
      'Every function the generated script calls is checked against the real API before '
      + 'the preview is shown — the same check the host performs when it loads a script, '
      + 'except you see the result immediately instead of watching the bot abort.',
      'It covers the raw Lua you type as well: an expression in a condition, a hand-written '
      + 'step, an imported script. What it cannot check is whether a move, item or map name '
      + 'is spelled the way the game spells it — those are strings to the API, and only the '
      + 'game knows.',
    ],
  },
]);

export class Handbook {
  /** @param {HTMLDialogElement} dialog */
  constructor(dialog) {
    this._dialog = dialog;
    this._rendered = false;
  }

  /** Draw the handbook once, then show it. */
  open() {
    if (!this._rendered) {
      replaceChildren(this._dialog, [
        h('header.tool-head', {}, [
          h('h2.tool-title', { text: 'How the generated script works' }),
          h('button.icon-btn', {
            type: 'button', text: '×', title: 'Close', 'aria-label': 'Close',
            onClick: () => this._dialog.close(),
          }),
        ]),
        h('nav.handbook-toc', { 'aria-label': 'Contents' }, HANDBOOK_SECTIONS.map(
          (section) => h('a', { href: `#handbook-${section.id}`, text: section.title }),
        )),
        ...HANDBOOK_SECTIONS.map((section) => h('section.tool-section', { id: `handbook-${section.id}` }, [
          h('h3.tool-subtitle', { text: section.title }),
          ...section.paragraphs.map((text) => h('p.handbook-text', { text })),
          section.lua ? h('pre.handbook-lua', {}, [h('code', { text: section.lua })]) : null,
        ])),
      ]);
      this._rendered = true;
    }
    this._dialog.showModal();
  }
}
