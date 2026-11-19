export function pairs(record = {}) {
  return [
    ["WEST", "EAST"],
    ["NORTH", "SOUTH"],
  ].filter(([a, b]) => record[a] || record[b]);
}
export function reversals(routes) {
  const result = [];
  for (const [route, data] of Object.entries(routes)) {
    for (const [a, b] of pairs(data)) {
      const values = [
        ...(data[a] || [null, null]),
        ...(data[b] || [null, null]),
      ];
      if (!values.every(Number.isFinite)) continue;
      const [amA, pmA, amB, pmB] = values,
        am = amA - amB,
        pm = pmA - pmB;
      if (am * pm < 0)
        result.push({
          route,
          am: am > 0 ? a : b,
          pm: pm > 0 ? a : b,
          amGap: Math.abs(am),
          pmGap: Math.abs(pm),
          score: Math.min(Math.abs(am), Math.abs(pm)),
        });
    }
  }
  return result.sort(
    (a, b) =>
      b.score - a.score ||
      a.route.localeCompare(b.route, undefined, { numeric: true }),
  );
}
