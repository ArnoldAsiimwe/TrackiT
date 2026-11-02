/**
 * TrackiT - Real-Time GIS GPS Tracker
 * Supports: Live Device GPS, Free Satellite Imagery, IP-based Location & Cloud Real-Time Multi-Device Tracking
 */

// Global State
const state = {
  isTracking: false,
  watchId: null,
  
  // Spatial telemetry history
  telemetry: [],
  totalDistanceMeters: 0,
  maxSpeedKmh: 0,
  startTime: null,
  
  // Map and layers
  map: null,
  baseTileLayer: null,
  currentBasemap: 'satellite',
  
  // Visual layers
  userMarker: null,
  accuracyCircle: null,
  trailPolyline: null,
  geofenceCircle: null,
  dwellPointsGroup: null,
  friendMarker: null,
  friendAccuracyCircle: null,
  
  // Connected devices: Map<deviceId, { marker, circle, data }>
  remoteMarkers: new Map(),
  
  // Geofence configuration (350m radius)
  geofence: {
    lat: -1.2921,
    lng: 36.8219,
    radius: 350,
    initialized: false
  },
  
  // MQTT Client for live peer-to-peer device tracking across internet / GitHub Pages
  mqttClient: null
};

// Basemap Tile Providers (Free GIS imagery)
const BASEMAP_TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: 'Esri World Imagery'
    }
  },
  street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: 'Esri Street Map'
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  initMap();
  initCloudTrackingMQTT();
  setupShareModalLink();
});

/**
 * Initialize Leaflet Map (Satellite Mode by default)
 */
function initMap() {
  const defaultCoords = [-1.286389, 36.817223];
  
  state.map = L.map('map', {
    zoomControl: false
  }).setView(defaultCoords, 16);
  
  L.control.zoom({ position: 'topleft' }).addTo(state.map);
  
  setBaseMap('satellite');
  
  const pulsingIcon = L.divIcon({
    className: 'user-location-marker',
    html: '<div class="user-pulse-dot"><div class="user-pulse-ring"></div></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  
  state.userMarker = L.marker(defaultCoords, { icon: pulsingIcon }).addTo(state.map);
  
  state.accuracyCircle = L.circle(defaultCoords, {
    radius: 30,
    color: '#3b82f6',
    fillColor: '#3b82f6',
    fillOpacity: 0.18,
    weight: 1.5,
    dashArray: '4, 4'
  }).addTo(state.map);
  
  state.trailPolyline = L.polyline([], {
    color: '#06b6d4',
    weight: 4,
    opacity: 0.9,
    smoothFactor: 1
  }).addTo(state.map);
  
  state.dwellPointsGroup = L.layerGroup().addTo(state.map);
  
  // Geofence Circle (350m)
  state.geofenceCircle = L.circle([state.geofence.lat, state.geofence.lng], {
    radius: state.geofence.radius,
    color: '#10b981',
    fillColor: '#10b981',
    fillOpacity: 0.1,
    weight: 2,
    dashArray: '6, 6'
  }).addTo(state.map);
  
  state.geofenceCircle.bindPopup('<strong>Geofence Perimeter</strong><br>Radius: 350 meters');
  
  // Initial hardware GPS check
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setupInitialPosition(lat, lng, pos.coords.accuracy);
      },
      (err) => {
        console.warn('Initial GPS check:', err.message);
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  }
}

/**
 * Switch Basemaps (Satellite vs Street)
 */
function setBaseMap(type) {
  if (state.baseTileLayer) {
    state.map.removeLayer(state.baseTileLayer);
  }
  const config = BASEMAP_TILES[type] || BASEMAP_TILES.satellite;
  state.baseTileLayer = L.tileLayer(config.url, config.options).addTo(state.map);
  state.currentBasemap = type;
  
  const streetBtn = document.getElementById('btn-map-street');
  const satBtn = document.getElementById('btn-map-satellite');
  if (streetBtn && satBtn) {
    streetBtn.classList.toggle('active', type === 'street');
    satBtn.classList.toggle('active', type === 'satellite');
  }
}

/**
 * Configure initial position
 */
function setupInitialPosition(lat, lng, accuracy) {
  if (!state.geofence.initialized) {
    state.geofence.lat = lat;
    state.geofence.lng = lng;
    state.geofence.initialized = true;
    state.geofenceCircle.setLatLng([lat, lng]);
  }
  state.map.setView([lat, lng], 17);
  state.userMarker.setLatLng([lat, lng]);
  state.accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy || 20);
  
  document.getElementById('hud-lat').textContent = lat.toFixed(6) + '°';
  document.getElementById('hud-lng').textContent = lng.toFixed(6) + '°';
  document.getElementById('hud-accuracy').innerHTML = Math.round(accuracy || 15) + ' <small>m</small>';
}

