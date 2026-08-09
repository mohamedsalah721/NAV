# ShipNav - Professional Maritime Navigation Suite ⚓

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**ShipNav** is a comprehensive, modern, browser-based web application providing high-precision nautical calculators, bridge planning tools, ship handling models, and navigation conversion utilities for deck officers, navigators, and maritime students.

---

## 🚀 Features & Calculators

### 🗺️ Navigation Calculators
- **Distance & Bearing**: Great-Circle (Haversine) distance and initial/final true bearings between positions entered in **Degrees Decimal Minutes (DDM)**.
- **Course & Distance**: Compute destination coordinates using **Great Circle** or **Rhumb Line (Mercator sailing)** algorithms.
- **ETA Calculator**: Passage duration and arrival date/time estimation based on distance run and speed over ground.
- **Speed / Distance / Time**: Interactive formula solver with multi-unit support (NM, km, m, knots, km/h, m/s).
- **Set & Drift**: Vector resolution of Course Made Good (CMG) and Speed Made Good (SMG) accounting for current set & drift with an interactive compass rose visualization.
- **Geographic Range**: Visual horizon distance derived from light height and observer's eye height.

### 🚢 Ship Handling & Safety
- **Ship Squat Calculator**: Shallow water squat and under-keel clearance (UKC) estimation using the Barrass method with confined-water blockage factor adjustments.
- **Advance, Transfer & Wheel-Over Point (WOP)**: Turning circle geometry modeling, advance, transfer, tactical diameter, and wheel-over track distance calculation.
- **CPA / TCPA Calculator**: Closest Point of Approach (CPA) distance and Time to CPA (TCPA) computation based on target and own-ship motion vectors.

### ⚓ Tactical & Screening
- **Vessel Stationing**: Quadratic vector solver for course, speed, time, and distance required for own ship to change station relative to a moving guide ship.
- **Traffic Lane Geometry**: Sizing screening lanes and traffic zone boundaries from radar detection range and relative speed ratios.

### 🌊 Tides & Coordinates
- **Tidal Height & Curve Estimator**: Cosine half-tide interpolation to estimate tide height at any given time between High Water and Low Water, accompanied by an SVG tidal curve graph.
- **Latitude / Longitude Converter**: Bi-directional conversion between Degrees Decimal Minutes (DDM), Decimal Degrees (DD), and Degrees Minutes Seconds (DMS).
- **Compass Error (TVMDC)**: Conversion between Compass, Magnetic, and True courses with Variation and Deviation tracking (East positive, West negative).

### 🛠️ Utilities & References
- **Nautical Unit Converter**: Distance, speed, depth (fathoms/m/ft), pressure (hPa/bar/psi), and temperature (C/F/K).
- **AIS & GNSS Quick Reference**: Operational reference points and best practices.
- **Saved Calculations**: Session-persistent history log to save, name, duplicate, copy, and export calculation results.

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` or `pnpm` or `yarn`

### Installation

```bash
# Clone the repository
git clone https://github.com/mohamedsalah721/NAV.git

# Navigate into the project folder
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

The production bundle will be generated in the `dist/` directory.

---

## 📜 Technical Notes & Disclaimer

- **Position Formats**: Inputs across ShipNav default to Degrees Decimal Minutes (DDM), the standard operational format used on marine GPS/ECDIS bridge displays.
- **Earth Model**: Spherical Earth (mean radius $R = 3440.065 \text{ NM}$) is used for Great Circle computations.
- **Disclaimer**: ShipNav is an educational and calculation aid intended to support — not replace — official nautical charts, Admiralty publications, ECDIS, radar, tide tables, COLREGS, and professional bridge seamanship.