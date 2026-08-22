/**
 * Turns the route section of a config into concrete travel instructions.
 *
 * `moveToMap()` was retired by the host — calling it aborts the script — so
 * every map transition here is expressed as a `moveToCell(x, y)` step onto a
 * warp tile taken from the link graph. Planning happens before emission so the
 * UI can report an unreachable route instead of generating a script that
 * silently stalls.
 */

/**
 * @typedef {import('../domain/link-graph.js').LinkGraph} LinkGraph
 * @typedef {import('../domain/link-graph.js').Hop} Hop
 *
 * @typedef {object} RoutePlan
 * @property {'here' | 'route'} kind
 * @property {boolean} travels        true when the script has to change maps
 * @property {string} farmMap         '' means "hunt wherever the bot stands"
 * @property {string} pokecenterMap
 * @property {Hop[]} toFarm           hops from the Pokécenter to the farm map
 * @property {Hop[]} toHeal           hops from the farm map back to the Pokécenter
 * @property {string[]} problems      blocking issues; non-empty means unusable
 */

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
    farmMap,
    pokecenterMap,
    toFarm: [],
    toHeal: [],
    problems: [],
  };

  if (plan.kind === 'here') return plan;

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

  const farm = linkGraph.resolveName(farmMap);
  const pokecenter = linkGraph.resolveName(pokecenterMap);
  if (!farm) plan.problems.push(`"${farmMap}" is not in the loaded link graph.`);
  if (!pokecenter) plan.problems.push(`"${pokecenterMap}" is not in the loaded link graph.`);
  if (plan.problems.length) return plan;

  plan.farmMap = farm;
  plan.pokecenterMap = pokecenter;

  if (farm === pokecenter) {
    // Healing and hunting on one map is legitimate: no travel, just heal in place.
    return plan;
  }

  plan.toFarm = resolveLeg(linkGraph, pokecenter, farm, plan.problems);
  plan.toHeal = resolveLeg(linkGraph, farm, pokecenter, plan.problems);
  plan.travels = plan.problems.length === 0;
  return plan;
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