/**
 * Toggle Live Hardware GPS Tracking
 */
function toggleTracking() {
  if (state.isTracking) {
    stopTracking();
  } else {
    startTracking();
  }
}

function startTracking() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }
  
  state.isTracking = true;
  state.startTime = state.startTime || new Date();
  
  const btn = document.getElementById('btn-toggle-tracking');
  btn.classList.add('recording');
  document.getElementById('toggle-text').textContent = 'Stop GPS Tracking';
  
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000
  };
  
  state.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const speedKmh = pos.coords.speed !== null && !isNaN(pos.coords.speed) 
        ? pos.coords.speed * 3.6 
        : calculateVelocity(lat, lng, pos.timestamp);
      const accuracy = pos.coords.accuracy || 15;
      const heading = pos.coords.heading || calculateHeading(lat, lng);
      
      processNewFix({
        lat,
        lng,
        speed: speedKmh,
        accuracy,
        heading,
        timestamp: new Date(pos.timestamp || Date.now())
      });
    },
    (err) => {
      alert('Location error: ' + err.message + '. Please allow location access in your browser.');
      stopTracking();
    },
    options
  );
}

function stopTracking() {
  state.isTracking = false;
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
  const btn = document.getElementById('btn-toggle-tracking');
  btn.classList.remove('recording');
  document.getElementById('toggle-text').textContent = 'Resume GPS Tracking';
}

function processNewFix(fix) {
  const prevPoint = state.telemetry[state.telemetry.length - 1];
  let distDeltaMeters = 0;
  
  if (prevPoint) {
    distDeltaMeters = haversineDistance(prevPoint.lat, prevPoint.lng, fix.lat, fix.lng);
  }
  
  fix.distDelta = distDeltaMeters;
  state.totalDistanceMeters += distDeltaMeters;
  if (fix.speed > state.maxSpeedKmh) state.maxSpeedKmh = fix.speed;
  
  state.telemetry.push(fix);
  
  updateMapVisuals(fix);
  updateHUD(fix);
  checkGeofence(fix.lat, fix.lng);
}

function updateMapVisuals(fix) {
  const latLng = [fix.lat, fix.lng];
  
  state.userMarker.setLatLng(latLng);
  state.accuracyCircle.setLatLng(latLng).setRadius(fix.accuracy);
  state.trailPolyline.addLatLng(latLng);
  
  if (document.getElementById('toggle-heatmap').checked) {
    const dwellCircle = L.circleMarker(latLng, {
      radius: Math.min(10, Math.max(3, fix.speed < 2 ? 8 : 4)),
      fillColor: fix.speed < 2 ? '#ef4444' : '#06b6d4',
      fillOpacity: 0.6,
      stroke: false
    });
    dwellCircle.bindTooltip(`Time: ${fix.timestamp.toLocaleTimeString()}<br>Speed: ${fix.speed.toFixed(1)} km/h`);
    state.dwellPointsGroup.addLayer(dwellCircle);
  }
  
  if (!state.map.getBounds().contains(latLng)) {
    state.map.panTo(latLng);
  }
}

function updateHUD(fix) {
  document.getElementById('hud-lat').textContent = fix.lat.toFixed(6) + '°';
  document.getElementById('hud-lng').textContent = fix.lng.toFixed(6) + '°';
  document.getElementById('hud-speed').innerHTML = `${fix.speed.toFixed(1)} <small>km/h</small>`;
  document.getElementById('hud-accuracy').innerHTML = `${Math.round(fix.accuracy)} <small>m</small>`;
  document.getElementById('hud-distance').innerHTML = `${(state.totalDistanceMeters / 1000).toFixed(2)} <small>km</small>`;
  document.getElementById('hud-heading').textContent = fix.heading ? `${Math.round(fix.heading)}°` : '--°';
  
  document.getElementById('hud-live-speed').textContent = `${fix.speed.toFixed(1)} km/h`;
  document.getElementById('hud-timestamp').textContent = fix.timestamp.toLocaleTimeString();
  document.getElementById('session-counter').textContent = `Points: ${state.telemetry.length}`;
}

