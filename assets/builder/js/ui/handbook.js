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

import { currentLanguage, t } from '../core/i18n.js';
import { h, replaceChildren } from './dom.js';
import { renderEmitReference } from './emit-reference.js';

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
      'Time-of-day hunting gives each period as much of a route as it asks for: its own map '
      + 'with its own pair of hop tables, its own Pokécenter, its own patches, its own way '
      + 'of finding encounters, and its own answer to "what now" when farming stops. '
      + 'isMorning() / isNoon() / isNight() choose between them at runtime, and anything a '
      + 'period leaves blank falls back to the main setting. The surf guard belongs to the '
      + 'branch it is in, so surfing all morning does not strand the script on the water at noon.',
    ],
  },
  {
    id: 'built-from-parts',
    title: 'What the builder assembles for you',
    paragraphs: [
      'The API is a pile of single-purpose functions. Most of what you tick in the form is '
      + 'not one of them — it is several, plus a variable or two and some arithmetic on '
      + 'os.time(). These are the ones worth knowing about, because they explain the '
      + 'variables you will find at the top of the script.',
      'Several patches with a rotation: moveToRectangle() only knows one box, so the '
      + 'script carries a table of them and rerolls on a timer, after a heal, or after a '
      + 'won battle. A box with no width or no height is a line, and a line is patrolled '
      + 'end to end with moveToCell() instead — moveToRectangle() would just stand still on it.',
      'Mounts by priority: hasItem() decides which of the mounts you listed you actually '
      + 'own. disMount() clears the configured mount as well as dismounting, so a map you '
      + 'ticked "dismount here" leaves automatic mounting switched off; the script '
      + 'remembers that and turns it back on the moment you step off that map.',
      'Finding the way home from anywhere: the return table is not the path you walked out '
      + 'on, it is one hop for every map the link graph can reach the Pokécenter from. That '
      + 'is why a bot that logs in halfway across the region still walks back instead of '
      + 'standing there.',
      'Choosing a route by the clock: activeLeg() returns the spot, the Pokécenter and the '
      + 'two tables for whichever period it is now. When that answer changes mid-run the '
      + 'script can go via the new Pokécenter first, so the new stretch starts on a full team.',
      'Ability and held item: neither has a getter. A Trace lead copies the wild ability and '
      + 'the game says so; a Frisk lead names the item. Both arrive as text, so the script '
      + 'latches a flag in onBattleMessage() and the filter reads the flag.',
    ],
    lua: 'if mountDropped and not NO_MOUNT[map] and not isSurfing() then\n'
      + '    mountDropped = false\n'
      + '    return setMount(pickMount(LAND_MOUNTS))\n'
      + 'end',
  },
  {
    id: 'typing',
    title: 'Lists, separators, and quotes',
    paragraphs: [
      'Anywhere the form takes several values — Pokémon names, mounts, status moves, zones '
      + '— a comma, a semicolon or a new line all separate entries, and surrounding spaces '
      + 'are trimmed. Type the names the way the game spells them; the builder cannot check '
      + 'a move or an item against the game, only against the API.',
      'You never type quotes. Every text field is quoted for you when it reaches the script, '
      + 'including the awkward cases — an apostrophe in a name, a backslash, anything you '
      + 'paste in. The two places you are writing Lua yourself are the raw-expression '
      + 'condition and the arguments of "call an API function"; there, quote text values as '
      + 'Lua would: getMapName() == "Viridian City", and 10 without quotes for a number.',
      'A zone is four whole numbers: two opposite corners, in any order. The builder sorts '
      + 'them, so 20, 20, 10, 10 and 10, 10, 20, 20 are the same patch.',
    ],
  },
  {
    id: 'traps',
    title: 'Two things that read backwards',
    paragraphs: [
      'A return inside an if leaves the whole function. So the line written after that '
      + 'block is not a fallback for it — it only runs when the condition was false. In a '
      + 'catch ladder that is deliberate: when every ball has failed, a shiny hunter would '
      + 'rather the script idle than flee. That is what "when every step fails → do '
      + 'nothing" is for.',
      'Filters combine with OR by default, which is what a hunt wants: shiny or Ralts, not '
      + 'shiny Ralts. But every filter joins that OR, level and gender included — so "shiny, '
      + 'level 10 and up" reads as "shiny or level 10 and up", and everything above level '
      + 'nine is a target. A range you mean as a limit belongs with "all must match" on, or in '
      + 'a rule of its own. Read the generated isTarget() either way: it is two lines and it '
      + 'says exactly what the script will do.',
    ],
    lua: '-- Reads as "if none of the balls worked, attack". It does not:\n'
      + 'if isTarget() then\n'
      + '    return useItem("Ultra Ball") or useItem("Great Ball")\n'
      + 'end\n'
      + 'return attack() -- only reached when isTarget() was false',
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
    /** @type {string | null} the language the cached render was drawn in */
    this._renderedFor = null;
  }

  /** Draw the handbook once per language, then show it. */
  open() {
    if (this._renderedFor !== currentLanguage()) {
      replaceChildren(this._dialog, [
        h('header.tool-head', {}, [
          h('h2.tool-title', { text: t('How the generated script works') }),
          h('button.icon-btn', {
            type: 'button', text: '×', title: t('Close'), 'aria-label': t('Close'),
            onClick: () => this._dialog.close(),
          }),
        ]),
        h('nav.handbook-toc', { 'aria-label': t('Contents') }, [
          ...HANDBOOK_SECTIONS.map(
            (section) => h('a', { href: `#handbook-${section.id}`, text: t(section.title) }),
          ),
          h('a', { href: '#handbook-reference', text: t('Every choice, and what it writes') }),
        ]),
        ...HANDBOOK_SECTIONS.map((section) => h('section.tool-section', { id: `handbook-${section.id}` }, [
          h('h3.tool-subtitle', { text: t(section.title) }),
          ...section.paragraphs.map((text) => h('p.handbook-text', { text: t(text) })),
          section.lua ? h('pre.handbook-lua', {}, [h('code', { text: section.lua })]) : null,
        ])),
        h('section.tool-section', { id: 'handbook-reference' }, renderEmitReference()),
      ]);
      this._renderedFor = currentLanguage();
    }
    this._dialog.showModal();
  }
}
