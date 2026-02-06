# SyllabusTracker

A web app that lets students upload their course syllabi, ask AI-powered questions about them, and automatically extract important dates for calendar export.

## Features

- **Upload Syllabi** — Upload PDF, DOCX, PNG, or JPG syllabus files for each class
- **RAG-Powered Q&A** — Ask questions that search across ALL your syllabi using vector embeddings and AI
- **Automatic Date Extraction** — AI identifies exams, assignments, deadlines, and other important dates
- **Calendar Export** — Download `.ics` files (Apple Calendar / Outlook) or add events directly to Google Calendar
- **User Accounts** — Each student has a private account with their own syllabi and data

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB
- **AI**: Azure AI Foundry (GPT-4o for chat, text-embedding-3-small for RAG)
- **Vector Store**: Vectra (local file-based vector DB)

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Azure AI Foundry account with deployed models:
  - A chat model (e.g., `gpt-4o`)
  - An embedding model (e.g., `text-embedding-3-small`)

## Getting Started

### 1. Clone and install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```
MONGODB_URI=mongodb://localhost:27017/syllabus-tracker
JWT_SECRET=pick-a-strong-random-secret
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
PORT=5000
```

### 3. Start the development servers

In one terminal, start the backend:

```bash
cd server
npm run dev
```

In another terminal, start the frontend:

```bash
cd client
npm run dev
```

The app will be available at **http://localhost:5173**.

## How It Works

1. **Upload** a syllabus file for each class
2. Text is extracted from the file (PDF parsing, DOCX conversion, or OCR for images)
3. The text is **chunked and embedded** into a vector store for RAG retrieval
4. **Important dates** are automatically extracted using AI and saved as calendar events
5. In the **Ask AI** chat, your questions are embedded, matched against relevant syllabus chunks across ALL classes, and answered with citations
6. **Export** events to Apple Calendar (.ics) or Google Calendar with one click
