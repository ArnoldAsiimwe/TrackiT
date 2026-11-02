# Geographical Information Systems (GIS) — Real-Time Spatial Tracking Platform
**Assignment Submission & Technical Report**  
*Date of Submission:* 17 November 2026  
*Team Format:* Group 5 (Boardroom Defense Presentation)  

---

## 1. Executive Summary & Architecture Overview
This project presents **GIS Location Tracker**, a 2-page web-based Geographical Information Systems application developed for tracking the spatial movement of people and devices in real time. The platform integrates direct device hardware geolocation sensors (GPS), realistic trajectory simulation, remote device IP lookup, and geospatial analytical algorithms (Haversine geodesic distances, circular accuracy buffers, and perimeter geofencing).

### 2-Page Web Architecture:
- **Page 1: Live Interactive Tracker & Spatial Map**:
  - Live spatial canvas powered by Leaflet using reliable, free Esri GIS World Street tiles.
  - Real-time GPS stream with simulation fallback options (Campus Walk, Urban Transit, Trail).
  - Breadcrumb trail vector logging, 95% CEP circular accuracy buffers, 350-meter safety geofence alert ring, and dwell-time point density indicators.
  - **Remote Device IP Tracker:** Allows entering any phone or laptop IP address to resolve its geographical location on the map, determine its network/ISP, and identify whether it is a mobile smartphone or laptop computer.
  - Telemetry export utilities: standard GeoJSON FeatureCollection and raw CSV telemetry.
- **Page 2: GIS Spatial Analytics & Boardroom Report**:
  - Longitudinal velocity profile (km/h) and accuracy dilution charts powered by Chart.js.
  - Cumulative geodesic path length, peak velocity, tracking session duration, and geofence compliance metrics.
  - Theoretical defense addressing all assignment prompt requirements (IP geolocation mechanics, GPS vs. Cell Tower Triangulation, creative multi-modal applications, and privacy safeguards).

---

## 2. Topic 1: Laptop & Phone Location Tracking Based on IP Address
### 2.1 Mechanics of IP Geolocation Determination
Tracking a laptop or mobile phone's location through its Internet Protocol (IP) address relies on multi-source routing intelligence:
1. **Regional Internet Registry (RIR) Allocations & Autonomous Systems (ASN):** Regional bodies (such as AFRINIC, RIPE, ARIN) allocate IP address blocks to Internet Service Providers (ISPs), universities, and telecoms with registered administrative physical addresses.
2. **Commercial GeoIP Databases:** Systems cross-reference BGP routing tables, reverse DNS PTR hostnames (e.g., node identifiers like `nbo-core1.safaricom.net`), and network exchange point registrations.
3. **Network Delay Multilateration:** Measuring ping response times (Round-Trip Time) to known reference servers establishes an approximate physical distance boundary based on light speed through fiber optics.

### 2.2 Accuracy and Practical Limitations
- **Granularity:** IP geolocation is effective strictly at the country, state/province, or municipal city level. Accuracy typically ranges between **5 km to 50 km**. It cannot pinpoint a street address, house, or room.
- **VPNs & Proxies:** When a user runs a VPN tunnel, the public IP reflects the VPN exit server location (often in another city or country).
- **Carrier-Grade NAT (CGNAT) & Dynamic Pools:** ISPs and mobile cellular carriers frequently assign shared public IPs from centralized gateways, meaning thousands of phones and laptops in different neighborhoods appear to originate from the exact same gateway IP.

---

## 3. Topic 2: Mobile Phone Tracking — GPS vs. Cell Tower Triangulation
When tracking mobile phones, spatial precision must be evaluated against power consumption and signal penetration.

| Feature | Global Positioning System (GPS / GNSS) | Cell Tower Triangulation |
| :--- | :--- | :--- |
| **Operational Method** | Passive time-of-flight trilateration using microwave radio signals broadcast by 4 or more atomic-clock GNSS satellites orbiting at 20,200 km. | Cellular base station measurements (eNodeB/gNodeB) utilizing Signal Strength (RSSI), Timing Advance (TA), and Angle of Arrival (AoA) across 3 or more towers. |
| **Spatial Precision** | **2 to 5 meters** outdoors. | **100m to 500m** in dense urban areas; **2km to 10km** in rural cell sectors. |
| **Battery Impact** | **High**: Active RF satellite search and ephemeris computation rapidly drain phone battery. | **Minimal**: Uses passive cellular radio modems already connected to towers for normal standby. |
| **Indoor Performance** | **Poor**: Heavy satellite signal attenuation and multipath reflections caused by concrete roofs and walls. | **High**: Cellular radio waves penetrate roofs, basements, and structures reliably. |
| **Time to First Fix (TTFF)** | Cold start 30–60 seconds without network assistance (A-GPS). | Near-instantaneous (< 1 second) via carrier network registers. |

---

## 4. Topic 3: Creative GIS Applications & Enabling Technologies
1. **Precision Disaster Relief & Search and Rescue (SAR):** Deploying low-power **LoRaWAN mesh networks** combined with drone relays to pinpoint lost hikers or survivors where cellular infrastructure is down.
2. **Cold-Chain Vaccine Logistics:** Integrating **Bluetooth Low Energy (BLE 5.1)** beacons with temperature sensors to monitor both physical location and cold storage temperatures during medical transport.
3. **Wildlife Anti-Poaching Geofences:** Solar GPS collars on elephants and rhinos using spatial buffering to trigger SMS warnings whenever animals approach park boundaries or human settlements.
4. **Indoor Navigation & Crowd Density:** Deploying **Ultra-Wideband (UWB)** chips in smart badges to manage foot traffic and safety bottlenecks in hospitals, airports, and sports arenas.

---

## 5. Topic 4: Privacy Concerns, Ethics & Legal Safeguards
Spatial data is sensitive Personally Identifiable Information (PII) subject to data protection laws:
- **Explicit Prior Consent:** Clear opt-in permission prompts with visual indicators (such as status pills and pulsing icons) whenever tracking is active.
- **Data Minimization & Ephemeral Retention:** Storing coordinates only for active session analysis and purging location logs when no longer needed.
- **Spatial Obfuscation:** Blurring coordinates for non-critical analytics to protect user privacy.
- **Data Transmission Security:** Encrypting location coordinates in transit using HTTPS / TLS 1.3.

---

## 6. How to Run the Application
1. Open the project folder `tracking app`.
2. Double-click `index.html` in any browser (Chrome, Edge, Firefox).
3. **Live GPS:** Click **"Start Tracking"** to track your current hardware position.
4. **Simulated Route:** Switch to **"Simulation Route"** to demo continuous movement, speed metrics, breadcrumbs, and geofence boundary alerts.
5. **Track a Friend's Device:** In the **Remote Device IP Tracker** card, enter an IP address or click one of the sample buttons (**"Friend's iPhone"**, **"Friend's Laptop"**, **"Android Phone"**) to see its location, ISP, coordinates, and device type detected on the map.
6. **Page 2:** Click **"Analysis & Report"** to inspect charts and the technical presentation.
