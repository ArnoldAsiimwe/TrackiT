const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// In-memory store for connected devices sending their GPS
// key: deviceId -> { id, name, type, lat, lng, accuracy, speed, heading, updatedAt, ip }
const trackedDevices = new Map();

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // Enable CORS so devices on the same Wi-Fi can send location freely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const cleanIP = clientIP.replace(/^.*:/, ''); // strip IPv6 prefix ::ffff:

  // API 1: Client device posts its GPS location
  if (req.method === 'POST' && req.url === '/api/update-location') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const deviceId = data.deviceId || cleanIP || 'device-' + Date.now();
        const record = {
          deviceId: deviceId,
          name: data.name || (data.isMobile ? "Friend's Phone" : "Friend's Laptop"),
          type: data.type || (data.isMobile ? 'phone' : 'laptop'),
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
          accuracy: parseFloat(data.accuracy) || 10,
          speed: parseFloat(data.speed) || 0,
          heading: parseFloat(data.heading) || 0,
          source: 'GPS',
          ip: cleanIP,
          updatedAt: new Date().toISOString()
        };
        trackedDevices.set(deviceId, record);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, device: record }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // API 2: Fetch all active tracked devices
  if (req.method === 'GET' && req.url === '/api/devices') {
    const list = Array.from(trackedDevices.values());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      devices: list,
      serverTime: new Date().toISOString(),
      serverIP: getLocalIP(),
      port: PORT
    }));
    return;
  }

  // API 3: Get server info & pairing link
  if (req.method === 'GET' && req.url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      localIP: getLocalIP(),
      port: PORT,
      trackingUrl: `http://${getLocalIP()}:${PORT}/track.html`
    }));
    return;
  }

  // Static File Serving
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  
  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`====================================================`);
  console.log(`GIS Real-Time Tracking Server Running!`);
  console.log(`> Main Dashboard:    http://localhost:${PORT}`);
  console.log(`> Phone Share Link:  http://${ip}:${PORT}/track.html`);
  console.log(`====================================================`);
});