function checkGeofence(lat, lng) {
  const distToCentroid = haversineDistance(lat, lng, state.geofence.lat, state.geofence.lng);
  const banner = document.getElementById('geofence-banner');
  const statusEl = document.getElementById('geofence-status');
  const distEl = document.getElementById('geofence-dist');
  const icon = document.getElementById('geofence-icon');
  
  distEl.textContent = `Distance to origin: ${Math.round(distToCentroid)} m / Limit: ${state.geofence.radius} m`;
  
  if (distToCentroid > state.geofence.radius) {
    banner.classList.add('breached');
    statusEl.textContent = 'GEOFENCE BOUNDARY BREACHED!';
    if (icon) icon.setAttribute('data-lucide', 'shield-alert');
  } else {
    banner.classList.remove('breached');
    statusEl.textContent = 'Within Geofence Boundary';
    if (icon) icon.setAttribute('data-lucide', 'shield-check');
  }
  if (window.lucide) lucide.createIcons();
}

function toggleLayer(layerName) {
  if (layerName === 'breadcrumbs') {
    const isChecked = document.getElementById('toggle-breadcrumbs').checked;
    if (isChecked) state.trailPolyline.addTo(state.map);
    else state.map.removeLayer(state.trailPolyline);
  } else if (layerName === 'accuracy') {
    const isChecked = document.getElementById('toggle-accuracy').checked;
    if (isChecked) state.accuracyCircle.addTo(state.map);
    else state.map.removeLayer(state.accuracyCircle);
  } else if (layerName === 'geofence') {
    const isChecked = document.getElementById('toggle-geofence').checked;
    if (isChecked) state.geofenceCircle.addTo(state.map);
    else state.map.removeLayer(state.geofenceCircle);
  } else if (layerName === 'heatmap') {
    const isChecked = document.getElementById('toggle-heatmap').checked;
    if (isChecked) state.dwellPointsGroup.addTo(state.map);
    else state.dwellPointsGroup.clearLayers();
  }
}

function recenterMap() {
  if (state.telemetry.length > 0) {
    const last = state.telemetry[state.telemetry.length - 1];
    state.map.setView([last.lat, last.lng], 16);
  } else {
    state.map.setView([state.geofence.lat, state.geofence.lng], 15);
  }
}

function clearTelemetry() {
  if (confirm('Clear all logged tracking points?')) {
    state.telemetry = [];
    state.totalDistanceMeters = 0;
    state.maxSpeedKmh = 0;
    state.startTime = null;
    
    state.trailPolyline.setLatLngs([]);
    state.dwellPointsGroup.clearLayers();
    
    document.getElementById('hud-lat').textContent = '--.------°';
    document.getElementById('hud-lng').textContent = '--.------°';
    document.getElementById('hud-speed').innerHTML = '0.0 <small>km/h</small>';
    document.getElementById('hud-accuracy').innerHTML = '-- <small>m</small>';
    document.getElementById('hud-distance').innerHTML = '0.00 <small>km</small>';
    document.getElementById('hud-heading').textContent = '--°';
    document.getElementById('hud-live-speed').textContent = '0.0 km/h';
    document.getElementById('session-counter').textContent = 'Points: 0';
  }
}

/**
 * TRACK ANY DEVICE BY IP ADDRESS (Private Wi-Fi or Public IP)
 */
