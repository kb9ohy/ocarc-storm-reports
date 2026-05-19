var DEFAULT_TARGET_COUNTIES = ["INC117", "INC037", "INC175", "INC025", "INC043", "INC093", "INC101"];
var DEFAULT_TARGET_STATES = ["IN"];
var COUNTY_SELECTION_STORAGE_KEY = "ocarcStormReportSelectedCountiesV2";
var STATE_SELECTION_STORAGE_KEY = "ocarcStormReportSelectedStatesV2";
var COUNTY_GEOJSON_URL = "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json";
var NWS_ALERT_URL = "https://api.weather.gov/alerts/active?area=";
var LIGHTNING_DATA_URL = "";
var LIGHTNING_WINDOW_MINUTES = 20;
var LIGHTNING_ALERT_THRESHOLD = 10;
var LIGHTNING_TARGET_COUNTIES = [
    { code: "INC117", name: "Orange" },
    { code: "INC175", name: "Washington" },
    { code: "INC025", name: "Crawford" }
];

var STATE_BY_FIPS = {
    "01": { abbr: "AL", name: "Alabama" }, "02": { abbr: "AK", name: "Alaska" },
    "04": { abbr: "AZ", name: "Arizona" }, "05": { abbr: "AR", name: "Arkansas" },
    "06": { abbr: "CA", name: "California" }, "08": { abbr: "CO", name: "Colorado" },
    "09": { abbr: "CT", name: "Connecticut" }, "10": { abbr: "DE", name: "Delaware" },
    "11": { abbr: "DC", name: "District of Columbia" }, "12": { abbr: "FL", name: "Florida" },
    "13": { abbr: "GA", name: "Georgia" }, "15": { abbr: "HI", name: "Hawaii" },
    "16": { abbr: "ID", name: "Idaho" }, "17": { abbr: "IL", name: "Illinois" },
    "18": { abbr: "IN", name: "Indiana" }, "19": { abbr: "IA", name: "Iowa" },
    "20": { abbr: "KS", name: "Kansas" }, "21": { abbr: "KY", name: "Kentucky" },
    "22": { abbr: "LA", name: "Louisiana" }, "23": { abbr: "ME", name: "Maine" },
    "24": { abbr: "MD", name: "Maryland" }, "25": { abbr: "MA", name: "Massachusetts" },
    "26": { abbr: "MI", name: "Michigan" }, "27": { abbr: "MN", name: "Minnesota" },
    "28": { abbr: "MS", name: "Mississippi" }, "29": { abbr: "MO", name: "Missouri" },
    "30": { abbr: "MT", name: "Montana" }, "31": { abbr: "NE", name: "Nebraska" },
    "32": { abbr: "NV", name: "Nevada" }, "33": { abbr: "NH", name: "New Hampshire" },
    "34": { abbr: "NJ", name: "New Jersey" }, "35": { abbr: "NM", name: "New Mexico" },
    "36": { abbr: "NY", name: "New York" }, "37": { abbr: "NC", name: "North Carolina" },
    "38": { abbr: "ND", name: "North Dakota" }, "39": { abbr: "OH", name: "Ohio" },
    "40": { abbr: "OK", name: "Oklahoma" }, "41": { abbr: "OR", name: "Oregon" },
    "42": { abbr: "PA", name: "Pennsylvania" }, "44": { abbr: "RI", name: "Rhode Island" },
    "45": { abbr: "SC", name: "South Carolina" }, "46": { abbr: "SD", name: "South Dakota" },
    "47": { abbr: "TN", name: "Tennessee" }, "48": { abbr: "TX", name: "Texas" },
    "49": { abbr: "UT", name: "Utah" }, "50": { abbr: "VT", name: "Vermont" },
    "51": { abbr: "VA", name: "Virginia" }, "53": { abbr: "WA", name: "Washington" },
    "54": { abbr: "WV", name: "West Virginia" }, "55": { abbr: "WI", name: "Wisconsin" },
    "56": { abbr: "WY", name: "Wyoming" }
};

