const axes = [
  ["WEST", "EAST"],
  ["NORTH", "SOUTH"],
];

export function pairs(record = {}) {
  return axes.filter(([a, b]) => record[a] || record[b]);
}

function compare(record, [a, b]) {
  function peak(index) {
    const left = record[a]?.[index], right = record[b]?.[index];
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    return {
      leader: left === right ? null : left > right ? a : b,
      gap: Math.abs(left - right),
    };
  }
  const am = peak(0), pm = peak(1);
  const complete = Boolean(am && pm);
  const reversed = Boolean(am?.leader && pm?.leader && am.leader !== pm.leader);
  return { am, pm, complete, reversed };
}

function rank(results) {
  return results.sort((a, b) =>
    b.score - a.score || a.route.localeCompare(b.route, undefined, { numeric: true })
  );
}

export function reversals(routes) {
  const result = [];
  for (const [route, record] of Object.entries(routes)) {
    for (const axis of pairs(record)) {
      const { am, pm, reversed } = compare(record, axis);
      if (reversed) {
        result.push({ route, am: am.leader, pm: pm.leader, amGap: am.gap,
          pmGap: pm.gap, score: Math.min(am.gap, pm.gap) });
      }
    }
  }
  return rank(result);
}

export function routeHistory(groups, route) {
  const records = groups.map(({ year, routes }) => ({ year, record: routes[route] || {} }));
  return axes.filter(([a, b]) => records.some(({ record }) => record[a] || record[b]))
    .map((axis) => ({
      axis,
      years: records.map(({ year, record }) => ({ year, ...compare(record, axis) })),
    }));
}

export function persistentReversals(groups) {
  if (groups.length < 2) return [];
  const result = [];
  for (const route of Object.keys(groups[0].routes)) {
    for (const { years } of routeHistory(groups, route)) {
      const first = years[0];
      if (!years.every((y) => y.reversed && y.am.leader === first.am?.leader)) continue;
      result.push({
        route, am: first.am.leader, pm: first.pm.leader,
        score: Math.min(...years.flatMap((y) => [y.am.gap, y.pm.gap])),
      });
    }
  }
  return rank(result);
}

export const dayNames = {MF: "weekdays", Sat: "Saturdays", "Sun/Hol": "Sundays and holidays"};
export const routeOrder = (a, b) => a.localeCompare(b, "en-CA", {numeric: true});
export const directionName = d => d[0] + d.slice(1).toLowerCase() + "bound";
export const routeSlug = route => route.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const routePath = route => "records/routes/" + routeSlug(route) + "/";
export const conditions = data => Array.from(new Set(Object.keys(data.entries).map(k => k.split("|").slice(1).join("|"))))
  .map(k => k.split("|")).sort(([a,b],[c,d]) => a.localeCompare(c) || ["MF","Sat","Sun/Hol"].indexOf(b)-["MF","Sat","Sun/Hol"].indexOf(d));
export const conditionPath = (s,d) => "records/conditions/" + routeSlug(s) + "-" + routeSlug(d) + "/";
export const allRoutes = data => [...new Set([...Object.values(data.entries), ...Object.values(data.annual || {})]
  .flatMap(group => Object.keys(group).filter(route => Object.values(group[route]).flat().some(Number.isFinite))))].sort(routeOrder);
export const appParams = (route,year,season,day) => new URLSearchParams({route,year,season,day}).toString();
export const usableRecord = record => Object.values(record || {}).flat().some(Number.isFinite);

export function selectionFor(data, route, season = "Fall", day = "MF") {
  const years = data.years.slice().sort((a,b)=>b-a);
  const selections = conditions(data);
  const preferences = [[season,day], ...selections.filter(([s,d])=>s !== season || d !== day)];
  for (const [s,d] of preferences) {
    const y = years.find(y => usableRecord(data.entries[[y,s,d].join("|")]?.[route]));
    if (y) return {route,year:y,season:s,day:d};
  }
  const y = years.find(year=>data.annual?.[year]?.[route]);
  return y ? {route,year:y,season:preferences[0][0],day:preferences[0][1]} : null;
}
