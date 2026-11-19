import test from "node:test";
import assert from "node:assert/strict";
import { reversals } from "../web/model.mjs";

test("rank genuine reversals by their smaller directional gap", () => {
  const routes = {
    555: { WEST: [83.3, 44.7], EAST: [32.7, 95.7] },
    22: { NORTH: [75, 70], SOUTH: [20, 105] },
    33: { NORTH: [50, 90], SOUTH: [50, 40] },
    44: { NORTH: [50, 90], SOUTH: [null, 120] },
    55: { WEST: [50, 70], EAST: [30, 10] },
  };
  const ranking = reversals(routes);
  assert.deepEqual(
    ranking.map((r) => r.route),
    ["555", "22"],
  );
  assert.equal(ranking[0].am, "WEST");
  assert.equal(ranking[0].pm, "EAST");
  assert.equal(ranking[0].score.toFixed(1), "50.6");
  assert.equal(ranking[1].score, 35);
});

import { routeHistory, persistentReversals } from "../web/model.mjs";

test("repeat ranking requires a consistent axis, direction and complete edition history", () => {
  const west = { WEST: [70, 40], EAST: [40, 80] };
  const east = { WEST: [20, 90], EAST: [60, 65] };
  const north = { NORTH: [70, 40], SOUTH: [40, 80] };
  const missing = { WEST: [null, 30], EAST: [40, 65] };
  const tied = { WEST: [55, 60], EAST: [55, 70] };
  const groups = [
    { year: 2023, routes: { 555: west, 1: north, 2: west, 3: west, 4: west, 5: tied } },
    { year: 2024, routes: { 555: { WEST: [62, 46], EAST: [43, 82] }, 1: west, 2: east, 3: missing, 5: west } },
  ];
  assert.deepEqual(persistentReversals(groups), [{ route: "555", am: "WEST", pm: "EAST", score: 19 }]);
  assert.deepEqual(persistentReversals(groups.slice(1)), []);
  assert.equal(routeHistory(groups, "5")[0].years[0].complete, true);
  assert.equal(routeHistory(groups, "5")[0].years[0].reversed, false);
  assert.equal(routeHistory(groups, "3")[0].years[1].am, null);
  assert.equal(routeHistory(groups, "3")[0].years[1].pm.leader, "EAST");
  assert.equal(routeHistory(groups, "4")[0].years[1].complete, false);
});