var countyLayer = null;
var nwsLayer = null;
var countyCatalog = [];
var countyNameByCode = {};
var countyGeometryByCode = {};
var sameToCountyCode = {};
var countyAlertStatus = {};
var countyBoundariesReady = false;
var lightningStatusByCounty = {};
var lightningDataState = { status: "not-configured", message: "Lightning source not configured." };
var selectedStateCodes = loadSelectedStateCodes();
var selectedCountyCodes = loadSelectedCountyCodes();

var stateList = document.getElementById("stateList");
var countySearch = document.getElementById("countySearch");
var selectAllCounties = document.getElementById("selectAllCounties");
var clearCounties = document.getElementById("clearCounties");
var resetCounties = document.getElementById("resetCounties");
var countySelectionSummary = document.getElementById("countySelectionSummary");
var countyList = document.getElementById("countyList");
var alertCount = document.getElementById("alertCount");
var lightningGrid = document.getElementById("lightningGrid");
var lightningMessage = document.getElementById("lightningMessage");
var lightningSummary = document.getElementById("lightningSummary");

initAlertLayers();

function initAlertLayers() {
    if (!window.L || !window.map) return;

    createAlertPanes();
    countyLayer = L.geoJSON(null, {
        pane: "countyPane",
        interactive: false,
        style: function() {
            return { color: "#98a2b3", weight: 0.8, fillOpacity: 0 };
        }
    }).addTo(map);
    nwsLayer = L.layerGroup().addTo(map);

    buildStateFilters();
    buildLightningIndicators();
    bindSetupEvents();
    loadCountyBoundaries();
    loadNWSAlerts();
}

function createAlertPanes() {
    var panes = [
        ["countyPane", 410],
        ["alertLowPane", 430],
        ["alertModeratePane", 440],
        ["alertWatchPane", 450],
        ["alertWarningPane", 470],
        ["alertHighPane", 490]
    ];

    panes.forEach(function(item) {
        if (!map.getPane(item[0])) {
            map.createPane(item[0]);
            map.getPane(item[0]).style.zIndex = item[1];
        }
    });
}

function bindSetupEvents() {
    if (countySearch) countySearch.addEventListener("input", renderCountySetup);
    if (selectAllCounties) {
        selectAllCounties.addEventListener("click", function() {
            setSelectedCountyCodes(countyCatalog.filter(function(county) {
                return selectedStateCodes.indexOf(county.state) !== -1;
            }).map(function(county) {
                return county.code;
            }));
        });
    }
    if (clearCounties) clearCounties.addEventListener("click", function() { setSelectedCountyCodes([]); });
    if (resetCounties) {
        resetCounties.addEventListener("click", function() {
            setSelectedStateCodes(DEFAULT_TARGET_STATES.slice());
            setSelectedCountyCodes(DEFAULT_TARGET_COUNTIES.slice());
        });
    }
    if (refreshButton) {
        refreshButton.addEventListener("click", loadNWSAlerts);
        refreshButton.addEventListener("click", loadLightningData);
    }
}

function loadCountyBoundaries() {
    fetch(COUNTY_GEOJSON_URL)
        .then(function(response) {
            if (!response.ok) throw new Error("County boundary load failed");
            return response.json();
        })
        .then(function(data) {
            countyLayer.addData(data);
            buildCountyCatalog(data.features || []);
            selectedCountyCodes = selectedCountyCodes.filter(function(code) {
                return countyNameByCode[code];
            });
            saveSelectedCountyCodes();
            renderCountySetup();
            updateCountyStyles();
            syncReportCountyOptions();
            countyBoundariesReady = true;
            renderLightningIndicators();
            loadLightningData();
            loadNWSAlerts();
        })
        .catch(function(error) {
            setAlertStatus("County boundaries unavailable: " + error.message, true);
        });
}

