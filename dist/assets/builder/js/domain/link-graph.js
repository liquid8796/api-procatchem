/**
 * PROCatchem LinkGraph v2: directed observed warp cells and destination spawns.
 * v1 cells are importable but unverified and NEVER used for routing.
 * Same-map cave warps require collision/position-aware navigation, so map-name
 * only scripts deliberately refuse to choose an arbitrary exit.
 */
import { t } from '../core/i18n.js';
export const LINK_GRAPH_HEADER = 'PROCATCHEM-LINKGRAPH';
const LEGACY = 'legacy-unknown';
const SPACED_V1 = /^(.+?)\s{2,}(-?\d+)\s+(-?\d+)\s{2,}(.+)$/;
const normalise = (name) => String(name ?? '').trim().toLowerCase();
const cellKey = (x, y) => x + '\t' + y;
const sortCell = (a, b) => a.x - b.x || a.y - b.y;
const validTimestamp = (value) => !value || (!Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/i.test(value));
/** @typedef {{x:number,y:number}} Cell */
/** @typedef {{from:string,x:number,y:number,to:string,toX:number,toY:number,confirmed:boolean,lastObservedUtc:string}} WarpEdge */
/** @typedef {WarpEdge} Hop */

export class LinkGraph {
  constructor() {
    /** @type {Map<string, Map<string, WarpEdge>>} */
    this._records = new Map();
    /** @type {Map<string, Map<string, WarpEdge[]>>} */
    this._edges = new Map();
    this._displayNames = new Map();
    this._edgeCount = 0;
    this._cellCount = 0;
  }
  get isEmpty() { return this._cellCount === 0; }
  get edgeCount() { return this._edgeCount; }
  get cellCount() { return this._cellCount; }

  static parse(text) {
    const graph = new LinkGraph();
    let skipped = 0;
    for (const raw of String(text ?? '').split(/\r?\n/)) {
      if (!raw.trim() || raw.trim().toUpperCase().startsWith(LINK_GRAPH_HEADER)) continue;
      let parts = raw.split('\t').map((v) => v.trim());
      if (parts.length === 1) {
        const relaxed = raw.match(SPACED_V1);
        if (relaxed) parts = [relaxed[1].trim(), relaxed[2], relaxed[3], relaxed[4].trim()];
      }
      if (parts.length === 8) {
        const [from,sx,sy,to,dx,dy,status,stamp] = parts;
        if ([sx,sy,dx,dy].some((v) => !/^-?\d+$/.test(v)) ||
            !['confirmed',LEGACY].includes(status) ||
            !graph.addLink(from,Number(sx),Number(sy),to,Number(dx),Number(dy),
              status === 'confirmed',stamp)) skipped += 1;
      } else if (parts.length === 4) {
        const [from,sx,sy,to] = parts;
        if (!/^-?\d+$/.test(sx) || !/^-?\d+$/.test(sy) ||
            !graph.addLink(from,Number(sx),Number(sy),to)) skipped += 1;
      } else skipped += 1;
    }
    return { graph, stats: { ...graph.stats(), skipped } };
  }

  /** Record a directed source cell. Unknown destination means NOT confirmed. */
  addLink(from,x,y,to,toX=-1,toY=-1,confirmed=false,lastObservedUtc='') {
    const fk = normalise(from), tk = normalise(to);
    if (!fk || !tk || ![x,y,toX,toY].every(Number.isInteger) ||
        typeof confirmed !== 'boolean' || !validTimestamp(lastObservedUtc) ||
        (confirmed && (toX < 0 || toY < 0))) return false;
    const edge = {
      from:String(from).trim(),x,y,to:String(to).trim(),toX,toY,confirmed,
      lastObservedUtc:String(lastObservedUtc ?? ''),
    };
    const entries = this._records.get(fk) ?? new Map();
    const old = entries.get(cellKey(x,y));
    if (old?.confirmed && !confirmed) return true; // no v1 downgrade
    if (old && old.confirmed === confirmed && normalise(old.to) === tk &&
        old.toX === toX && old.toY === toY &&
        (!lastObservedUtc || old.lastObservedUtc === lastObservedUtc)) return true;
    entries.set(cellKey(x,y),edge);
    this._records.set(fk,entries);
    this._rebuild();
    return true;
  }

  _rebuild() {
    this._edges.clear(); this._displayNames.clear();
    const pairs = new Set();
    let count = 0;
    for (const [fk,entries] of this._records) {
      for (const edge of entries.values()) {
        count += 1;
        const tk = normalise(edge.to);
        this._displayNames.set(fk,edge.from);
        this._displayNames.set(tk,edge.to);
        pairs.add(fk + '\t' + tk);
        if (!edge.confirmed || fk === tk) continue;
        const targets = this._edges.get(fk) ?? new Map();
        const list = targets.get(tk) ?? [];
        list.push(edge);
        targets.set(tk,list);
        this._edges.set(fk,targets);
      }
    }
    for (const targets of this._edges.values()) for (const list of targets.values()) list.sort(sortCell);
    this._cellCount = count; this._edgeCount = pairs.size;
  }

