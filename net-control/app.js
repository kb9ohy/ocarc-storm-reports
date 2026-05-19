var counties = [
    { code: "INC117", name: "Orange, IN" },
    { code: "INC037", name: "Dubois, IN" },
    { code: "INC175", name: "Washington, IN" },
    { code: "INC025", name: "Crawford, IN" },
    { code: "INC043", name: "Floyd, IN" },
    { code: "INC093", name: "Lawrence, IN" },
    { code: "INC101", name: "Martin, IN" }
];

var eventTypes = [
    { key: "tornado", label: "Tornado", color: "#dc2626" },
    { key: "funnel", label: "Funnel / Rotation", color: "#be123c" },
    { key: "hail", label: "Hail", color: "#7c3aed" },
    { key: "wind", label: "Wind Damage", color: "#16a34a" },
    { key: "flood", label: "Flooding", color: "#0ea5e9" },
    { key: "power", label: "Power Outage", color: "#f59e0b" },
    { key: "snow", label: "Snow / Ice", color: "#64748b" }
];

var storageKey = "ocarcStormReportsV2";
var reports = [];
var markers = {};

var map = L.map("map").setView([38.55, -86.6], 9);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
var reportLayer = L.layerGroup().addTo(map);

var reportForm = document.getElementById("reportForm");
var countySelect = document.getElementById("county");
var eventTypeSelect = document.getElementById("eventType");
var typeFilter = document.getElementById("typeFilter");
var statusFilter = document.getElementById("statusFilter");
var dynamicFields = document.getElementById("dynamicFields");
var reportList = document.getElementById("reportList");
var reportCount = document.getElementById("reportCount");
var systemStatus = document.getElementById("systemStatus");
var gpsButton = document.getElementById("gpsButton");
var clearFormButton = document.getElementById("clearFormButton");
var exportButton = document.getElementById("exportButton");
var refreshButton = document.getElementById("refreshButton");

init();

function init() {
    populateSelects();
    reports = loadReports();
    eventTypeSelect.addEventListener("change", renderDynamicFields);
    reportForm.addEventListener("submit", handleSubmit);
    statusFilter.addEventListener("change", renderReports);
    typeFilter.addEventListener("change", renderReports);
    gpsButton.addEventListener("click", captureGps);
    clearFormButton.addEventListener("click", function() {
        reportForm.reset();
        renderDynamicFields();
    });
    exportButton.addEventListener("click", exportCsv);
    refreshButton.addEventListener("click", renderReports);
    renderDynamicFields();
    renderReports();
}

function populateSelects() {
    counties.forEach(function(county) {
        countySelect.appendChild(new Option(county.name, county.code));
    });

    eventTypes.forEach(function(type) {
        eventTypeSelect.appendChild(new Option(type.label, type.key));
        typeFilter.appendChild(new Option(type.label, type.key));
    });
}

function renderDynamicFields() {
    var type = eventTypeSelect.value;
    dynamicFields.innerHTML = "";

    if (type === "hail") {
        dynamicFields.appendChild(makeSelectField("hailSize", "Hail Size", [
            "", "Pea", "Dime", "Penny", "Nickel", "Quarter (1.00 in)", "Half Dollar", "Ping Pong", "Golf Ball", "Tennis Ball", "Baseball", "Softball"
        ]));
    } else if (type === "wind") {
        dynamicFields.appendChild(makeSelectField("windSpeed", "Estimated Wind Speed", ["", "40-50 mph", "50-60 mph", "60-70 mph", "70+ mph"]));
        dynamicFields.appendChild(makeSelectField("damage", "Wind Damage", ["", "Small limbs down", "Large limbs down", "Trees down", "Structural damage", "Power poles/lines down"]));
    } else if (type === "flood") {
        dynamicFields.appendChild(makeSelectField("floodType", "Flooding Observed", ["", "Road covered", "Road closed", "Water entering structure", "Creek/river out of banks", "Swift water"]));
    } else if (type === "power") {
        dynamicFields.appendChild(makeInputField("provider", "Electric Provider", "Provider or outage area"));
    } else if (type === "snow") {
        dynamicFields.appendChild(makeInputField("snowTotal", "Snow / Ice Total", "Average measurement in inches"));
    }
}

