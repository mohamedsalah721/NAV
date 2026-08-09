# ShipNav - Professional Maritime Navigation Suite ⚓

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://reactjs.org/)
[![Sanity CMS](https://img.shields.io/badge/Sanity%20CMS-a4ru0yl4-F03E2F?logo=sanity)](https://www.sanity.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**ShipNav** is a comprehensive, modern web application providing high-precision nautical calculators, bridge planning tools, ship handling models, and navigation conversion utilities, backed by **Sanity CMS Cloud** synchronization.

---

## ☁️ Sanity CMS Integration

ShipNav is connected to **Sanity CMS**:
- **Organization**: `oxTC2CKFD`
- **Project ID**: `a4ru0yl4`
- **Dataset**: `production`
- **Dashboard**: [Sanity Organization Console](https://www.sanity.io/organizations/oxTC2CKFD/project/a4ru0yl4/getting-started?ref=create-project)

### Environment Variables (`.env`)
```env
VITE_SANITY_PROJECT_ID=a4ru0yl4
VITE_SANITY_DATASET=production
VITE_SANITY_API_VERSION=2024-01-01
```

---

## 🚀 Features & Calculators

### 🗺️ Navigation Calculators
- **Distance & Bearing**: Great-Circle (Haversine) distance and initial/final true bearings between DDM positions.
- **Course & Distance**: Destination computation via **Great Circle** or **Rhumb Line (Mercator sailing)** algorithms.
- **ETA Calculator**: Passage duration and arrival estimation.
- **Speed / Distance / Time**: Interactive formula solver with multi-unit support.
- **Set & Drift**: Vector resolution of CMG & SMG with interactive compass rose visualizer.
- **Geographic Range**: Visual horizon distance derived from light height and eye height.

### 🚢 Ship Handling & Safety
- **Ship Squat Calculator**: Shallow water squat and UKC estimation using the Barrass method.
- **Advance, Transfer & Wheel-Over Point (WOP)**: Turning circle geometry modeling.
- **CPA / TCPA Calculator**: Closest Point of Approach and TCPA relative motion vectors.

### ⚓ Tactical & Screening
- **Vessel Stationing**: Quadratic vector solver for station changes relative to a moving guide ship.
- **Traffic Lane Geometry**: Sizing screening lanes and traffic zone boundaries.

### 🌊 Tides, Coordinates & Cloud Storage
- **Tidal Height & Curve Estimator**: Cosine half-tide interpolation with SVG tidal curve graph.
- **Latitude / Longitude Converter**: Bi-directional conversion between DDM, DD, and DMS.
- **Compass Error (TVMDC)**: TVMDC conversion flow with Variation & Deviation tracking.
- **Cloud Sync (Sanity CMS)**: Saved calculations sync automatically to Sanity CMS.

---

## 🛠️ Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/mohamedsalah721/NAV.git

# Navigate into the project directory
cd NAV

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Building for Production

```bash
npm run build
```