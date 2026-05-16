# Autonomous Social Media Agency — Project Explanation

## 1. Project Overview

This is a **full-stack AI-powered web application** that acts as an autonomous social media agency. The app uses **AI Agents** to automatically research trending topics from the live internet, generate platform-specific social media posts (LinkedIn, Twitter/X, Instagram), and present them on a professional dashboard for human approval.

The system follows a **multi-agent pipeline architecture** where each agent has a specific role, tools, and goals — mimicking how a real social media agency team works.

---

## 2. Technologies Used

### Frontend (React.js)
| Technology | Purpose |
|-----------|---------|
| **React.js 19** | UI framework for building the dashboard |
| **JavaScript (ES6+)** | Core programming language |
| **CSS-in-JS (Inline Styles)** | Component-level styling with dynamic properties |
| **Google Fonts (Inter)** | Modern typography |
| **Fetch API** | HTTP requests to backend API |

### Backend (Python + Flask)
| Technology | Purpose |
|-----------|---------|
| **Python 3.12** | Backend programming language |
| **Flask** | Lightweight web server framework (REST API) |
| **Flask-CORS** | Cross-Origin Resource Sharing (connects frontend to backend) |
| **LangChain** | AI Agent framework for building intelligent agents |
| **LangChain-Groq** | Integration of Groq LLM with LangChain |
| **LangChain-Community** | Community tools including DuckDuckGo search |
| **DuckDuckGo Search** | FREE live web search tool (no API key needed) |
| **Groq API (Llama 3.3 70B)** | Large Language Model for text generation |
| **python-dotenv** | Environment variable management (.env file) |

### DevOps / Tooling
| Technology | Purpose |
|-----------|---------|
| **npm + concurrently** | Runs frontend and backend simultaneously with one command |
| **kill-port** | Automatically frees occupied ports before starting |
| **Node.js** | Runtime for React development server |

---

## 3. Project Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER (Browser)                     │
│              http://localhost:3000                     │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Mission Brief│  │ Thought Log  │  │ Post Gallery │ │
│  │ (Input Box)  │  │ (Real-time)  │  │ (Cards)     │ │
│  └──────┬───────┘  └──────────────┘  └─────────────┘ │
│         │                                             │
└─────────┼─────────────────────────────────────────────┘
          │ HTTP POST (Fetch API)
          ▼
┌─────────────────────────────────────────────────────┐
│              BACKEND (Python Flask)                   │
│              http://localhost:5000                     │
│                                                       │
│  ┌───────────────────────────────────────────────┐   │
│  │           /api/pipeline (POST)                 │   │
│  │                                                │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  AGENT 1: Trend Scout                   │  │   │
│  │  │  Tool: DuckDuckGo Search (Live Web)     │  │   │
│  │  │  LLM:  Groq Llama 3.3 70B              │  │   │
│  │  │  Output: 3 Trending Stories (JSON)      │  │   │
│  │  └────────────────┬────────────────────────┘  │   │
│  │                   │                            │   │
│  │                   ▼                            │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  AGENT 2: Content Creator               │  │   │
│  │  │  LLM:  Groq Llama 3.3 70B              │  │   │
│  │  │  Output: 9 Posts (3 stories × 3 styles) │  │   │
│  │  └────────────────┬────────────────────────┘  │   │
│  │                   │                            │   │
│  │                   ▼                            │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  SELF-CORRECTION LOOP                   │  │   │
│  │  │  Check: Twitter posts ≤ 280 chars       │  │   │
│  │  │  Action: Auto-rewrite if over limit     │  │   │
│  │  └────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌───────────────────────────────────────────────┐   │
│  │           /api/save (POST)                     │   │
│  │  Saves approved post → approved_posts.txt      │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 4. How the Pipeline Works (Step by Step)

### Step 1: User Input
- User types a topic (e.g., "Gaming Tech") in the **Mission Brief** input box
- Clicks **"Launch Agents"** button
- Frontend sends `POST /api/pipeline` with `{ topic: "Gaming Tech" }` to backend

### Step 2: Agent 1 — Trend Scout
- **Tool Used:** DuckDuckGo Search (live web search, FREE)
- Searches the live internet for `"{topic} latest news 2025"`
- Gets real search results from DuckDuckGo
- Sends results to **Groq LLM (Llama 3.3 70B)** to convert into 3 structured news stories
- Each story has: `headline`, `source`, `summary`, `bullets` (key facts)
- **Fallback:** If DuckDuckGo fails, LLM generates stories from its training data

### Step 3: Agent 2 — Content Creator
- Takes the 3 stories from Trend Scout
- Generates **9 posts total** (3 stories × 3 platforms):
  - **LinkedIn** — Professional tone, 120-200 words, hook → facts → insight → CTA
  - **Twitter/X** — Punchy, bold, strictly under 280 characters
  - **Instagram** — Casual, emotional, 80-120 words with hashtags

### Step 4: Self-Correction Loop
- Checks every Twitter post: is it under **280 characters**?
- If over limit → automatically rewrites it using the LLM
- Ensures all posts meet platform character limits