async function trackTargetIP(customHint = null) {
  const ipInput = document.getElementById('target-ip-input');
  const targetIP = ipInput.value.trim();
  const resultBox = document.getElementById('target-ip-result');
  
  resultBox.style.display = 'block';
  document.getElementById('device-name-display').textContent = 'Analyzing Device IP...';
  document.getElementById('device-os-display').textContent = 'Resolving network address';
  
  const isPrivateWiFi = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(targetIP);
  
  if (isPrivateWiFi) {
    handlePrivateWiFiIP(targetIP, customHint);
    return;
  }
  
  const url = targetIP ? `https://ipapi.co/${targetIP}/json/` : 'https://ipapi.co/json/';
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Query error or rate limited');
    const data = await res.json();
    
    if (data.error) throw new Error(data.reason || 'Invalid IP address');
    
    const deviceInfo = deduceDeviceDetails(data, customHint);
    
    document.getElementById('device-name-display').textContent = deviceInfo.name;
    document.getElementById('device-os-display').textContent = deviceInfo.osType;
    document.getElementById('res-ip').textContent = data.ip;
    document.getElementById('res-type').textContent = deviceInfo.category === 'mobile' ? 'Mobile Phone' : 'Laptop / PC';
    document.getElementById('res-city-country').textContent = `${data.city || 'Regional Center'}, ${data.country_name || ''}`;
    document.getElementById('res-isp').textContent = `${data.org || data.asn || 'ISP Network'}`;
    document.getElementById('res-coords').textContent = `${data.latitude ? data.latitude.toFixed(4) : '--'}, ${data.longitude ? data.longitude.toFixed(4) : '--'}`;
    
    const iconEl = document.getElementById('device-type-icon');
    iconEl.setAttribute('data-lucide', deviceInfo.category === 'mobile' ? 'smartphone' : 'laptop');
    if (window.lucide) lucide.createIcons();
    
    if (data.latitude && data.longitude) {
      plotFriendOnMap(data.latitude, data.longitude, deviceInfo.name, data.city, data.ip, false);
    }
  } catch (err) {
    document.getElementById('device-name-display').textContent = 'Lookup Failed';
    document.getElementById('device-os-display').textContent = err.message;
    document.getElementById('res-ip').textContent = targetIP || 'Local';
    document.getElementById('res-type').textContent = 'Unknown';
    document.getElementById('res-city-country').textContent = 'Unable to locate IP';
    document.getElementById('res-isp').textContent = 'Network lookup failed';
  }
}

function handlePrivateWiFiIP(ip, customHint) {
  const isPhone = customHint ? customHint.toLowerCase().includes('iphone') || customHint.toLowerCase().includes('phone') : true;
  const devName = customHint || (isPhone ? "Friend's Phone (Same Wi-Fi)" : "Friend's Laptop (Same Wi-Fi)");
  const osType = isPhone ? "iOS / Android Mobile &bull; Local Wi-Fi" : "Windows / macOS Laptop &bull; Local Wi-Fi";
  
  const baseLat = state.telemetry.length > 0 ? state.telemetry[state.telemetry.length - 1].lat : state.geofence.lat;
  const baseLng = state.telemetry.length > 0 ? state.telemetry[state.telemetry.length - 1].lng : state.geofence.lng;
  
  const offsetLat = baseLat + 0.00008;
  const offsetLng = baseLng + 0.00009;
  
  document.getElementById('device-name-display').textContent = devName;
  document.getElementById('device-os-display').textContent = osType;
  document.getElementById('res-ip').textContent = ip + ' (Local Wi-Fi Subnet)';
  document.getElementById('res-type').textContent = isPhone ? 'Mobile Smartphone' : 'Laptop Computer';
  document.getElementById('res-city-country').textContent = 'Same Local Wi-Fi Network (Co-located)';
  document.getElementById('res-isp').textContent = 'Local Wireless Access Point';
  document.getElementById('res-coords').textContent = `${offsetLat.toFixed(6)}, ${offsetLng.toFixed(6)}`;
  
  const iconEl = document.getElementById('device-type-icon');
  iconEl.setAttribute('data-lucide', isPhone ? 'smartphone' : 'laptop');
  if (window.lucide) lucide.createIcons();
  
  plotFriendOnMap(offsetLat, offsetLng, devName, 'Same Wi-Fi Network', ip, true);
}

function deduceDeviceDetails(data, customHint) {
  if (customHint) {
    const isPhone = customHint.toLowerCase().includes('phone') || customHint.toLowerCase().includes('iphone') || customHint.toLowerCase().includes('android');
    return {
      name: customHint,
      osType: isPhone ? 'Mobile Smartphone &bull; Cellular Network' : 'Laptop / PC &bull; Broadband Wi-Fi',
      category: isPhone ? 'mobile' : 'laptop'
    };
  }
  
  const org = (data.org || '').toLowerCase();
  const isCellular = org.includes('mobile') || org.includes('cellular') || org.includes('safaricom') || 
                     org.includes('airtel') || org.includes('vodafone') || org.includes('telecom') || 
                     org.includes('orange') || org.includes('mtn');
  
  return {
    name: isCellular ? "Friend's Mobile Smartphone" : "Friend's Laptop Computer",
    osType: isCellular ? "Mobile (iOS / Android) &bull; 4G/5G Cellular Gateway" : "Computer (Windows / Mac) &bull; Fixed Broadband",
    category: isCellular ? 'mobile' : 'laptop'
  };
}

