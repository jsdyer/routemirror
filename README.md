# Route Mirror

[Open Route Mirror](https://coolcode.ca/routemirror/) to find Metro Vancouver bus routes whose busier direction reverses between the morning and afternoon peaks.

<!-- coolcode:guide -->
Start with route 555 on fall weekdays. Compare earlier years, or open the reversal ranking to find other routes with a pronounced morning and afternoon switch.
<!-- /coolcode:guide -->

## Reading the records

The importer discovers the newest linked TSPR bus peak-load CSV and selects the 06 and 15 time bands. The measure is the published average peak load factor in percent, allowing values above 100. The two directions must swap leads for a reversal. Rankings sort by the smaller of the AM and PM directional gaps. Missing or tied measurements cannot qualify. The source excludes discontinued routes and may omit individual cells. The figures describe historic averages at the busiest point of trips and do not measure pass-ups at a stop.

## Sources and maintenance

[TransLink performance review and CSV licence](https://www.translink.ca/plans-and-projects/strategies-plans-and-guidelines/managing-the-transit-network). The published snapshot includes retrieval dates in UTC and its source coverage. The page filters the downloaded data on the device and does not transmit selections.

Monthly edition check. Run `python3 scripts/refresh.py`. Automatic updates validate before publishing. Run `node --test tests/*.test.mjs`, `python3 -m unittest discover -s tests -v` and `python3 scripts/build.py`.
