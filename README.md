# 🏟️ VenueFlow: Real-Time Crowd Intelligence & Safety Platform

> **Transforming Large Venues with Real-Time Density Heatmaps, Automated DIM-ICE Crowd Safety Alerts, and Multilingual AI Navigation.**

VenueFlow is an enterprise SaaS platform engineered for stadiums, arenas, festival grounds, and large-scale event facilities. Built with Next.js 14 App Router, React 19, Firebase, Google Maps Places API, and Google Gemini AI, VenueFlow replaces legacy manual crowd management with a real-time, data-driven "Mission Control" system.

---

## 🎯 The Problem VenueFlow Solves

1. **Crowd Congestion & Safety Hazards**: Unmanaged crowd surges at stadium gates, food courts, and egress bottlenecks create high-risk safety hazards. Without real-time density tracking, operators cannot detect crowd build-ups before they breach dangerous thresholds.
2. **Frustrated Guests & Long Lines**: Stadium attendees spend upwards of 30 minutes stuck in concession and restroom lines, missing key event moments and halftime shows due to lack of visibility.
3. **Operator Blindspots**: Venue management teams traditionally rely on static security feeds and radio chatter, lacking a single unified dashboard to monitor live zone capacity, control event phase progressions (Pre-Game, Halftime, Egress), or issue targeted section broadcasts.

---

## 💡 How VenueFlow Solves It

```
                              ┌─────────────────────────────────────────┐
                              │           VENUEFLOW PLATFORM            │
                              └────────────────────┬────────────────────┘
                                                   │
         ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
         │                                         │                                         │
┌────────┴────────┐                       ┌────────┴────────┐                       ┌────────┴────────┐
│ ORGANIZATIONS   │                       │ REAL-TIME ENGINE│                       │ GUEST PWA       │
│ & STADIUM IMPORTER                       │ & DIM-ICE SAFETY│                       │ & AI ASSISTANT  │
└────────┬────────┘                       └────────┬────────┘                       └────────┬────────┘
         │                                         │                                         │
 🏢 Google Places API                      ⚡ Firebase RTDB                          🤖 Gemini 1.5 &
    Real lat/lng geocoding                    Live 30s zone telemetry                   Domain AI Engine
 🗺️ Dynamic stadium map &                  🚨 Automated 85%/90%                      💬 6 Languages
    zone polygon generator                    safety alert triggers                     ♿ Step-free paths
```

### Key Pillars & Core Solutions

1. **Real-World Stadium Importer (Google Maps Places API)**
   - Paste any Google Maps URL or type any venue name (e.g. *Wembley Stadium*, *Madison Square Garden*, *MetLife Stadium*).
   - VenueFlow queries Google Places API (`textsearch` + `details`) to fetch exact geographic coordinates, automatically generating zone polygons and amenity markers centered on the stadium's real-world location.

2. **Real-Time Crowd Density Engine (Firebase RTDB)**
   - Tracks live occupancy across all venue zones (e.g. North Lower, South Lower, East Club, West Club, Upper Deck).
   - Updated continuously via simulated IoT sensors, staff gate check-ins, or live event phase simulation loops.

3. **DIM-ICE Automated Safety Protocol**
   - Implements the international DIM-ICE (Direction, Information, Movement, Management, Infrastructure, Capacity, Entrances/Exits) crowd safety framework.
   - Automatically triggers **High Congestion Warnings** at 85% zone capacity and **Critical Safety Re-allocations** at 90% capacity.

4. **Zero-Install Guest PWA & Multilingual AI Assistant (`/g/[venueId]`)**
   - Attendees scan a venue QR code to instantly access an interactive Leaflet dark-matter heatmap, live wait times for restrooms/concessions, and step-free accessible routes.
   - **Ask AI**: Multilingual assistant supporting English, Spanish, Portuguese, French, Hindi, and Arabic. Features OWASP LLM01 prompt-injection sanitization, budget-aware model routing (Gemini 1.5 Flash / 1.5 Pro), and a fail-safe Smart Local Domain AI fallback.