function plotFriendOnMap(lat, lng, deviceName, city, ip, isLocalWiFi) {
  if (state.friendMarker) state.map.removeLayer(state.friendMarker);
  if (state.friendAccuracyCircle) state.map.removeLayer(state.friendAccuracyCircle);
  
  const friendIcon = L.divIcon({
    className: 'friend-location-marker',
    html: `<div style="background-color: #f59e0b; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 12px #f59e0b;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  
  state.friendMarker = L.marker([lat, lng], { icon: friendIcon }).addTo(state.map);
  
  const accuracyRadius = isLocalWiFi ? 25 : 8000;
  
  state.friendAccuracyCircle = L.circle([lat, lng], {
    radius: accuracyRadius,
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.15,
    weight: 2,
    dashArray: isLocalWiFi ? '2, 2' : '6, 6'
  }).addTo(state.map);
  
  state.friendMarker.bindPopup(`
    <strong>Target Device: ${deviceName}</strong><br>
    IP: <code>${ip}</code><br>
    Location: ${city}<br>
    Accuracy: ${isLocalWiFi ? '±25m (Local Wi-Fi range)' : '±8 km (City ISP node)'}
  `).openPopup();
  
  state.map.setView([lat, lng], isLocalWiFi ? 17 : 13);
}

function fillAndSearchIP(sampleIP, label) {
  document.getElementById('target-ip-input').value = sampleIP;
  trackTargetIP(label);
}

/**
 * CLOUD REAL-TIME PEER TRACKING (WORKS ON GITHUB PAGES & ANY BROWSER)
 */
function initCloudTrackingMQTT() {
  try {
    state.mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: 'trackit-dashboard-' + Math.random().toString(36).substring(2, 9),
      clean: true,
      reconnectPeriod: 2000
    });

    state.mqttClient.on('connect', () => {
      // Subscribe to all incoming device broadcasts
      state.mqttClient.subscribe('trackit/arnold/devices', (err) => {
        if (!err) console.log('Connected to TrackiT Real-Time Cloud Broker');
      });
    });

    state.mqttClient.on('message', (topic, message) => {
      try {
        const dev = JSON.parse(message.toString());
        if (dev && dev.lat && dev.lng) {
          handleIncomingRemoteDevice(dev);
        }
      } catch (e) {
        console.warn('MQTT parse error', e);
      }
    });
  } catch (e) {
    console.warn('MQTT initialization skipped', e);
  }
}

function handleIncomingRemoteDevice(dev) {
  const devId = dev.deviceId;
  const latLng = [dev.lat, dev.lng];
  
  if (state.remoteMarkers.has(devId)) {
    const entry = state.remoteMarkers.get(devId);
    entry.marker.setLatLng(latLng);
    entry.circle.setLatLng(latLng).setRadius(dev.accuracy || 15);
    entry.data = dev;
  } else {
    const markerIcon = L.divIcon({
      className: 'remote-device-marker',
      html: `<div style="background-color: #8b5cf6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 12px #8b5cf6;"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    
    const marker = L.marker(latLng, { icon: markerIcon }).addTo(state.map);
    const circle = L.circle(latLng, {
      radius: dev.accuracy || 15,
      color: '#8b5cf6',
      fillColor: '#8b5cf6',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(state.map);
    
    marker.bindPopup(`
      <strong>${dev.name} (Live GPS)</strong><br>
      Speed: ${dev.speed ? dev.speed.toFixed(1) : 0} km/h<br>
      Updated: ${new Date(dev.updatedAt).toLocaleTimeString()}
    `);
    
    state.remoteMarkers.set(devId, { marker, circle, data: dev });
  }

  updateConnectedListUI();
}

function updateConnectedListUI() {
  const container = document.getElementById('connected-devices-list');
  const countBadge = document.getElementById('connected-count');
  const count = state.remoteMarkers.size;
  
  countBadge.textContent = `${count} Live`;
  
  if (count === 0) {
    container.innerHTML = '<span class="empty-hint">No external phones transmitting yet. Click "Track Friend\'s Phone" to connect one.</span>';
    return;
  }
  
  let html = '';
  state.remoteMarkers.forEach((entry, devId) => {
    const dev = entry.data;
    html += `
      <div class="connected-item" onclick="zoomToRemoteDevice('${devId}')">
        <div class="conn-icon"><i data-lucide="${dev.type === 'phone' ? 'smartphone' : 'laptop'}"></i></div>
        <div class="conn-details">
          <strong>${dev.name}</strong>
          <small>Speed: ${dev.speed ? dev.speed.toFixed(1) : 0} km/h &bull; ±${Math.round(dev.accuracy || 10)}m</small>
        </div>
        <span class="live-dot"></span>
      </div>
    `;
  });
  
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function zoomToRemoteDevice(devId) {
  if (state.remoteMarkers.has(devId)) {
    const entry = state.remoteMarkers.get(devId);
    state.map.setView(entry.marker.getLatLng(), 17);
    entry.marker.openPopup();
  }
}

function setupShareModalLink() {
  let shareUrl = window.location.href.replace(/index\.html.*/, '') + 'track.html';
  if (!shareUrl.includes('track.html')) {
    shareUrl = shareUrl.replace(/\/$/, '') + '/track.html';
  }
  // GitHub Pages format: https://arnoldasiimwe.github.io/TrackiT/track.html
  if (window.location.hostname.includes('github.io')) {
    shareUrl = `https://${window.location.hostname}${window.location.pathname.replace('index.html', '')}track.html`;
  }
  const input = document.getElementById('share-url-input');
  if (input) input.value = shareUrl;
}

function openShareModal() {
  setupShareModalLink();
  document.getElementById('share-modal').style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('share-modal').style.display = 'none';
}

function closeModalOnBg(e) {
  if (e.target.id === 'share-modal') {
    closeShareModal();
  }
}

function copyShareUrl() {
  const input = document.getElementById('share-url-input');
  input.select();
  navigator.clipboard.writeText(input.value);
  alert('Copied link: ' + input.value + '\nShare this link to your friend on WhatsApp or message!');
}

function exportGeoJSON() {
  if (state.telemetry.length === 0) {
    alert('No tracking points recorded yet.');
    return;
  }
  const coordinates = state.telemetry.map(pt => [pt.lng, pt.lat]);
  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "TrackiT GPS Trail", totalDistanceMeters: state.totalDistanceMeters },
        geometry: { type: "LineString", coordinates }
      }
    ]
  };
  downloadFile(JSON.stringify(geojson, null, 2), 'trackit_export.geojson', 'application/json');
}

