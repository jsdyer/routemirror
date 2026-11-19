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
