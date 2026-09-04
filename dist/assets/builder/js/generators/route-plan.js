/**
 * Turns the route section of a config into concrete travel instructions.
 *
 * `moveToMap()` was retired by the host — calling it aborts the script — so
 * every map transition here is expressed as a `moveToCell(x, y)` step onto a
 * warp tile taken from the link graph. Planning happens before emission so the
 * UI can report an unreachable route instead of generating a script that
 * silently stalls.
 *
 * A route has one **leg** per hunting destination. Normally that is a single
 * leg; with time-of-day hunting there is one per period, and a period may
 * redefine as much of the route as it likes — its own spot, its own
 * Pokécenter, its own patches, its own answer to "what now" when farming ends.
 */

import { t } from '../core/i18n.js';
import { TIME_PERIODS, periodFields, toStringList } from '../domain/config.js';

/**
 * @typedef {import('../domain/link-graph.js').LinkGraph} LinkGraph
 * @typedef {import('../domain/link-graph.js').Hop} Hop
 *
 * @typedef {object} RouteLeg
 * @property {string} id       'day', or the time-of-day period
 * @property {string} guard    Lua condition selecting this leg, '' for the default
 * @property {string} farmMap
 * @property {string} pokecenterMap  where this leg heals; may differ per period
 * @property {string} healAction     '' means "same as the main setting"
 * @property {string} healArgs
 * @property {string[]} zones        '' entries never appear; empty means "use the main list"
 * @property {string} endBehaviour   '' means "same as the main setting"
 * @property {Hop[]} toFarm    hops from the Pokécenter to the hunting map
 * @property {Hop[]} toHeal    hops back; covers every reachable map when recovery is on
 *
 * @typedef {object} RouteStop
 * @property {string} map
 * @property {string} mount    'auto' | 'force' | 'off'
 * @property {string} terrain  'any' | 'water' | 'land'
 *
 * @typedef {object} RoutePlan
 * @property {'here' | 'route'} kind
 * @property {boolean} travels        true when the loop itself changes maps
 * @property {boolean} walks          true when a hop table is worth emitting at all —
 *           either the loop travels, or recovery gives the bot a way home from
 *           somewhere the loop never goes
 * @property {boolean} timeOfDay      true when the hunting map varies by period
 * @property {boolean} switchesCentre true when two legs heal in different places
 * @property {boolean} recovers       true when the return tables cover the whole graph
 * @property {string} farmMap         the default hunting map, '' for "wherever you stand"
 * @property {string} pokecenterMap
 * @property {RouteLeg[]} legs
 * @property {RouteStop[]} stops      maps needing mount/terrain handling en route
 * @property {Hop[]} toFarm           the default leg's outbound hops
 * @property {Hop[]} toHeal           the default leg's return hops
 * @property {string[]} problems      blocking issues; non-empty means unusable
 */

/**
 * Time-of-day periods, in the order the generated selector tests them.
 *
 * Night is tested before noon because the selector returns on the first match
 * and those two are the pair players most often set together.
 */
const PERIODS = Object.freeze(TIME_PERIODS.map((period) => ({
  id: period.id,
  host: period.host,
  fields: periodFields(period.id),
})));

/**
 * @param {object} config
 * @param {LinkGraph} linkGraph
 * @returns {RoutePlan}
 */
