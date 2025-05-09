# GeoWebClient 🌐 Interoperable GIS Web Client

A client-server-based interoperable Geographic Information System (GIS) for visualizing, querying, and analyzing geospatial data using **OGC-compliant** WMS and WFS services. This system allows seamless access to GeoServer-hosted spatial layers through an interactive web dashboard built with OpenLayers.



## 🔧 Tech Stack

### 🌍 Client (Frontend)
- **HTML**, **CSS**, **JavaScript**
- [OpenLayers v6](https://openlayers.org/)
- [jQuery](https://jquery.com/)
- [Bootstrap 5](https://getbootstrap.com/)
- OpenLayers Plugins:
  - **ol-geocoder** (search)
  - **ol-popup** (feature info)
  - **ol-layerswitcher** (layer control)

### 🖥️ Server (Backend)
- **Apache Tomcat** (Servlet container)
- **GeoServer** (OGC services: WMS/WFS)


## 🗺️ Features

### ✅ General Map Features
- Multiple base maps: Satellite (ArcGIS) and OpenStreetMap
- Zoom slider, extent control, and metric scale line
- Geocoder (Nominatim) search with popup
- Dynamic legend and layer switcher
- Responsive layout and intuitive UI

### 🌐 WMS (Web Map Service)
- Load layers from GeoServer via GetCapabilities
- Add layers by name or bounding box
- View metadata: Title, Abstract, CRS
- GetFeatureInfo on click (HTML response)

### 🧾 WFS (Web Feature Service)
- Load available WFS layers dynamically
- Display and describe feature types (attribute schema)
- Query by attribute with operators (>, <, =, BETWEEN, ILIKE)
- Visualize results on map and in tabular format
- Feature highlighting and zoom on selection


## 📂 Project Structure
  
  ├── index.html # Main dashboard layout and UI structure
  ├── map.js # All JavaScript map logic and event handling
  ├── style.css # Custom styles and OpenLayers overrides
  ├── libs/ # External libraries (Bootstrap, OL, plugins)


## ⚙️ Setup Instructions

### 1. GeoServer Setup
- Deploy [GeoServer](http://geoserver.org/) on Apache Tomcat.
- Publish raster/vector layers with WMS and WFS enabled.
- Ensure CORS is enabled for local browser requests.

### 2. Client Setup
- Clone this repository or place the files in your server directory.
- Open `index.html` in your browser.
- Set the correct GeoServer endpoint in the **Server URL** field (e.g., `http://localhost:8080/geoserver/web/`).


## 🧠 Usage Guide

### WFS Operations
- Click “GetCapabilities” to list available WFS layers.
- Select a layer → choose an attribute → define an operator and value.
- Click “Load Layer” to run the query and visualize the result.

### WMS Operations
- Click “Available WMS Layers” to view layers from GeoServer.
- Select a layer → optionally provide bounding box → add to map.

### Tools
- **Clear**: Remove all overlays and reset map.
- **Activate GetInfo**: Enable WMS GetFeatureInfo on click.
- **Show Legend**: Toggle dynamic legend for visible layers.


## 🛡️ License

This project is distributed for academic and non-commercial use. You are free to use, modify, and extend it with attribution.


## ✍️ Author

Developed as part of a GIS system integration demonstration using OpenLayers and GeoServer. You can contact rupesh32003@gmail.com for any queries 