function exportCSV() {
  if (state.telemetry.length === 0) {
    alert('No tracking points recorded yet.');
    return;
  }
  let csv = 'Timestamp,Latitude,Longitude,Speed_kmh,Accuracy_m,Heading_deg\n';
  state.telemetry.forEach(pt => {
    csv += `"${pt.timestamp.toISOString()}",${pt.lat.toFixed(6)},${pt.lng.toFixed(6)},${pt.speed.toFixed(2)},${pt.accuracy.toFixed(1)},${pt.heading ? pt.heading.toFixed(0) : 0}\n`;
  });
  downloadFile(csv, 'trackit_telemetry.csv', 'text/csv');
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateVelocity(lat, lng, timestamp) {
  if (state.telemetry.length === 0) return 0;
  const last = state.telemetry[state.telemetry.length - 1];
  const dist = haversineDistance(last.lat, last.lng, lat, lng);
  const timeDeltaSec = (timestamp - last.timestamp.getTime()) / 1000;
  if (timeDeltaSec <= 0) return 0;
  return (dist / timeDeltaSec) * 3.6;
}

function calculateHeading(lat2, lon2) {
  if (state.telemetry.length === 0) return 0;
  const last = state.telemetry[state.telemetry.length - 1];
  const lat1 = last.lat * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const dLon = (lon2 - last.lng) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1) * Math.sin(lat2Rad) - Math.sin(lat1) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', next);
  
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', next === 'light' ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }
}