function loadNWSAlerts() {
    if (!nwsLayer || selectedStateCodes.length === 0) return Promise.resolve();

    setAlertStatus("Loading alerts...");
    var requests = selectedStateCodes.map(function(stateCode) {
        return fetch(NWS_ALERT_URL + encodeURIComponent(stateCode), {
            headers: { "Accept": "application/geo+json" },
            cache: "no-store"
        }).then(function(response) {
            if (!response.ok) throw new Error("NWS alerts unavailable for " + stateCode);
            return response.json();
        });
    });

    return Promise.all(requests)
        .then(function(results) {
            nwsLayer.clearLayers();
            countyAlertStatus = {};

            var features = [];
            results.forEach(function(data) {
                features = features.concat(data.features || []);
            });

            var matchedFeatures = features.map(function(feature) {
                var props = feature.properties || {};
                var geocode = props.geocode || {};
                var matched = getMatchedTargetCounties(geocode.UGC || [], geocode.SAME || []);
                return { feature: feature, matched: matched, priority: getAlertFeaturePriority(feature) };
            }).filter(function(item) {
                return item.matched.length > 0;
            }).sort(function(a, b) {
                return a.priority - b.priority;
            });

            matchedFeatures.forEach(drawAlertFeature);
            updateCountyStyles();
            setAlertStatus(matchedFeatures.length + (matchedFeatures.length === 1 ? " alert" : " alerts"));
        })
        .catch(function(error) {
            setAlertStatus("Alert load issue", true);
            if (systemStatus) setStatus("NWS alert issue: " + error.message, true);
        });
}

function drawAlertFeature(item) {
    var feature = item.feature;
    var props = feature.properties || {};
    var level = getSeverityLevel(props.severity);
    var eventName = props.event || "";
    var priority = getAlertFeaturePriority(feature);

    item.matched.forEach(function(code) {
        if (!countyAlertStatus[code] || priority > countyAlertStatus[code].priority) {
            countyAlertStatus[code] = { level: level, priority: priority };
        }
    });

    if (!feature.geometry) return;

    var severityStyle = getSeverityStyle(level);
    var alertLayer = L.geoJSON(feature, {
        pane: getAlertPane(eventName, level),
        style: {
            color: severityStyle.color,
            weight: level === "high" ? 2.5 : 2,
            opacity: 0.95,
            fillColor: severityStyle.fillColor,
            fillOpacity: severityStyle.fillOpacity
        }
    }).bindPopup(buildAlertPopup(props)).addTo(nwsLayer);

    if (level === "high") {
        alertLayer.eachLayer(function(layer) {
            if (layer._path) layer._path.classList.add("highSeverityPolygon");
        });
    }
}

function getMatchedTargetCounties(ugcCodes, sameCodes) {
    var matched = ugcCodes.filter(function(code) {
        return selectedCountyCodes.indexOf(code) !== -1;
    });

    sameCodes.forEach(function(code) {
        var countyCode = sameToCountyCode[String(code)];
        if (countyCode && matched.indexOf(countyCode) === -1 && selectedCountyCodes.indexOf(countyCode) !== -1) {
            matched.push(countyCode);
        }
    });

    return matched;
}

function buildCountyCatalog(features) {
    countyCatalog = features.map(function(feature) {
        var fips = String(feature.id || "");
        var state = STATE_BY_FIPS[fips.substring(0, 2)];
        if (!state) return null;
        var code = state.abbr + "C" + fips.substring(2);
        var name = feature.properties && feature.properties.NAME ? feature.properties.NAME : code;
        var same = "0" + fips;
        countyNameByCode[code] = name;
        countyGeometryByCode[code] = feature.geometry;
        sameToCountyCode[same] = code;
        sameToCountyCode[fips] = code;
        return { code: code, name: name, same: same, state: state.abbr, stateName: state.name };
    }).filter(Boolean).sort(function(a, b) {
        if (a.stateName !== b.stateName) return a.stateName.localeCompare(b.stateName);
        return a.name.localeCompare(b.name);
    });
}

