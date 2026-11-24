# Route Mirror

[Open Route Mirror](https://coolcode.ca/routemirror/) to find Metro Vancouver bus routes whose busier direction reverses between the morning and afternoon peaks.

<!-- coolcode:guide -->
Start with route 555 on fall weekdays to see how its westbound morning lead and eastbound afternoon lead change across years. Open the repeat-reversal ranking to compare its smallest lead with other routes.
<!-- /coolcode:guide -->

## Reading the records

The importer discovers the newest linked TSPR bus peak-load CSV and selects the 06 and 15 time bands. The measure is the published average peak load factor in percent, allowing values above 100. The two directions must swap leads for a reversal. Rankings sort by the smaller of the AM and PM directional gaps. Missing or tied measurements cannot qualify. The source excludes discontinued routes and may omit individual cells. The figures describe historic averages at the busiest point of trips and do not measure pass-ups at a stop.

The cross-year table holds season and day type constant and compares opposing directions on the same axis. A year is comparable when both directions have morning and afternoon measurements. Tied peaks count as comparable. The repeat-reversal ranking requires the same morning leader and opposite afternoon leader in every edition year, with at least two years. Its score is the smallest directional gap across those years and peaks, in percentage points.

## Sources and maintenance

[TransLink performance review and CSV licence](https://www.translink.ca/plans-and-projects/strategies-plans-and-guidelines/managing-the-transit-network). The published snapshot includes retrieval dates in UTC and its source coverage. The page filters the downloaded data on the device and does not transmit selections.

Monthly edition check. Run `python3 scripts/refresh.py`. Automatic updates validate before publishing. Run `node --test tests/*.test.mjs`, `python3 -m unittest discover -s tests -v` and `python3 scripts/build.py`.

<!-- schedule-reliability -->
## Schedule reliability

Public GitHub repositories can have scheduled workflows disabled after 60 days of inactivity. A separate weekly [schedule guard](.github/workflows/schedule-guard.yml) calls GitHub's enable-workflow API for an explicit list of refresh workflows and itself. It can restore workflows disabled for inactivity, preserves manually disabled workflows, and runs independently of collection failures.

This is an interim mitigation, not a scheduling guarantee: GitHub does not document active-workflow renewal as a permanent exemption, and scheduled runs can be delayed or dropped. A scheduler on our own Linux server is the planned independent trigger. The guard does not collect data, create dummy commits, or change source/check timestamps; successful collection and published data freshness still need monitoring.
<!-- /schedule-reliability -->

## Search metadata

The build emits a descriptive page title, canonical URL, social preview metadata and
static `WebApplication` JSON-LD for the free browser tool. The visible application
name stays unchanged. Edit the search title in `web/index.html`; application details
come from `tool.json`. No ratings or reviews are invented.