### Step 5: Results Display
- Backend returns `{ stories, posts }` as JSON
- Frontend displays:
  - **Agent Thought Log** — shows what each agent did in real-time
  - **Post Gallery** — 3 story blocks, each with LinkedIn/Twitter/Instagram cards
  - **Character counter** — shows remaining characters with progress bar

### Step 6: Approve & Save
- User reviews each post on the dashboard
- Clicks **"Approve & Save"** button
- Frontend sends `POST /api/save` to backend
- Backend appends the post to `backend/approved_posts.txt` (text file)

---

## 5. Project File Structure

```
Autonomous Social Media Agency/
│
├── package.json              # Root config — runs both frontend & backend
│
├── backend/                  # Python Backend
│   ├── server.py             # Flask API + LangChain Agents (main file)
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # API keys (GROQ_API_KEY)
│   └── approved_posts.txt    # Saved/approved posts (auto-created)
│
├── my-app/                   # React Frontend
│   ├── package.json          # React dependencies
│   ├── public/               # Static files (index.html, favicon)
│   └── src/
│       ├── App.js            # Main component (entire UI)
│       ├── App.css           # Global styles
│       ├── index.js          # React entry point
│       └── index.css         # Root styles
│
└── node_modules/             # Root dependencies (concurrently)
```

---

## 6. Frontend Explanation (React)

The frontend is a **single-page React application** built with component-based architecture:

### Components:
| Component | Purpose |
|-----------|---------|
| **App** | Main component — manages state, handles pipeline execution |
| **PostCard** | Displays a single platform post (LinkedIn/Twitter/Instagram) with character counter |
| **StoryBlock** | Groups 3 PostCards under one news story |
| **EditModal** | Modal popup for editing posts before approval |

### Key Features:
- **Real-time Agent Thought Log** — shows live updates as agents work
- **Quick Topic Buttons** — pre-filled topics (Gaming Tech, Sustainable Fashion, etc.)
- **Character Counter** — visual progress bar showing chars used vs limit
- **Status Indicator** — Ready / Running / Complete / Error states
- **Edit & Approve** — human-in-the-loop approval workflow
- **Responsive Grid** — 3-column layout for LinkedIn, Twitter, Instagram cards

### State Management:
- `topic` — user's input topic
- `phase` — current state (idle/running/done/error)
- `logs` — agent thought log entries
- `stories` — 3 trending stories from Trend Scout
- `posts` — 9 generated posts (3 per story)
- `approvedMap` — tracks which posts are approved

---

## 7. Backend Explanation (Python)

The backend is a **Flask REST API** with **LangChain agent framework**:

### API Endpoints:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pipeline` | POST | Runs the full agent pipeline (search → write → correct) |
| `/api/save` | POST | Saves an approved post to `approved_posts.txt` |

### Agent Classes:

#### TrendScoutAgent
- **Role:** Find trending news stories
- **Tool:** `DuckDuckGoSearchRun` (live internet search)
- **LLM:** Groq Llama 3.3 70B (converts search results to structured JSON)
- **Output:** 3 stories with headline, source, summary, bullet points

#### ContentCreatorAgent
- **Role:** Write viral social media posts
- **LLM:** Groq Llama 3.3 70B (generates platform-specific content)
- **Self-Correction:** Automatically rewrites tweets over 280 characters
- **Output:** 9 posts (LinkedIn + Twitter + Instagram for each story)

### Helper Functions:
- `extract_json()` — Extracts JSON from LLM responses (handles markdown wrapping)
- `get_fallback_stories()` — Provides default stories if search fails
- `callLLM()` — Wrapper for Groq API calls via LangChain

---

## 8. NLP Challenges Addressed

| Challenge | Solution |
|-----------|----------|
| **Live Internet Research** | DuckDuckGo Search tool integrated with LangChain |
| **Multi-style Content Generation** | Single LLM prompt generates 3 platform styles simultaneously |
| **Character Limit Compliance** | Self-correction loop auto-rewrites over-limit tweets |
| **Structured Output Parsing** | JSON extractor handles markdown, code blocks, raw text |
| **Fallback Handling** | Graceful degradation when search or LLM fails |

---

## 9. How to Run

```bash
# 1. Install dependencies (first time only)
cd my-app && npm install && cd ..

# 2. Install Python dependencies (first time only)
py -3.12 -m pip install -r backend/requirements.txt

# 3. Add your Groq API key to backend/.env
# GROQ_API_KEY=gsk_your_key_here

# 4. Run the app (one command starts everything)
npm start
```

This single command:
1. Kills any processes on ports 3000 & 5000
2. Starts Python Flask backend on **port 5000**
3. Starts React dev server on **port 3000**
4. Opens the app in your browser

---

## 10. API Keys Required

| Service | Key | Free Tier | Purpose |
|---------|-----|-----------|---------|
| **Groq** | `GROQ_API_KEY` | ✅ 30 req/min, 14,400/day | LLM (Llama 3.3 70B) |
| **DuckDuckGo** | None needed | ✅ Unlimited | Live web search |

Get your free Groq key: [console.groq.com/keys](https://console.groq.com/keys)