function loadLightningData() {
    var lightningUrl = getLightningUrl();
    resetLightningStatus();

    if (!lightningUrl) {
        lightningDataState = { status: "not-configured", message: "Lightning source not configured." };
        renderLightningIndicators();
        return Promise.resolve();
    }

    if (!countyBoundariesReady) {
        lightningDataState = { status: "loading", message: "Waiting for county boundaries..." };
        renderLightningIndicators();
        return Promise.resolve();
    }

    lightningDataState = { status: "loading", message: "Loading lightning data..." };
    renderLightningIndicators();

    return fetch(lightningUrl, { cache: "no-store" })
        .then(function(response) {
            if (!response.ok) throw new Error("Lightning data unavailable");
            return response.text();
        })
        .then(function(text) {
            var strikes = normalizeLightningStrikes(text);
            countLightningStrikes(strikes);
            lightningDataState = {
                status: "loaded",
                message: "Last " + LIGHTNING_WINDOW_MINUTES + " minutes | alert at " + LIGHTNING_ALERT_THRESHOLD + "+ strikes"
            };
            renderLightningIndicators();
        })
        .catch(function(error) {
            lightningDataState = { status: "issue", message: "Lightning issue: " + error.message };
            renderLightningIndicators();
        });
}

function buildLightningIndicators() {
    if (!lightningGrid) return;
    lightningGrid.innerHTML = "";
    LIGHTNING_TARGET_COUNTIES.forEach(function(county) {
        lightningStatusByCounty[county.code] = { count: 0 };

        var card = document.createElement("div");
        card.className = "lightningCard";
        card.id = "lightning-" + county.code;
        card.innerHTML = [
            '<span class="lightningLed" aria-hidden="true"></span>',
            '<span>',
            '<span class="lightningCounty">' + escapeHtml(county.name) + '</span>',
            '<span class="lightningDetail">Waiting for source</span>',
            '</span>',
            '<span class="lightningCount">--</span>'
        ].join("");
        lightningGrid.appendChild(card);
    });
}

function resetLightningStatus() {
    LIGHTNING_TARGET_COUNTIES.forEach(function(county) {
        lightningStatusByCounty[county.code] = { count: 0 };
    });
}

function renderLightningIndicators() {
    var loaded = lightningDataState.status === "loaded";
    var alerting = 0;

    LIGHTNING_TARGET_COUNTIES.forEach(function(county) {
        var status = lightningStatusByCounty[county.code] || { count: 0 };
        var card = document.getElementById("lightning-" + county.code);
        if (!card) return;

        var isAlert = loaded && status.count >= LIGHTNING_ALERT_THRESHOLD;
        if (isAlert) alerting++;

        card.querySelector(".lightningLed").className = "lightningLed" + (isAlert ? " alert" : (loaded ? " ok" : ""));
        card.querySelector(".lightningDetail").textContent = loaded ? "Strikes in county" : "Waiting for source";
        card.querySelector(".lightningCount").textContent = loaded ? status.count : "--";
        card.setAttribute("aria-label", county.name + " County lightning status: " +
            (loaded ? status.count + " recent strikes" : lightningDataState.message));
    });

    if (lightningMessage) lightningMessage.textContent = lightningDataState.message;
    if (lightningSummary) {
        lightningSummary.textContent = loaded ? alerting + " active" : "Standby";
        lightningSummary.classList.toggle("alertMessage", alerting > 0);
    }
}

function countLightningStrikes(strikes) {
    resetLightningStatus();
    var cutoff = Date.now() - LIGHTNING_WINDOW_MINUTES * 60000;

    strikes.forEach(function(strike) {
        if (!isValidCoordinate(strike.lat, strike.lon)) return;
        if (strike.time && strike.time.getTime() < cutoff) return;

        LIGHTNING_TARGET_COUNTIES.forEach(function(county) {
            var geometry = countyGeometryByCode[county.code];
            if (geometry && pointInGeometry(strike.lat, strike.lon, geometry)) {
                lightningStatusByCounty[county.code].count++;
            }
        });
    });
}

