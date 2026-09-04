/**
 * Farm-zone emission.
 *
 * The host only offers `moveToRectangle(x1, y1, x2, y2)` for a single box. To
 * work several patches of grass and move between them on a schedule, the script
 * carries a `ZONES` table plus a picker; a rectangle that is really a line is
 * patrolled end to end with `moveToCell`, because `moveToRectangle` on a
 * zero-width box would leave the bot standing still.
 *
 * A period that hunts somewhere else needs patches of its own — a rectangle
 * measured in one forest means nothing on another map — so each leg may bring
 * its own list and the picker chooses between them at runtime.
 */

import { section } from '../core/lua-writer.js';
import { parseZones } from '../domain/zone.js';

/** Rotation modes driven by a clock rather than an event. */
const TIMED_MODES = new Set(['fixed', 'random', 'chaotic']);
/** Rotation modes triggered by something that happens in the run. */
const EVENT_MODES = new Set(['onHeal', 'onWin']);
const SECONDS_PER_MINUTE = 60;
/** Shortest gap the fully-random mode will ever pick. */
const CHAOTIC_FLOOR_SECONDS = 60;

/**
 * @typedef {import('../core/lua-writer.js').LuaWriter} LuaWriter
 * @typedef {import('../domain/zone.js').Zone} Zone
 *
 * @typedef {object} ZoneSet
 * @property {string} id     'day', or the period whose patches these are
 * @property {string} guard  Lua condition selecting this set, '' for the default
 * @property {string} table  the Lua table name
 * @property {Zone[]} zones
 *
 * @typedef {object} ZonePlan
 * @property {boolean} active     true when the script should use zones at all
 * @property {Zone[]} zones       the default set, kept for the lint and the tests
 * @property {ZoneSet[]} sets     one per list in play; always at least one when active
 * @property {string} mode        rotation mode id
 * @property {boolean} rotates    true when there is more than one zone to rotate between
 * @property {boolean} timed      rotation is driven by a clock
 * @property {boolean} eventDriven rotation is driven by a heal or a win
 * @property {boolean} anyFlat    at least one zone is a line and needs patrolling
 * @property {number} minMinutes  lower bound of the rotation interval
 * @property {number} maxMinutes  upper bound, never below `minMinutes`
 * @property {string[]} invalid   zone strings that could not be parsed
 */

/**
 * Work out what, if anything, the zone system has to do.
 *
 * @param {object} config
 * @param {import('./route-plan.js').RoutePlan} [plan] route legs, for per-period patches
 * @returns {ZonePlan}
 */
export function planZones(config, plan) {
  const { zones, invalid } = parseZones(config.route.zones);
  const rotation = config.route.zoneRotation ?? {};
  const mode = rotation.mode ?? 'fixed';

  /** @type {ZoneSet[]} */
  const sets = [];
  for (const leg of plan?.legs ?? []) {
    if (!leg.guard || !leg.zones.length) continue;
    const parsed = parseZones(leg.zones);
    invalid.push(...parsed.invalid);
    if (!parsed.zones.length) continue;
    sets.push({
      id: leg.id,
      guard: leg.guard,
      table: `ZONES_${leg.id.toUpperCase()}`,
      zones: parsed.zones,
    });
  }
  if (zones.length) sets.push({ id: 'day', guard: '', table: 'ZONES', zones });

  // A period's rectangles are measured on that period's map, so they are not a
  // stand-in for the times it is not running: without a default list the other
  // periods hunt the plain way instead.
  const hasDefault = sets.some((set) => !set.guard);
  const rotates = sets.some((set) => set.zones.length > 1);

  // A reversed range would reach `math.random(hi, lo)`, which errors at
  // runtime, so the upper bound is never allowed below the lower one.
  const minMinutes = Math.max(1, Number.parseInt(String(rotation.min ?? 30), 10) || 30);
  const maxMinutes = Math.max(minMinutes, Number.parseInt(String(rotation.max ?? 60), 10) || 60);

  return {
    minMinutes,
    maxMinutes,
    active: sets.length > 0,
    hasDefault,
    zones,
    sets,
    mode,
    rotates,
    timed: rotates && TIMED_MODES.has(mode),
    eventDriven: rotates && EVENT_MODES.has(mode),
    anyFlat: sets.some((set) => set.zones.some((zone) => zone.flat)),
    invalid,
  };
}

/**
 * State the zone system keeps between frames.
 *
 * @param {LuaWriter} writer
 * @param {ZonePlan} plan
 */
export function emitZoneState(writer, plan) {
  if (!plan.active) return;
  writer.line('local zoneIdx     = 1');
  if (plan.timed) {
    writer.line('local zoneTimer   = 0 -- os.time() the current zone was entered');
    writer.line('local zoneDue     = 0 -- seconds to stay before rerolling');
  }
  if (plan.eventDriven) {
    writer.line('local zoneReroll  = false -- set by the event that triggers a move');
  }
  if (plan.anyFlat) {
    writer.line('local zoneFlip    = false -- which end of a line zone to walk to');
  }
}

/**
 * The `ZONES` tables and the `farmZone()` picker.
 *
 * @param {LuaWriter} writer
 * @param {ZonePlan} plan
 */