5. **Operator Mission Control (`/org/[orgId]/venue/[venueId]/admin`)**
   - High-density operator dashboard with real-time KPI metrics (Total Guests, Avg Occupancy, Critical Zones, Open Incidents).
   - Interactive stadium map overlay, simulation controls (Go Live, Advance Phase: Pre-Game → Halftime → Egress), emergency broadcast center, and incident log.

6. **Staff Gate Operations Console (`/org/[orgId]/venue/[venueId]/staff`)**
   - Mobile-optimized interface for gate staff to log live check-ins and check-outs, monitor section capacity in real time, and report incidents instantly.

---

## 👥 User Flows

### Flow 1: Organization & Real-World Venue Setup
```
Landing Page (/) ➔ Onboarding (/onboarding) ➔ Org Dashboard (/org/[orgId]) ➔ Add Real-World Venue
```
1. Users land on the sleek SaaS landing page and click **"Start free trial"** or **"View live demo"**.
2. **Onboarding Wizard** prompts the user to create their organization (e.g., *MetLife Sports Group*).
3. On the Organization Dashboard, admins can choose the pre-loaded **MetLife Stadium** demo or click **"Add venue with Google Maps"** to import any stadium worldwide using Google Places API.

### Flow 2: Operator Command Center & Live Simulation
```
Org Dashboard (/org/[orgId]) ➔ Venue Admin (/org/[orgId]/venue/[venueId]/admin) ➔ Go Live
```
1. Operator selects a venue to open the **Per-Venue Admin Console**.
2. Operator views real-time venue KPIs, interactive map heatmaps, and zone status tables.
3. Clicking **"Go Live"** initiates the event simulation loop, stepping through event phases (*Doors Open ➔ Pre-Game ➔ Halftime ➔ Egress*) while RTDB broadcasts updated density telemetry to all connected clients.
4. Operator can issue targeted announcements to specific sections or resolve reported incidents.

### Flow 3: Mobile Gate Check-In & Staff Management
```
Admin Navigation ➔ Staff Portal (/org/[orgId]/venue/[venueId]/staff) ➔ Gate Scan
```
1. Staff members open their designated gate view.
2. Staff log incoming guest check-ins with one tap, updating real-time section counts.
3. Gate queue wait times and section densities update automatically across both Admin and Guest dashboards.

### Flow 4: Guest Mobile PWA & AI Navigation
```
Scan Venue QR Code ➔ Guest View (/g/[venueId]) ➔ Live Map / Wait Times / Ask AI
```
1. Attendees scan the venue QR code or visit `/g/[venueId]`.
2. **Live Map Tab**: Displays an interactive Leaflet dark-matter map with live color-coded zone density circles and emoji amenity markers (🚻 restrooms, 🍔 food, 🛍️ shops, 🚪 gates).
3. **Wait Times Tab**: Lists open restrooms and food courts sorted by shortest wait time, with accessibility indicators (♿ Step-Free).
4. **Ask AI Tab**: Guest types or speaks a question in their preferred language (e.g., *"Where is the nearest restroom?"* or *"Which zone is least crowded?"*). The AI assistant responds instantly with context-aware venue advice.

---

## 🛡️ OWASP LLM Security & Safety Architecture

- **OWASP LLM01 (Prompt Injection Guard)**: All user queries in *Ask AI* pass through `sanitizeInput()` (`src/lib/inputGuard.ts`), filtering out adversarial prompts, system prompt overrides, or unauthorized commands.
- **OWASP LLM02 (PII/PCI Data Scrubber)**: AI responses pass through `scrubOutput()`, redacting any sensitive internal telemetry, personal identifiable information, or credentials.
- **Role-Based Access Control (RBAC)**: Firestore Security Rules enforce strict org-level and venue-level permissions so operators can only modify venues within their organization.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend Framework** | **Next.js 14 (App Router)** | React 19, Server & Client Components, TypeScript |
| **Styling & UI** | **Vanilla CSS + Tailwind CSS** | Design Tokens, Mission Control Dark Mode, Glassmorphism |
| **Realtime Database** | **Firebase Realtime Database** | Sub-second WebSocket crowd density synchronization |
| **Document Store** | **Cloud Firestore** | Multi-tenant organizations, venues, events, incidents |
| **Geocoding & Maps** | **Google Places API + Leaflet** | Real-world stadium search, coordinates, dark maps |
| **Artificial Intelligence**| **Google Gemini 1.5 API** | Multilingual Q&A, route optimization, wait predictions |
| **Fallback AI Engine** | **Smart Local Domain Engine** | Zero-latency local domain model fallback |
| **Icons & Media** | **Lucide React** | Clean, minimalist SVG icon set |