function normalizeLightningStrikes(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return [];

    try {
        var parsed = JSON.parse(trimmed);
        var records = Array.isArray(parsed) ? parsed : (parsed.strikes || parsed.features || parsed.data || []);
        return records.map(normalizeLightningStrike).filter(Boolean);
    } catch (error) {
        return parseLightningLines(trimmed);
    }
}

function parseLightningLines(text) {
    return text.split(/\r?\n/).map(function(line) {
        line = line.trim();
        if (!line) return null;

        if (line[0] === "{") {
            try {
                return normalizeLightningStrike(JSON.parse(line));
            } catch (error) {
                return null;
            }
        }

        var parts = line.split(",");
        if (parts.length < 2) return null;
        return normalizeLightningStrike({ lat: parts[0], lon: parts[1], time: parts[2] || "" });
    }).filter(Boolean);
}

function normalizeLightningStrike(record) {
    var props = record.properties || record;
    var coords = record.geometry && record.geometry.coordinates ? record.geometry.coordinates : null;
    var lat = Number(props.lat || props.latitude || (coords ? coords[1] : NaN));
    var lon = Number(props.lon || props.lng || props.longitude || (coords ? coords[0] : NaN));
    var time = parseLightningTime(props.time || props.timestamp || props.date || props.observedAt);

    if (!isValidCoordinate(lat, lon)) return null;
    return { lat: lat, lon: lon, time: time };
}

function parseLightningTime(value) {
    if (!value) return null;
    if (typeof value === "number") {
        if (value > 1000000000000000) return new Date(value / 1000000);
        if (value > 1000000000000) return new Date(value);
        return new Date(value * 1000);
    }

    var numeric = Number(value);
    if (Number.isFinite(numeric)) return parseLightningTime(numeric);

    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function pointInGeometry(lat, lon, geometry) {
    if (!geometry) return false;
    if (geometry.type === "Polygon") return pointInPolygon(lat, lon, geometry.coordinates);
    if (geometry.type === "MultiPolygon") {
        return geometry.coordinates.some(function(polygon) {
            return pointInPolygon(lat, lon, polygon);
        });
    }
    return false;
}

function pointInPolygon(lat, lon, rings) {
    if (!rings || !rings.length) return false;
    if (!pointInRing(lat, lon, rings[0])) return false;

    for (var i = 1; i < rings.length; i++) {
        if (pointInRing(lat, lon, rings[i])) return false;
    }
    return true;
}

function pointInRing(lat, lon, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0];
        var yi = ring[i][1];
        var xj = ring[j][0];
        var yj = ring[j][1];
        var intersects = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
}

function getLightningUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get("lightning") || LIGHTNING_DATA_URL;
}

function renderCountySetup() {
    if (!countyList || !countySelectionSummary) return;
    var query = String(countySearch && countySearch.value || "").trim().toLowerCase();
    countyList.innerHTML = "";

    var visibleCounties = countyCatalog.filter(function(county) {
        var inSelectedState = selectedStateCodes.indexOf(county.state) !== -1;
        return inSelectedState && (!query ||
            county.name.toLowerCase().indexOf(query) !== -1 ||
            county.code.toLowerCase().indexOf(query) !== -1 ||
            county.same.indexOf(query) !== -1);
    });

    countySelectionSummary.textContent = selectedCountyCodes.length + " counties selected";

    visibleCounties.forEach(function(county) {
        var label = document.createElement("label");
        label.className = "countyCheck";
        label.innerHTML = [
            '<span class="countyCheckMain">',
            '<input type="checkbox" value="' + escapeHtml(county.code) + '"' +
                (selectedCountyCodes.indexOf(county.code) !== -1 ? " checked" : "") + ">",
            '<span>' + escapeHtml(county.name + ", " + county.state) + '</span>',
            '</span>',
            '<span class="countyCode">' + escapeHtml(county.code) + '</span>'
        ].join("");
        label.querySelector("input").addEventListener("change", function(event) {
            toggleCountySelection(county.code, event.target.checked);
        });
        countyList.appendChild(label);
    });
}

