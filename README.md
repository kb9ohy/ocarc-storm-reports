# ocarc-storm-reports

Orange County Amateur Radio Club weather reporting module.

## What It Does

This repository includes:

- A Net Control dashboard at `net-control/` with local report entry, review queue, map display, NWS alert focus, and lightning indicators.
- A static Leaflet storm report map at `stormmap.html` for OCARC severe weather operations.
- NWS active alert polygons and county highlighting for the configured counties.
- Local storm reports, type-specific markers, report filters, latest-report list, popups, and visible refresh timestamps.

## Net Control Lightning Indicators

The Net Control dashboard includes lightning LEDs for Orange, Washington, and Crawford Counties. Set `LIGHTNING_DATA_URL` in `net-control/alerts.js`, or pass a test URL with the `lightning` query parameter:

```text
net-control/?lightning=sample-lightning.csv
```

The lightning endpoint can return JSON, GeoJSON features, newline-delimited JSON, or simple CSV lines in this format:

```text
lat,lon,timestamp
```

The timestamp is optional. When present, only strikes in the last 20 minutes are counted. The alert threshold is controlled by `LIGHTNING_ALERT_THRESHOLD` and defaults to 10. County LEDs turn green below the threshold and flash red at 10 or more strikes.

Blitzortung/LightningMaps data is protected or permission-based for raw strike access, and their terms do not allow use as an official warning system. Use an authorized data feed or another provider that allows automated use for this dashboard.

## Google Sheet Setup

The storm map is currently configured to read the OCARC response sheet through its Google Sheets `gviz` CSV URL. It can also use a normal Google Sheet share URL, a published CSV URL, or another Google Sheets `gviz` CSV URL.

1. Open the response spreadsheet connected to the Google Form.
2. Choose `File` -> `Share` -> `Publish to web`.
3. Publish the response sheet as CSV.
4. Copy the CSV URL.
5. Paste it into `GOOGLE_SHEET_CSV_URL` in `stormmap.html` if the response sheet changes.

For testing without editing the file, pass the CSV URL as a query parameter:

```text
stormmap.html?sheet=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2F...
```

This repository also includes `sample-reports.csv` for local testing:

```text
stormmap.html?sheet=sample-reports.csv
```

## Recommended Sheet Columns

The map accepts several current form headers, but these columns make operations cleaner:

```text
Timestamp
Time Observed
Amateur Radio Callsign
Contact Number
Latitude
Longitude
Location Description
County
Weather Event
Type of WX Event
Hail Size
High Wind Speeds (Estimated)
Wind Damage Estimates
What kind of flooding was observed
Electric Provider
Snow total (Inches)
Remarks
Status
Verified
Map Visible?
```

Contact numbers should stay in the private response sheet and should not be shown on a public map.

## Local Use

Because the app fetches remote NWS, map, and optional lightning data, serve it through a local web server during testing:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```