export function planRoute(config, linkGraph) {
  const route = config.route;
  const farmMap = String(route.farmMap ?? '').trim();
  const pokecenterMap = String(route.pokecenterMap ?? '').trim();

  /** @type {RoutePlan} */
  const plan = {
    kind: route.kind === 'route' ? 'route' : 'here',
    travels: false,
    walks: false,
    timeOfDay: false,
    switchesCentre: false,
    recovers: false,
    farmMap,
    pokecenterMap,
    legs: [],
    stops: normaliseStops(route.stops),
    toFarm: [],
    toHeal: [],
    problems: [],
  };

  if (plan.kind === 'here') {
    // Stops describe legs of a journey; hunting in place has none.
    plan.stops = [];
    return plan;
  }

  if (!farmMap) plan.problems.push(t('Route mode needs a hunting map.'));
  if (!pokecenterMap) plan.problems.push(t('Route mode needs a Pokécenter map.'));
  if (plan.problems.length) return plan;

  if (linkGraph.isEmpty) {
    plan.problems.push(
      t('Load a link_graph.txt before using route mode — without it the builder cannot know '
        + 'which cell warps between maps.'),
    );
    return plan;
  }

  const pokecenter = linkGraph.resolveName(pokecenterMap);
  if (!pokecenter) {
    plan.problems.push(t('"{map}" is not in the loaded link graph.', { map: pokecenterMap }));
    return plan;
  }
  plan.pokecenterMap = pokecenter;
  plan.recovers = Boolean(route.recoverWhenLost);

  const destinations = collectDestinations(config, farmMap, pokecenter);
  plan.timeOfDay = destinations.length > 1;

  // Resolve every spot first: the way home has to serve whichever period the
  // clock lands on, so a leg's return table is not built until they are all
  // known.
  /** @type {Array<{ destination: object, farmMap: string, centre: string }>} */
  const resolved = [];
  for (const destination of destinations) {
    const farm = linkGraph.resolveName(destination.map);
    if (!farm) {
      plan.problems.push(t('"{map}" is not in the loaded link graph.', { map: destination.map }));
      continue;
    }
    const centre = linkGraph.resolveName(destination.pokecenter);
    if (!centre) {
      plan.problems.push(t('"{map}" is not in the loaded link graph.', { map: destination.pokecenter }));
      continue;
    }
    resolved.push({ destination, farmMap: farm, centre });
  }
  if (plan.problems.length) return plan;

  // Every spot the clock can put the bot on, so a return table can be checked
  // against all of them rather than only against its own leg.
  const spots = [...new Set(resolved.map((entry) => entry.farmMap))];
  /** @type {Map<string, Hop[]>} legs sharing a Pokécenter share its way home */
  const returnsTo = new Map();

  for (const { destination, farmMap: farm, centre } of resolved) {
    if (!returnsTo.has(centre)) {
      returnsTo.set(centre, resolveReturn(linkGraph, plan, spots, centre));
    }
    plan.legs.push({
      id: destination.id,
      guard: destination.guard,
      farmMap: farm,
      pokecenterMap: centre,
      healAction: destination.healAction,
      healArgs: destination.healArgs,
      zones: destination.zones,
      endBehaviour: destination.endBehaviour,
      toFarm: farm === centre ? [] : resolveLeg(linkGraph, centre, farm, plan.problems),
      toHeal: returnsTo.get(centre),
    });
  }

  if (plan.problems.length) return plan;

  const defaultLeg = plan.legs.find((leg) => !leg.guard) ?? plan.legs[0];
  plan.farmMap = defaultLeg ? defaultLeg.farmMap : farmMap;
  plan.pokecenterMap = defaultLeg ? defaultLeg.pokecenterMap : pokecenter;
  plan.toFarm = defaultLeg ? defaultLeg.toFarm : [];
  plan.toHeal = defaultLeg ? defaultLeg.toHeal : [];
  // Recovery rows do not make a route travel — they only say which way home is
  // if the bot ever finds itself off it.
  plan.travels = plan.legs.some((leg) => leg.farmMap !== leg.pokecenterMap);
  plan.walks = plan.travels || plan.legs.some((leg) => leg.toHeal.length > 0);
  plan.switchesCentre = new Set(plan.legs.map((leg) => leg.pokecenterMap)).size > 1;
  return plan;
}

/**
 * The way home to one Pokécenter.
 *
 * It has to work from every spot the run can be standing on, not just from the
 * leg it belongs to: the clock can move a run onto another period from
 * wherever it happens to be, and the switch walks home before going out again.
 * Recovery answers that for the whole graph; without it, the direct paths from
 * each spot are merged, which is the same guarantee for a fraction of the rows.
 *
 * @param {LinkGraph} linkGraph
 * @param {RoutePlan} plan collects any spot that cannot get here
 * @param {string[]} spots every hunting map the route can put the bot on
 * @param {string} centre
 * @returns {Hop[]}
 */