function toggleCountySelection(code, isSelected) {
    var next = selectedCountyCodes.slice();
    var index = next.indexOf(code);
    if (isSelected && index === -1) next.push(code);
    if (!isSelected && index !== -1) next.splice(index, 1);
    setSelectedCountyCodes(next);
}

function setSelectedCountyCodes(codes) {
    selectedCountyCodes = countyCatalog.length ? codes.filter(function(code) {
        return countyNameByCode[code];
    }) : codes.slice();
    saveSelectedCountyCodes();
    renderCountySetup();
    updateCountyStyles();
    syncReportCountyOptions();
    loadNWSAlerts();
}

function buildStateFilters() {
    if (!stateList) return;
    stateList.innerHTML = "";
    Object.keys(STATE_BY_FIPS).map(function(fips) {
        return STATE_BY_FIPS[fips];
    }).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    }).forEach(function(state) {
        var label = document.createElement("label");
        label.className = "stateCheck";
        label.innerHTML = [
            '<span class="countyCheckMain">',
            '<input type="checkbox" value="' + state.abbr + '"' +
                (selectedStateCodes.indexOf(state.abbr) !== -1 ? " checked" : "") + ">",
            '<span>' + escapeHtml(state.name) + '</span>',
            '</span>',
            '<span class="countyCode">' + escapeHtml(state.abbr) + '</span>'
        ].join("");
        label.querySelector("input").addEventListener("change", function(event) {
            toggleStateSelection(state.abbr, event.target.checked);
        });
        stateList.appendChild(label);
    });
}

function toggleStateSelection(stateCode, isSelected) {
    var next = selectedStateCodes.slice();
    var index = next.indexOf(stateCode);
    if (isSelected && index === -1) next.push(stateCode);
    if (!isSelected && index !== -1) next.splice(index, 1);
    if (next.length === 0) return;
    setSelectedStateCodes(next);
}

function setSelectedStateCodes(codes) {
    selectedStateCodes = codes.slice();
    selectedCountyCodes = selectedCountyCodes.filter(function(code) {
        return selectedStateCodes.indexOf(code.substring(0, 2)) !== -1;
    });
    saveSelectedStateCodes();
    saveSelectedCountyCodes();
    updateStateFilters();
    renderCountySetup();
    updateCountyStyles();
    syncReportCountyOptions();
    loadNWSAlerts();
}

function updateStateFilters() {
    if (!stateList) return;
    stateList.querySelectorAll("input").forEach(function(input) {
        input.checked = selectedStateCodes.indexOf(input.value) !== -1;
    });
}

function updateCountyStyles() {
    if (!countyLayer) return;
    countyLayer.eachLayer(function(layer) {
        var fips = String(layer.feature.id || "");
        var state = STATE_BY_FIPS[fips.substring(0, 2)];
        var code = state ? state.abbr + "C" + fips.substring(2) : "";
        var statusObj = countyAlertStatus[code];
        var status = statusObj ? statusObj.level : null;
        var isSelectedState = state && selectedStateCodes.indexOf(state.abbr) !== -1;
        var isSelectedCounty = selectedCountyCodes.indexOf(code) !== -1;
        var style = { color: "#d0d5dd", weight: 0.5, fillOpacity: 0 };

        if (isSelectedState) {
            style.color = "#98a2b3";
            style.weight = 0.8;
        }

        if (isSelectedCounty) {
            style.color = status ? getSeverityStyle(status).color : "#123b66";
            style.weight = status ? 2.2 : 1.5;
        }

        layer.setStyle(style);
    });
}

