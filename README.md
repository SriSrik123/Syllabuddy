# Syllabuddy

A collaborative web app that helps students manage their academic life. Upload syllabi, let AI extract dates and answer questions, track assignments with friends, and export everything to your calendar.

## Features

### Core
- **Upload Syllabi** — Drag-and-drop PDF, DOCX, PNG, or JPG files for each course
- **AI-Powered Q&A** — Ask questions across all your syllabi using RAG (Retrieval-Augmented Generation)
- **Automatic Date Extraction** — AI identifies exams, assignments, quizzes, projects, and deadlines
- **Calendar Export** — Download `.ics` files or sync directly to Google Calendar via API

### Assignments
- **Manual Entry** — Quickly add assignments with title, course, date, type, and description
- **AI Extraction** — Paste any text (emails, course websites, notes) and AI parses out assignments automatically
- **Friend Autocomplete** — As you type an assignment title, see if friends already have it and click to autofill the entire form

### Collaboration
- **Friend System** — Search for classmates by name or email and send friend requests
- **Shared Progress** — See which friends are in the same classes and have the same assignments/exams
- **Status Tracking** — Mark assignments as To Do, Working, or Done — friends can see each other's progress
- **Dashboard Overlap** — Upcoming events show how many friends share them, with click-to-view details

### Other
- **Dark / Light Mode** — System-aware theme toggle
- **Google Calendar Integration** — OAuth2 flow to push events directly to Google Calendar
- **Responsive UI** — Clean, professional design with Inter font and blue accent palette

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express 5, TypeScript |
| **Database** | MongoDB (Atlas for production) |
| **AI** | Azure AI Foundry — GPT-4o (chat & extraction), text-embedding-3-small (embeddings) |
| **Auth** | JWT + bcrypt password hashing |
| **File Processing** | pdf-parse (PDFs), mammoth (DOCX), tesseract.js (OCR for images) |
| **Calendar** | ical-generator (.ics export), Google Calendar API |
| **Hosting** | Vercel (frontend + serverless API) |

## Project Structure

```
├── api/
│   └── index.ts              # Vercel serverless entry point
├── client/
│   └── src/
│       ├── components/        # Layout, shared UI
│       ├── context/           # Auth & Theme providers
│       ├── pages/             # Dashboard, Upload, Chat, Calendar, Assignments, Friends
│       └── services/          # API client (axios)
├── server/
│   └── src/
│       ├── middleware/         # JWT auth middleware
│       ├── models/            # Mongoose schemas (User, Syllabus, CalendarEvent, Embedding, Friendship)
│       ├── routes/            # Express route handlers (auth, syllabus, ai, calendar, friends)
│       └── services/          # Azure AI, RAG pipeline, text extraction, Google OAuth
├── vercel.json                # Vercel deployment config
└── .env.example               # Environment variable template
```

## Prerequisites

- **Node.js** 20+
- **MongoDB** — local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) (Atlas required for Vercel deployment)
- **Azure AI Foundry** account with:
  - A chat model deployment (e.g. `gpt-4o`)
  - An embedding model deployment (e.g. `text-embedding-3-small`)
- **Google Cloud Console** project (optional, for Google Calendar integration)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/SriSrik123/Syllabuddy.git
cd Syllabuddy

# Install root dependencies (needed for Vercel serverless)
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/syllabus-tracker

# Auth
JWT_SECRET=pick-a-strong-random-secret

# Azure AI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# Server
PORT=5001
CLIENT_URL=http://localhost:5174

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5001/api/calendar/google/callback
```

### 3. Run locally

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

The app will be available at **http://localhost:5174**.

## Deploying to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env` to Vercel's project settings
4. Set `CLIENT_URL` to your Vercel domain (e.g. `https://syllabuddy.vercel.app`)
5. If using MongoDB Atlas, add `0.0.0.0/0` to Atlas Network Access to allow Vercel's dynamic IPs
6. Deploy — Vercel uses the `vercel.json` config to build the client and serve the API as a serverless function

## How It Works

1. **Upload** a syllabus file for any course
2. Text is extracted (PDF parsing, DOCX conversion, or OCR for images)
3. Text is **chunked and embedded** into MongoDB for vector search (RAG)
4. **Important dates** are extracted by AI and saved as calendar events
5. **Ask AI** questions — your query is embedded, matched against relevant chunks across all classes, and answered with context
6. **Add assignments** manually or paste text for AI extraction — the form autocompletes from friends' existing assignments
7. **Track progress** with friends — see who shares your classes, exams, and assignments, and how they're doing
8. **Export** events to Apple Calendar (.ics) or Google Calendar

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/syllabus/upload` | Upload syllabus file |
| GET | `/api/syllabus` | List syllabi |
| DELETE | `/api/syllabus/:id` | Delete syllabus + events |
| POST | `/api/ai/chat` | RAG-powered Q&A |
| POST | `/api/ai/extract-assignments` | AI assignment extraction from text |
| GET | `/api/calendar/events` | List events (with filters) |
| POST | `/api/calendar/events` | Create single event |
| POST | `/api/calendar/events/bulk` | Bulk create events |
| PATCH | `/api/calendar/events/:id/status` | Update event status |
| GET | `/api/calendar/export/ics` | Export .ics file |
| GET | `/api/friends/search` | Search users by name/email |
| POST | `/api/friends/request` | Send friend request |
| GET | `/api/friends/requests` | Get pending requests |
| POST | `/api/friends/accept/:id` | Accept request |
| GET | `/api/friends` | List friends |
| GET | `/api/friends/progress` | Friend progress on shared events |
| GET | `/api/friends/class-overlap` | Class/event overlap counts |
| GET | `/api/friends/match-assignment` | Autocomplete assignments from friends |

## License

MIT
