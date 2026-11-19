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