function makeInputField(name, label, placeholder) {
    var wrapper = document.createElement("label");
    wrapper.innerHTML = '<span>' + escapeHtml(label) + '</span><input name="' + name + '" placeholder="' + escapeHtml(placeholder) + '">';
    return wrapper;
}

function makeSelectField(name, label, choices) {
    var wrapper = document.createElement("label");
    var select = document.createElement("select");
    select.name = name;
    choices.forEach(function(choice) {
        select.appendChild(new Option(choice || "Select", choice));
    });
    wrapper.innerHTML = '<span>' + escapeHtml(label) + '</span>';
    wrapper.appendChild(select);
    return wrapper;
}

function handleSubmit(event) {
    event.preventDefault();
    var formData = new FormData(reportForm);
    var lat = Number(formData.get("latitude"));
    var lon = Number(formData.get("longitude"));

    if (!isValidCoordinate(lat, lon)) {
        setStatus("Enter valid latitude and longitude.", true);
        return;
    }

    var report = {
        id: "r-" + Date.now(),
        createdAt: new Date().toISOString(),
        status: "new",
        callsign: clean(formData.get("callsign")),
        contact: clean(formData.get("contact")),
        county: clean(formData.get("county")),
        eventType: clean(formData.get("eventType")),
        latitude: lat,
        longitude: lon,
        locationNotes: clean(formData.get("locationNotes")),
        remarks: clean(formData.get("remarks")),
        details: collectDetails(formData)
    };

    reports.unshift(report);
    saveReports();
    reportForm.reset();
    renderDynamicFields();
    renderReports();
    setStatus("Report submitted and queued for review.", false);
}

function collectDetails(formData) {
    var detailNames = ["hailSize", "windSpeed", "damage", "floodType", "provider", "snowTotal"];
    var details = {};
    detailNames.forEach(function(name) {
        var value = clean(formData.get(name));
        if (value) details[name] = value;
    });
    return details;
}

function captureGps() {
    if (!navigator.geolocation) {
        setStatus("GPS is not available in this browser.", true);
        return;
    }

    setStatus("Capturing GPS location...");
    navigator.geolocation.getCurrentPosition(function(position) {
        document.getElementById("latitude").value = position.coords.latitude.toFixed(6);
        document.getElementById("longitude").value = position.coords.longitude.toFixed(6);
        setStatus("GPS location captured.");
    }, function() {
        setStatus("GPS permission was denied or unavailable.", true);
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
    });
}

function renderReports() {
    reportLayer.clearLayers();
    reportList.innerHTML = "";
    markers = {};

    var filtered = getFilteredReports();
    reportCount.textContent = filtered.length + (filtered.length === 1 ? " report" : " reports");

    if (filtered.length === 0) {
        reportList.innerHTML = '<div class="emptyState">No reports match the current filters.</div>';
        return;
    }

    filtered.forEach(function(report) {
        addReportMarker(report);
        reportList.appendChild(buildReportCard(report));
    });

    fitMap(filtered);
}

function getFilteredReports() {
    return reports.filter(function(report) {
        return (statusFilter.value === "all" || report.status === statusFilter.value) &&
            (typeFilter.value === "all" || report.eventType === typeFilter.value);
    });
}

function addReportMarker(report) {
    var type = getEventType(report.eventType);
    var marker = L.circleMarker([report.latitude, report.longitude], {
        radius: 9,
        color: type.color,
        fillColor: type.color,
        fillOpacity: 0.9,
        weight: 2
    }).bindPopup(buildPopup(report)).addTo(reportLayer);
    markers[report.id] = marker;
}

