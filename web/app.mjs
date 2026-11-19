import { by, node, row, read, options, comma } from "./ui.mjs";
import { reversals } from "./model.mjs";
const pretty = (d) => d.charAt(0) + d.slice(1).toLowerCase() + "bound",
  pct = (v) => (v == null ? "—" : comma(v) + "%");
try {
  const data = await read("loads");
  const group = (y) =>
    data.entries[[y, by("season").value, by("day").value].join("|")] || {};
  options(
    by("year"),
    data.years
      .slice()
      .reverse()
      .map((y) => [y, y]),
  );
  by("edition").textContent =
    "Transit Service Performance Review " +
    data.edition +
    " · " +
    data.years.join(", ") +
    " · retrieved " +
    data.retrieved;
  function draw() {
    const year = by("year").value,
      route = by("route").value,
      routes = group(year),
      record = routes[route] || {};
    const ranks = reversals(routes),
      match = ranks.find((r) => r.route === route);
    by("finding").textContent = match
      ? "Route " +
        route +
        " reverses direction. " +
        pretty(match.am) +
        " is busier in the morning by " +
        comma(match.amGap) +
        " percentage points. " +
        pretty(match.pm) +
        " leads in the afternoon by " +
        comma(match.pmGap) +
        " points."
      : "Route " +
        route +
        " · " +
        (Object.values(record).flat().filter(Number.isFinite).length < 4
          ? "Some directional measurements are unavailable."
          : "The busier direction does not reverse in this selection.");
    const directions = Object.keys(record).sort(),
      chart = by("chart");
    chart.replaceChildren();
    const ceiling = Math.max(
      100,
      ...Object.values(record).flat().filter(Number.isFinite),
    );
    for (const [i, period] of ["Morning peak", "Afternoon peak"].entries()) {
      chart.append(node("h3", period));
      for (const d of directions) {
        const wrap = node("div", null, "trackline"),
          bar = node(
            "span",
            null,
            "strip " + (d === directions[0] ? "" : "second"),
          );
        const v = record[d][i];
        bar.style.width = (v == null ? 0 : (60 * v) / ceiling) + "%";
        wrap.append(
          node("span", pretty(d), "direction"),
          bar,
          node("strong", pct(v)),
        );
        chart.append(wrap);
      }
    }
    const rows = [];
    for (const y of data.years.slice().reverse()) {
      const obs = group(y)[route] || {};
      for (const d of Object.keys(obs).sort())
        rows.push(row([y, pretty(d), pct(obs[d][0]), pct(obs[d][1])]));
    }
    by("history").replaceChildren(...rows);
    by("rank").replaceChildren();
    for (const r of ranks) {
      const tr = row([
        r.route,
        pretty(r.am) + " +" + comma(r.amGap),
        pretty(r.pm) + " +" + comma(r.pmGap),
      ]);
      const button = node("button", r.route, "tablelink");
      button.type = "button";
      button.addEventListener("click", () => {
        by("route").value = r.route;
        draw();
        by("route").focus();
      });
      tr.firstChild.replaceChildren(button);
      by("rank").append(tr);
    }
    by("count").textContent = ranks.length + " directional reversals";
  }
  function updateRoutes(preferred) {
    const routes = Object.keys(group(by("year").value)).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    options(
      by("route"),
      routes.map((r) => [r, r]),
      preferred || by("route").value || "555",
    );
    draw();
  }
  for (const id of ["year", "season", "day"])
    by(id).addEventListener("change", () => updateRoutes());
  by("route").addEventListener("change", draw);
  updateRoutes("555");
} catch {
  by("finding").textContent = "The peak-load snapshot could not be loaded.";
}