  allEdges() {
    return [...this._records.values()].flatMap((m) => [...m.values()].map((v) => ({...v})));
  }
  stats() {
    const records = this.allEdges();
    const confirmed = records.filter((v) => v.confirmed).length;
    return {
      maps:this.mapNames().length,edges:this.edgeCount,cells:this.cellCount,
      confirmed,unverified:records.length-confirmed,
      sameMap:records.filter((v) => normalise(v.from) === normalise(v.to)).length,
      skipped:0,
    };
  }
  hasSameMapWarp(name) {
    const key = normalise(name);
    return [...(this._records.get(key)?.values() ?? [])].some(
      (v) => normalise(v.to) === key);
  }
  mapNames() { return [...this._displayNames.values()].sort((a,b) => a.localeCompare(b)); }
  resolveName(name) { return this._displayNames.get(normalise(name)) ?? null; }
  hasMap(name) { return this._displayNames.has(normalise(name)); }
  neighbours(from) {
    return [...(this._edges.get(normalise(from))?.keys() ?? [])]
      .map((key) => this.resolveName(key)).sort((a,b) => a.localeCompare(b));
  }

  // Never choose the first of several exits to the same named map, and never
  // mistake a self-warp for reaching a new map. Both require position semantics.
  hopCell(from,to) {
    if (normalise(from) === normalise(to) || this.hasSameMapWarp(from)) return null;
    const variants = this._edges.get(normalise(from))?.get(normalise(to));
    return variants?.length === 1 ? {x:variants[0].x,y:variants[0].y} : null;
  }
  hopEdge(from,to) {
    return this.hopCell(from,to)
      ? { ...this._edges.get(normalise(from)).get(normalise(to))[0] } : null;
  }
  _safeNeighbours(from) {
    if (this.hasSameMapWarp(from)) return [];
    return [...(this._edges.get(normalise(from))?.keys() ?? [])]
      .filter((to) => this.hopCell(from,to));
  }
  findRoute(from,to) {
    const start=normalise(from),goal=normalise(to);
    if (!start || !goal || !this.hasMap(start) || !this.hasMap(goal) ||
        this.hasSameMapWarp(start) || this.hasSameMapWarp(goal)) return null;
    if (start === goal) return [this.resolveName(start)];
    const cameFrom=new Map([[start,null]]);
    const queue=[start];
    for (let i=0;i<queue.length;i+=1) {
      for (const next of this._safeNeighbours(queue[i])) {
        if (cameFrom.has(next)) continue;
        cameFrom.set(next,queue[i]);
        if (next === goal) return this._reconstruct(cameFrom,goal);
        queue.push(next);
      }
    }
    return null;
  }
  hopsFor(path) {
    const hops=[];
    for(let i=0;i<path.length-1;i+=1) {
      const edge=this.hopEdge(path[i],path[i+1]);
      if(!edge) throw new Error(t('No warp cell recorded for "{from}" -> "{to}"',{
        from:path[i],to:path[i+1],
      }));
      hops.push(edge);
    }
    return hops;
  }
  hopsToward(destination) {
    const goal=normalise(destination);
    if (!this.hasMap(goal) || this.hasSameMapWarp(goal)) return [];
    const seen=new Set([goal]);
    let frontier=[goal];
    const hops=[];
    while(frontier.length) {
      const next=[];
      for(const target of frontier) {
        for(const from of this._edges.keys()) {
          if(seen.has(from) || !this._safeNeighbours(from).includes(target)) continue;
          const edge=this.hopEdge(from,target);
          if(!edge) continue;
          seen.add(from); next.push(from); hops.push(edge);
        }
      }
      frontier=next.sort();
    }
    return hops;
  }
  toText() {
    const rows=this.allEdges().sort((a,b) =>
      normalise(a.from).localeCompare(normalise(b.from)) || sortCell(a,b))
      .map((e)=>[e.from,e.x,e.y,e.to,e.toX,e.toY,
        e.confirmed?'confirmed':LEGACY,
        e.lastObservedUtc||'0001-01-01T00:00:00.0000000Z'].join('\t'));
    return rows.length?LINK_GRAPH_HEADER+'\tv2\n'+rows.join('\n')+'\n':'';
  }
  _reconstruct(cameFrom,goal) {
    const reverse=[];
    for(let x=goal;x!=null;x=cameFrom.get(x)) reverse.push(this.resolveName(x)??x);
    return reverse.reverse();
  }
}