function syncReportCountyOptions() {
    if (!countySelect || !countyCatalog.length) return;

    var currentValue = countySelect.value;
    var selectedCounties = selectedCountyCodes.map(function(code) {
        var item = countyCatalog.find(function(county) { return county.code === code; });
        return item ? { code: item.code, name: item.name + ", " + item.state } : null;
    }).filter(Boolean).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    countySelect.innerHTML = '<option value="">Select county</option>';
    selectedCounties.forEach(function(county) {
        countySelect.appendChild(new Option(county.name, county.code));
    });
    if (selectedCountyCodes.indexOf(currentValue) !== -1) countySelect.value = currentValue;
}

function getAlertFeaturePriority(feature) {
    var props = feature.properties || {};
    return getAlertPriority(props.event || "") * 10 + getSeverityPriority(getSeverityLevel(props.severity));
}

function getAlertPriority(eventName) {
    var eventLower = String(eventName || "").toLowerCase();
    if (eventLower.indexOf("tornado warning") !== -1) return 60;
    if (eventLower.indexOf("severe thunderstorm warning") !== -1) return 55;
    if (eventLower.indexOf("flash flood warning") !== -1) return 54;
    if (eventLower.indexOf("warning") !== -1) return 50;
    if (eventLower.indexOf("watch") !== -1) return 30;
    if (eventLower.indexOf("advisory") !== -1) return 20;
    if (eventLower.indexOf("statement") !== -1) return 10;
    return 1;
}

function getSeverityPriority(level) {
    if (level === "high") return 3;
    if (level === "moderate") return 2;
    return 1;
}

function getSeverityLevel(severity) {
    var value = String(severity || "").toLowerCase();
    if (value === "severe" || value === "extreme") return "high";
    if (value === "moderate") return "moderate";
    return "low";
}

function getSeverityStyle(level) {
    if (level === "high") return { color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.18 };
    if (level === "moderate") return { color: "#ca8a04", fillColor: "#facc15", fillOpacity: 0.2 };
    return { color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.14 };
}

function getAlertPane(eventName, level) {
    var eventLower = String(eventName || "").toLowerCase();
    if (level === "high") return "alertHighPane";
    if (eventLower.indexOf("warning") !== -1) return "alertWarningPane";
    if (eventLower.indexOf("watch") !== -1) return "alertWatchPane";
    if (level === "moderate") return "alertModeratePane";
    return "alertLowPane";
}

function buildAlertPopup(props) {
    var rows = [
        popupRow("Severity", props.severity),
        popupRow("Certainty", props.certainty),
        popupRow("Urgency", props.urgency),
        popupRow("Areas", props.areaDesc),
        popupRow("Expires", props.expires ? new Date(props.expires).toLocaleString() : "")
    ].join("");

    return '<div class="popupTitle alertMessage">' + escapeHtml(props.event || "NWS Alert") + '</div>' + rows;
}

function setAlertStatus(message, isError) {
    if (!alertCount) return;
    alertCount.textContent = message;
    alertCount.classList.toggle("alertMessage", Boolean(isError));
}

function loadSelectedCountyCodes() {
    try {
        var stored = JSON.parse(localStorage.getItem(COUNTY_SELECTION_STORAGE_KEY) || "null");
        return Array.isArray(stored) ? stored : DEFAULT_TARGET_COUNTIES.slice();
    } catch (error) {
        return DEFAULT_TARGET_COUNTIES.slice();
    }
}

function saveSelectedCountyCodes() {
    localStorage.setItem(COUNTY_SELECTION_STORAGE_KEY, JSON.stringify(selectedCountyCodes));
}

function loadSelectedStateCodes() {
    try {
        var stored = JSON.parse(localStorage.getItem(STATE_SELECTION_STORAGE_KEY) || "null");
        return Array.isArray(stored) && stored.length ? stored : DEFAULT_TARGET_STATES.slice();
    } catch (error) {
        return DEFAULT_TARGET_STATES.slice();
    }
}

function saveSelectedStateCodes() {
    localStorage.setItem(STATE_SELECTION_STORAGE_KEY, JSON.stringify(selectedStateCodes));
}