---

## 📁 Repository Directory Structure

```
venueflow/
├── public/                     # Static public assets
├── src/
│   ├── app/
│   │   ├── api/                # Next.js API Routes (Server-only)
│   │   │   ├── events/         # Event management & simulation endpoints
│   │   │   └── venues/import/  # Google Maps Places API venue import handler
│   │   ├── g/[venueId]/        # Zero-Install Mobile Guest PWA
│   │   ├── org/[orgId]/        # Multi-Tenant Organization Dashboard
│   │   │   └── venue/[venueId]/
│   │   │       ├── admin/      # Operator Command Center
│   │   │       └── staff/      # Staff Gate Operations & Scan Check-In
│   │   ├── onboarding/         # Setup & Organization Wizard
│   │   ├── login/              # Secure Authentication Page
│   │   ├── globals.css         # SaaS Design Tokens & Global CSS Utilities
│   │   ├── layout.tsx          # Root Application Layout & Fonts
│   │   └── page.tsx            # SaaS Marketing Landing Page
│   ├── components/
│   │   ├── Map/                # Leaflet Interactive Map Container & Heatmap
│   │   ├── AIChat.tsx          # Multilingual Ask AI Component
│   │   └── LiveRegion.tsx      # Accessibility Screen Reader Live Region
│   ├── hooks/
│   │   ├── useAuth.ts          # Firebase Authentication Hook
│   │   └── useRealtimeData.ts  # RTDB & Firestore Data Subscriptions
│   ├── lib/
│   │   ├── crowdEngine.ts      # Pure Client Density & Math Constants
│   │   ├── crowdEngineServer.ts# Server-Only RTDB Writes & Simulation Loops
│   │   ├── firebase.ts         # Firebase Client SDK Initialization
│   │   ├── firebaseAdmin.ts    # Server-Only Firebase Admin SDK
│   │   ├── firestore.ts        # Firestore CRUD Operations
│   │   ├── gemini.ts           # AI Assistant, OWASP Guard & Fallback Engine
│   │   ├── inputGuard.ts       # OWASP LLM01 & LLM02 Sanitizers
│   │   ├── modelRouter.ts      # Budget-Aware AI Model Tier Classifier
│   │   ├── sampleData.ts       # Single MVP Demo Venue Data (MetLife Stadium)
│   │   └── utils.ts            # Formatting Utilities & Density Colors
│   └── types/                  # TypeScript Interfaces & Schemas
├── firestore.rules             # Deployed Firestore Security Rules
├── package.json
└── tsconfig.json
```

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**
- A **Firebase Project** (with Authentication, Firestore, and Realtime Database enabled)
- *(Optional)* **Google Maps Places API Key** for importing real-world venues

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcde"
NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://your-project-default-rtdb.firebaseio.com"

# Google Gemini AI Key
NEXT_PUBLIC_GEMINI_API_KEY="AIzaSy..."

# Google Maps Places API Key (Real-World Venue Import)
GOOGLE_MAPS_API_KEY="AIzaSy..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSy..."
```

### 3. Installation & Development

```bash
# Install dependencies
npm install

# Start the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the VenueFlow application.

### 4. Build & Production Verification

```bash
# Type check TypeScript files
npx tsc --noEmit

# Create optimized production build
npm run build
```

---

## 📄 License

This project is licensed under the **MIT License**.

---
*VenueFlow — Empowering Safer, Smarter, and Seamless Live Events worldwide.*
