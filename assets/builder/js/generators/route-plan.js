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
 * leg; with time-of-day hunting there is one per period, each with its own
 * outbound and return hops.
 */

/**
 * @typedef {import('../domain/link-graph.js').LinkGraph} LinkGraph
 * @typedef {import('../domain/link-graph.js').Hop} Hop
 *
 * @typedef {object} RouteLeg
 * @property {string} id       'day', or the time-of-day period
 * @property {string} guard    Lua condition selecting this leg, '' for the default
 * @property {string} farmMap
 * @property {Hop[]} toFarm    hops from the Pokécenter to the hunting map
 * @property {Hop[]} toHeal    hops from the hunting map back to the Pokécenter
 *
 * @typedef {object} RouteStop
 * @property {string} map
 * @property {string} mount    'auto' | 'force' | 'off'
 * @property {string} terrain  'any' | 'water' | 'land'
 *
 * @typedef {object} RoutePlan
 * @property {'here' | 'route'} kind
 * @property {boolean} travels        true when the script has to change maps
 * @property {boolean} timeOfDay      true when the hunting map varies by period
 * @property {string} farmMap         the default hunting map, '' for "wherever you stand"
 * @property {string} pokecenterMap
 * @property {RouteLeg[]} legs
 * @property {RouteStop[]} stops      maps needing mount/terrain handling en route
 * @property {Hop[]} toFarm           the default leg's outbound hops
 * @property {Hop[]} toHeal           the default leg's return hops
 * @property {string[]} problems      blocking issues; non-empty means unusable
 */

/** Time-of-day periods, in the order the generated selector tests them. */
const PERIODS = Object.freeze([
  { id: 'morning', field: 'morningMap', host: 'isMorning' },
  { id: 'night', field: 'nightMap', host: 'isNight' },
  { id: 'noon', field: 'noonMap', host: 'isNoon' },
]);

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
    timeOfDay: false,
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

  if (!farmMap) plan.problems.push('Route mode needs a hunting map.');
  if (!pokecenterMap) plan.problems.push('Route mode needs a Pokécenter map.');
  if (plan.problems.length) return plan;

  if (linkGraph.isEmpty) {
    plan.problems.push(
      'Load a link_graph.txt before using route mode — without it the builder cannot know '
      + 'which cell warps between maps.',
    );
    return plan;
  }

  const pokecenter = linkGraph.resolveName(pokecenterMap);
  if (!pokecenter) {
    plan.problems.push(`"${pokecenterMap}" is not in the loaded link graph.`);
    return plan;
  }
  plan.pokecenterMap = pokecenter;

  const destinations = collectDestinations(config, farmMap);
  plan.timeOfDay = destinations.length > 1;

  for (const destination of destinations) {
    const resolved = linkGraph.resolveName(destination.map);
    if (!resolved) {
      plan.problems.push(`"${destination.map}" is not in the loaded link graph.`);
      continue;
    }
    plan.legs.push({
      id: destination.id,
      guard: destination.guard,
      farmMap: resolved,
      toFarm: resolved === pokecenter ? [] : resolveLeg(linkGraph, pokecenter, resolved, plan.problems),
      toHeal: resolved === pokecenter ? [] : resolveLeg(linkGraph, resolved, pokecenter, plan.problems),
    });
  }

  if (plan.problems.length) return plan;

  const defaultLeg = plan.legs.find((leg) => !leg.guard) ?? plan.legs[0];
  plan.farmMap = defaultLeg ? defaultLeg.farmMap : farmMap;
  plan.toFarm = defaultLeg ? defaultLeg.toFarm : [];
  plan.toHeal = defaultLeg ? defaultLeg.toHeal : [];
  plan.travels = plan.legs.some((leg) => leg.toFarm.length || leg.toHeal.length);
  return plan;
}

/**
 * The hunting destinations this route serves: one, or one per time-of-day
 * period that names a map of its own.
 *
 * @param {object} config
 * @param {string} farmMap
 * @returns {Array<{ id: string, map: string, guard: string }>}
 */
function collectDestinations(config, farmMap) {
  const timeOfDay = config.route.timeOfDay ?? {};
  if (!timeOfDay.enabled) return [{ id: 'day', map: farmMap, guard: '' }];

  const destinations = [];
  for (const period of PERIODS) {
    const map = String(timeOfDay[period.field] ?? '').trim();
    // A period with no map of its own falls through to the default hunting map.
    if (map && map !== farmMap) {
      destinations.push({ id: period.id, map, guard: `${period.host}()` });
    }
  }
  destinations.push({ id: 'day', map: farmMap, guard: '' });
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
    problems.push(`No path from "${from}" to "${to}" in the link graph — walk it once so the bot learns it.`);
    return [];
  }
  try {
    return linkGraph.hopsFor(path);
  } catch (error) {
    problems.push(`${error.message}. Walk that transition once to record it.`);
    return [];
  }
}
