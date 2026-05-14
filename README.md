# ocarc-storm-reports

Orange County Amateur Radio Club weather reporting module.

## What It Does

This is a static Leaflet map for OCARC severe weather operations. It can show:

- NWS active alert polygons and county highlighting for the configured counties.
- Local storm reports submitted through the club's reporting workflow.
- Report markers with type-specific icons for hail, flooding, wind, power outage, snow, tornado, and funnel reports.
- Report filters, latest-report list, popups, and a visible refresh timestamp.

## Google Sheet Setup

The map is currently configured to read the OCARC response sheet through its Google Sheets `gviz` CSV URL. It can also use a normal Google Sheet share URL, a published CSV URL, or another Google Sheets `gviz` CSV URL.

1. Open the response spreadsheet connected to the Google Form.
2. Choose `File` -> `Share` -> `Publish to web`.
3. Publish the response sheet as CSV.
4. Copy the CSV URL.
5. Paste it into `GOOGLE_SHEET_CSV_URL` in `stormmap.html` if the response sheet changes.

If the sheet is shared publicly as "Anyone with the link can view," you can also paste the normal `/edit?usp=sharing` URL. The map will convert it to the CSV endpoint.

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

Because the app fetches remote NWS and Google Sheet data, serve it through a local web server during testing:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/stormmap.html
```