function buildReportCard(report) {
    var type = getEventType(report.eventType);
    var template = document.getElementById("reportCardTemplate");
    var card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".eventDot").style.background = type.color;
    card.querySelector(".cardTitle").textContent = type.label + " | " + getCountyLabel(report.county);
    card.querySelector(".cardMeta").textContent = formatDate(report.createdAt) + " | " + report.callsign + " | " + report.status;
    card.querySelector(".reportDetails").innerHTML = buildDetails(report);
    card.querySelector(".reportSummary").addEventListener("click", function() {
        map.setView([report.latitude, report.longitude], Math.max(map.getZoom(), 12));
        markers[report.id].openPopup();
    });
    card.querySelectorAll("[data-status]").forEach(function(button) {
        button.addEventListener("click", function() {
            updateStatus(report.id, button.dataset.status);
        });
    });
    return card;
}

function buildDetails(report) {
    var detailText = Object.keys(report.details).map(function(key) {
        return labelForDetail(key) + ": " + report.details[key];
    }).join("<br>");

    return [
        detailText,
        report.locationNotes ? "Location: " + escapeHtml(report.locationNotes) : "",
        report.remarks ? "Remarks: " + escapeHtml(report.remarks) : ""
    ].filter(Boolean).join("<br>");
}

function buildPopup(report) {
    var type = getEventType(report.eventType);
    return [
        '<div class="popupTitle">' + escapeHtml(type.label) + '</div>',
        popupRow("Time", formatDate(report.createdAt)),
        popupRow("County", getCountyLabel(report.county)),
        popupRow("Callsign", report.callsign),
        popupRow("Status", report.status),
        popupRow("Details", stripTags(buildDetails(report)))
    ].join("");
}

function updateStatus(id, status) {
    reports = reports.map(function(report) {
        if (report.id === id) report.status = status;
        return report;
    });
    saveReports();
    renderReports();
    setStatus("Report marked " + status + ".");
}

function fitMap(items) {
    if (!items.length) return;
    if (items.length === 1) {
        map.setView([items[0].latitude, items[0].longitude], 10);
        return;
    }
    map.fitBounds(L.latLngBounds(items.map(function(report) {
        return [report.latitude, report.longitude];
    })), { padding: [36, 36], maxZoom: 12 });
}

function exportCsv() {
    var header = ["createdAt", "status", "callsign", "contact", "county", "eventType", "latitude", "longitude", "locationNotes", "remarks", "details"];
    var lines = [header.join(",")].concat(reports.map(function(report) {
        return header.map(function(key) {
            var value = key === "details" ? JSON.stringify(report.details) : report[key];
            return csvCell(value);
        }).join(",");
    }));
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "ocarc-storm-reports.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function loadReports() {
    try {
        var stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return Array.isArray(stored) ? stored : [];
    } catch (error) {
        return [];
    }
}

function saveReports() {
    localStorage.setItem(storageKey, JSON.stringify(reports));
}

function getEventType(key) {
    return eventTypes.find(function(type) { return type.key === key; }) || eventTypes[0];
}

function getCountyLabel(code) {
    var county = counties.find(function(item) { return item.code === code; });
    return county ? county.name : code;
}

function labelForDetail(key) {
    var labels = {
        hailSize: "Hail size",
        windSpeed: "Wind speed",
        damage: "Damage",
        floodType: "Flooding",
        provider: "Provider",
        snowTotal: "Snow/Ice total"
    };
    return labels[key] || key;
}

function isValidCoordinate(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function setStatus(message, isError) {
    systemStatus.textContent = message;
    systemStatus.style.color = isError ? "#fecaca" : "#dbeafe";
}

function clean(value) {
    return String(value || "").trim();
}

function csvCell(value) {
    return '"' + String(value || "").replace(/"/g, '""') + '"';
}

function popupRow(label, value) {
    if (!value) return "";
    return '<div class="popupRow"><span class="popupLabel">' + escapeHtml(label) + ':</span> ' + escapeHtml(value) + '</div>';
}

function formatDate(value) {
    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function stripTags(value) {
    return String(value || "").replace(/<br>/g, " | ").replace(/<[^>]*>/g, "");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
