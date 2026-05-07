# Gemini Chatbot

A minimal web-based chatbot powered by Google's Gemini API. Supports text conversation, document uploads (PDF/TXT), image uploads (PNG/JPG), and multi-chat session management.

## Features

- 💬 Text-based chat with Gemini 1.5 Flash
- 📄 Document upload (PDF & TXT) with context-aware Q&A
- 🖼️ Image upload (PNG & JPG) with visual understanding
- 🗂️ Multiple chat sessions with sidebar navigation
- ⚡ Loading indicators for uploads and responses
- 🔄 New Chat / context reset
- 🔑 API key stored in browser localStorage

---

## Prerequisites

- Node.js v18+ and npm
- A Google Gemini API key ([get one free here](https://aistudio.google.com/app/apikey))

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/OmHadke/gemini-chatbot.git
cd gemini-chatbot
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Setting the Gemini API Key

You have two options:

### Option A — Via the UI (recommended)
When you open the app, click **"Set API Key"** in the top-right corner and paste your key. It will be saved in your browser's `localStorage`.

### Option B — Via environment variable (backend)
Create a `.env` file in the `backend/` directory:

```
GEMINI_API_KEY=your_api_key_here
PORT=3001
```

> Note: The current implementation accepts the API key from the frontend per request. If you prefer to store it server-side, you can modify `server.js` to read from `process.env.GEMINI_API_KEY`.

---

## Running the App

### Start the backend

```bash
cd backend
npm start
# Server starts on http://localhost:3001
```

### Start the frontend (in a separate terminal)

```bash
cd frontend
npm start
# App opens at http://localhost:3000
```

---

## Example Usage

### Document Q&A

1. Click **"Upload Doc"** → select a PDF or TXT file
2. Type: _"Summarize the document"_ → bot generates a summary
3. Type: _"What was the third point mentioned?"_ → bot uses document + conversation context

### Image Q&A

1. Click **"Upload Image"** → select a PNG or JPG
2. Type: _"What's in the image?"_ → bot describes the image
3. Type: _"Is there any text visible?"_ → bot answers using same image

### Context Reset

1. Have a conversation with a document/image
2. Click **"New Chat"** in the sidebar
3. Previous context is fully cleared — fresh session begins

---

## Project Structure

```
gemini-chatbot/
├── backend/
│   ├── server.js          # Express API server
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── App.css        # Styles
│   │   └── index.js       # Entry point
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/new` | Create a new chat session |
| GET | `/api/chats` | List all chat sessions |
| GET | `/api/chat/:chatId` | Get chat history |
| POST | `/api/chat/:chatId/message` | Send a message |
| POST | `/api/chat/:chatId/upload/document` | Upload PDF/TXT |
| POST | `/api/chat/:chatId/upload/image` | Upload PNG/JPG |

## Tech Stack

- **Frontend**: React 18, Axios
- **Backend**: Node.js, Express, Multer, pdf-parse
- **AI**: Google Gemini 1.5 Flash via `@google/generative-ai`
- **State**: In-memory only (no database)
