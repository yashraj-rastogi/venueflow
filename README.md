# VenueFlow: The Intelligent Event Experience Platform

VenueFlow is a next-generation "Mission Control" dashboard that revolutionizes the large-venue experience. Born out of the frustration of navigating crowded stadiums and endless lines, VenueFlow leverages **Firebase RTDB** for real-time crowd tracking and the **Gemini 1.5 Pro API** for predictive pathing and intelligent insights.

![VenueFlow Dashboard](https://images.unsplash.com/photo-1540306352932-d04b6bdc206e?auto=format&fit=crop&q=80&w=1200&h=400)

## 🚀 Features

- **Real-Time Heatmaps & Density Tracking:** Instantly visualize crowd density across stadium zones.
- **AI-Powered "Navigate" Module:** Let Gemini analyze live wait times, distance, and congestion to plot the optimal route to your seat, restrooms, or concessions.
- **Smart Analytics & Predictions:** Know *before* you go. VenueFlow predicts peak wait times based on event progression and historical data using AI.
- **Interactive Venue Map:** Edge-to-edge, frictionless panning map built with Leaflet and live density color-coding.
- **Direct Admin Broadcasts:** Staff operations console with the ability to trigger secure, targeted push notifications sent instantly to users in specific sections.
- **AI Concierge (Chat):** Ask VenueFlow any question about the facility—from "Where is the nearest vegan food?" to "Is the West Gate crowded?"—and get an instant, context-aware answer.
- **Secure Auth & Guest Mode:** Frictionless onboarding using Firebase Authentication (Google) while retaining an anonymous viewing mode for fast access.

## 🛠 Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Directory, React Server Components)
- **Styling:** CSS Modules with a custom premium "Mission Control" design system (Glassmorphism, CSS Grids).
- **Backend/Database:** [Firebase Realtime Database](https://firebase.google.com/products/realtime-database)
- **Authentication:** [Firebase Authentication](https://firebase.google.com/products/auth) (Google Auth, Custom Admin Claims)
- **AI & Analytics:** [Gemini 1.5 Pro](https://ai.google.dev/) (via Node SDK proxy to secure API keys)
- **Icons & Maps:** Lucide React, react-leaflet

## ⚙️ How It Works (Architecture)

1.  **Data Ingestion:** The `useRealtimeData` hook subscribes directly to Firebase RTDB paths (`/venues/{id}/crowd`). An internal cron/API handler can simulate crowd shifts dynamically via `/api/crowd/update`.
2.  **State Management:** React manages complex UI states (modals, chats, map interactions), falling back to a comprehensive robust `sampleData.ts` seed file during cold starts.
3.  **AI Proxy:** Calls to Gemini are routed through server-side Next.js API endpoints (`/api/predict`, `/api/chat`) to protect the `NEXT_PUBLIC_GEMINI_API_KEY`. The server securely queries Gemini using both standard prompts and structured data about the venue footprint.
4.  **Admin Control:** Custom claims separate staff from standard attendees. Staff have access to the `/admin` portal, which broadcasts messages to users connected to RTDB.

## 💻 Running the Project Locally

### 1. Prerequisites
- Node.js (v18+)
- A Firebase Project (with RTDB and Auth enabled)
- A Gemini API Key from Google AI Studio

### 2. Environment Variables
Create a `.env.local` file in the root of the project:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_auth_domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
NEXT_PUBLIC_FIREBASE_DATABASE_URL="your_database_url"

# Gemini
NEXT_PUBLIC_GEMINI_API_KEY="your_gemini_api_key"
```

### 3. Installation & Run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## 🏆 Hackathon Context

This project was rapidly prototyped from a static Figma ideation to a fully functional MVP integrating live WebSockets (RTDB) and AI prediction models. The primary design philosophy was replacing traditional list-based navigation with a high-end, immersive spatial UI.

---
_Built with ❤️ for the Future of Live Events._