export function emitZones(writer, plan) {
  if (!plan.active) return;
  const minSeconds = plan.minMinutes * SECONDS_PER_MINUTE;
  const maxSeconds = plan.maxMinutes * SECONDS_PER_MINUTE;
  const many = plan.sets.length > 1;

  section(writer, 'Farm zones');
  for (const set of plan.sets) emitZoneTable(writer, set);

  // One list with no guard needs no runtime choice; anything else does, and a
  // set of lists that are all guarded can legitimately answer "none right now".
  const chooses = many || !plan.hasDefault;
  if (chooses) {
    writer.comment('Each period works its own patches.');
    if (!plan.hasDefault) writer.comment('Outside those periods there are none, and hunting is plain.');
    writer.fn('activeZones()', (w) => {
      for (const set of plan.sets) {
        if (!set.guard) {
          w.line(`return ${set.table}`);
          continue;
        }
        w.useHost(set.guard.replace('()', ''));
        w.line(`if ${set.guard} then return ${set.table} end`);
      }
      if (!plan.hasDefault) w.line('return nil');
    }, { local: true });
    writer.blank();
  }

  if (plan.rotates) {
    writer.comment('Never reroll onto the zone we are already working.');
    writer.fn('rerollZone(set)', (w) => {
      w.line('local pick = math.random(#set)');
      w.line('if pick == zoneIdx then pick = (pick % #set) + 1 end');
      w.line('zoneIdx = pick');
    }, { local: true });
    writer.blank();
  }

  if (plan.timed) {
    writer.comment('Seconds to spend on a zone before moving on.');
    writer.fn('zoneInterval()', (w) => {
      switch (plan.mode) {
        case 'random':
          w.line(`return math.random(${minSeconds}, ${maxSeconds})`);
          break;
        case 'chaotic':
          w.line(`return math.random(${CHAOTIC_FLOOR_SECONDS}, ${Math.max(CHAOTIC_FLOOR_SECONDS, maxSeconds)})`);
          break;
        case 'fixed':
        default:
          w.line(`return ${minSeconds}`);
      }
    }, { local: true });
    writer.blank();
  }

  writer.comment('One hunting step inside the current zone, or false when no list applies.');
  writer.fn('farmZone()', (w) => {
    // One unguarded list needs no runtime choice, so it is named outright.
    w.line(`local set = ${chooses ? 'activeZones()' : plan.sets[0].table}`);
    if (!plan.hasDefault) w.line('if not set then return false end');
    if (chooses) {
      w.comment('A shorter list for this period: start it from the top.');
      w.line('if zoneIdx > #set then zoneIdx = 1 end');
    }
    emitRotationTrigger(w, plan);
    w.line('local zone = set[zoneIdx]');
    if (plan.anyFlat) emitFlatPatrol(w);
    w.useHost('moveToRectangle');
    w.comment('moveToRectangle accepts the table directly.');
    w.line('return moveToRectangle(zone)');
  }, { local: true });
  writer.blank();
}

/**
 * @param {LuaWriter} writer
 * @param {ZoneSet} set
 */
function emitZoneTable(writer, set) {
  if (set.guard) writer.comment(`Patches worked while ${set.guard}.`);
  writer.block(`local ${set.table} = {`, (w) => {
    for (const zone of set.zones) {
      const body = `{ ${zone.x1}, ${zone.y1}, ${zone.x2}, ${zone.y2}${zone.flat ? ', flat = true' : ''} }`;
      const note = zone.flat ? ' -- a line: patrolled end to end' : '';
      w.line(`${body},${note}`);
    }
  }, '}');
  writer.blank();
}

/**
 * @param {LuaWriter} writer
 * @param {ZonePlan} plan
 */
function emitRotationTrigger(writer, plan) {
  if (!plan.rotates) return;

  if (plan.timed) {
    writer.line('local now = os.time()');
    writer.block('if zoneTimer == 0 then', (inner) => {
      inner.line('zoneTimer, zoneDue = now, zoneInterval()');
    });
    writer.block('if now - zoneTimer >= zoneDue then', (inner) => {
      inner.line('rerollZone(set)');
      inner.line('zoneTimer, zoneDue = now, zoneInterval()');
    });
    writer.blank();
    return;
  }

  writer.block('if zoneReroll then', (inner) => {
    inner.line('rerollZone(set)');
    inner.line('zoneReroll = false');
  });
  writer.blank();
}

/**
 * A one-row or one-column zone is walked from end to end, flipping the target
 * each time the bot arrives, which turns it into a patrol.
 *
 * @param {LuaWriter} writer
 */
function emitFlatPatrol(writer) {
  writer.block('if zone.flat then', (w) => {
    w.useHosts(['getPlayerX', 'getPlayerY', 'moveToCell']);
    w.line('local tx, ty = zone[1], zone[2]');
    w.line('if zoneFlip then tx, ty = zone[3], zone[4] end');
    w.block('if getPlayerX() == tx and getPlayerY() == ty then', (inner) => {
      inner.comment('Arrived: turn around and head for the other end.');
      inner.line('zoneFlip = not zoneFlip');
      inner.line('if zoneFlip then tx, ty = zone[3], zone[4] else tx, ty = zone[1], zone[2] end');
    });
    w.line('return moveToCell(tx, ty)');
  });
}
