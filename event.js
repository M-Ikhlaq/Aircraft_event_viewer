// Initialize the Leaflet map
const map = L.map("map").setView([20.5937, 78.9629], 5);

// Add OpenStreetMap tile layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// API to fetch all events
const API_ALL_EVENTS_URL = "http://192.168.1.40:8000/event/api/events/";

// Parse events into GeoJSON
function parseAllEvents(events) {
  const features = [];

  events.forEach((event, idx) => {
    const latitude = event.latitude;
    const longitude = event.longitude;
    if (latitude !== undefined && longitude !== undefined) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        properties: {
          event_id: event.event_id,
          event_name: event.event_name,
          description: event.event_description,
          severity_level: event.severity_level,
          status: event.status,
          location_name: event.location_name,
          altitude_m: event.altitude_m,
          radius_km: event.radius_km,
          event_time: event.event_time,
        },
      });
    } else {
      console.warn(`Event at index ${idx} missing latitude/longitude:`, event);
    }
  });

  return {
    type: "FeatureCollection",
    features: features,
  };
}

// Fetch Events &  Dropdown
let mapMarkers = {}; // store markers by event_id

fetch(API_ALL_EVENTS_URL)
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  })
  .then((events) => {
    console.log("✅ Raw Events Data:", events);

    let eventArray = Array.isArray(events) ? events : events.results || [];
    if (!eventArray.length) {
      alert("No event data found from API.");
      return;
    }

    const geojson = parseAllEvents(eventArray);
    console.log("✅ Converted GeoJSON:", geojson);

    if (!geojson.features.length) {
      alert("No valid event locations found.");
      return;
    }

    // Add GeoJSON Layer to Map
    const eventLayer = L.geoJSON(geojson, {
      pointToLayer: function (feature, latlng) {
        const colorMap = {
          1: "#2ecc71", // Green
          2: "#f1c40f", // Yellow
          3: "#e74c3c", // Red
        };
        const sev = feature.properties.severity_level || "1";
        const marker = L.circleMarker(latlng, {
          radius: 7,
          fillColor: colorMap[sev] || "#3498db",
          color: "#2c3e50",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.85,
        });
        mapMarkers[feature.properties.event_id] = marker;
        return marker;
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        // Bind popup ONLY for marker clicks
        layer.bindPopup(`
          <div class="popup-content">
            <h3>${p.event_name}</h3>
            <p><strong>Description:</strong> ${p.description}</p>
            <p><strong>Severity:</strong> ${p.severity_level}</p>
            <p><strong>Status:</strong> ${p.status}</p>
            <p><strong>Altitude:</strong> ${p.altitude_m} m</p>
            <p><strong>Radius:</strong> ${p.radius_km} km</p>
            <p><strong>Location:</strong> ${p.location_name}</p>
            <p><strong>Time:</strong> ${new Date(
              p.event_time
            ).toLocaleString()}</p>
          </div>
        `);
      },
    }).addTo(map);

    // Fit map to event bounds
    map.fitBounds(eventLayer.getBounds(), { padding: [30, 30] });

    // Populate Dropdown Filter
    const dropdown = document.getElementById("eventDropdown");
    geojson.features.forEach((f) => {
      const option = document.createElement("option");
      option.value = f.properties.event_id;
      option.textContent = `${f.properties.event_name} (Severity: ${f.properties.severity_level})`;
      dropdown.appendChild(option);
    });

    // Handle Dropdown Selection - only zoom, no popup
    dropdown.addEventListener("change", (e) => {
      const eventId = e.target.value;
      if (eventId && mapMarkers[eventId]) {
        const marker = mapMarkers[eventId];
        map.setView(marker.getLatLng(), 10); // Zoom to event
        // Popup will not open automatically, user must click marker
      }
    });
  })
  .catch((err) => {
    console.error("❌ Failed to fetch or render events:", err);
    alert("❌ Could not load event data. Check console.");
  });