function resolveReturn(linkGraph, plan, spots, centre) {
  if (plan.recovers) {
    const hops = linkGraph.hopsToward(centre);
    const reachable = new Set(hops.map((hop) => hop.from));
    for (const spot of spots) {
      if (spot === centre || reachable.has(spot)) continue;
      // Recovery covers everything the graph can get home from, so a spot it
      // misses is genuinely one-way — a silent dead end without this.
      plan.problems.push(t('No path from "{from}" to "{to}" in the link graph — walk it once so the bot learns it.', {
        from: spot, to: centre,
      }));
    }
    return hops;
  }

  /** @type {Map<string, Hop>} keyed by the map the hop leaves, as the table is */
  const merged = new Map();
  for (const spot of spots) {
    if (spot === centre) continue;
    for (const hop of resolveLeg(linkGraph, spot, centre, plan.problems)) {
      if (!merged.has(hop.from)) merged.set(hop.from, hop);
    }
  }
  return [...merged.values()];
}

/**
 * The hunting destinations this route serves: one, or one per time-of-day
 * period that redefines something.
 *
 * A period earns a leg of its own as soon as it names a map or a Pokécenter
 * the main route does not use. Redefining only the patches or the end
 * behaviour also earns one, because those are read from the leg too.
 *
 * @param {object} config
 * @param {string} farmMap
 * @param {string} pokecenter
 * @returns {Array<{ id: string, map: string, guard: string, pokecenter: string,
 *                   healAction: string, healArgs: string, zones: string[],
 *                   endBehaviour: string }>}
 */
function collectDestinations(config, farmMap, pokecenter) {
  const main = {
    id: 'day',
    map: farmMap,
    guard: '',
    pokecenter,
    healAction: '',
    healArgs: '',
    zones: [],
    endBehaviour: '',
  };
  const timeOfDay = config.route.timeOfDay ?? {};
  if (!timeOfDay.enabled) return [main];

  const destinations = [];
  for (const period of PERIODS) {
    const fields = period.fields;
    const map = String(timeOfDay[fields.map] ?? '').trim();
    const centre = String(timeOfDay[fields.pokecenter] ?? '').trim();
    const zones = toStringList(timeOfDay[fields.zones]);
    const endBehaviour = String(timeOfDay[fields.endBehaviour] ?? '').trim();
    const healAction = String(timeOfDay[fields.healAction] ?? '').trim();
    const changesSomething = (map && map !== farmMap)
      || (centre && centre !== pokecenter)
      || zones.length > 0
      || Boolean(endBehaviour)
      || Boolean(healAction);
    if (!changesSomething) continue;

    destinations.push({
      id: period.id,
      map: map || farmMap,
      guard: `${period.host}()`,
      pokecenter: centre || pokecenter,
      healAction,
      healArgs: String(timeOfDay[fields.healArgs] ?? '').trim(),
      zones,
      endBehaviour,
    });
  }
  destinations.push(main);
  return destinations;
}

/**
 * @param {unknown} stops
 * @returns {RouteStop[]}
 */
function normaliseStops(stops) {
  if (!Array.isArray(stops)) return [];
  return stops
    .filter((stop) => stop && String(stop.map ?? '').trim())
    .map((stop) => ({
      map: String(stop.map).trim(),
      mount: stop.mount ?? 'auto',
      terrain: stop.terrain ?? 'any',
    }))
    // A stop that changes nothing would emit an empty branch.
    .filter((stop) => stop.mount !== 'auto' || stop.terrain !== 'any');
}

/**
 * Resolve one direction of travel, recording a readable problem on failure.
 *
 * @param {LinkGraph} linkGraph
 * @param {string} from
 * @param {string} to
 * @param {string[]} problems collects failures
 * @returns {Hop[]}
 */
function resolveLeg(linkGraph, from, to, problems) {
  const path = linkGraph.findRoute(from, to);
  if (!path) {
    problems.push(t('No path from "{from}" to "{to}" in the link graph — walk it once so the bot learns it.', {
      from, to,
    }));
    return [];
  }
  try {
    return linkGraph.hopsFor(path);
  } catch (error) {
    problems.push(t('{message}. Walk that transition once to record it.', { message: error.message }));
    return [];
  }
}
