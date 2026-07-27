# 🤖 Autonomous Social Media Agency

An AI agent team that researches trending topics, writes platform-specific social media posts, and presents them on a professional dashboard for approval.

---

## 🏗 Architecture

```
my-app/               ← React Frontend        (port 3000)
backend/
  server_crewai.py   ← Python + CrewAI        (port 5000) ✅ MAIN
  server.py          ← Python + LangChain     (port 5000) alternative
  server.js          ← Node.js + Express      (port 5000) alternative
```

---

## ⚡ Quick Start

### Step 1 — Install Dependencies (first time only)

```bash
cd backend
pip install -r requirements.txt
```

### Step 2 — Start the Backend

```bash
python server_crewai.py
```

You should see:
```
✅ CrewAI Server running on port 5000
🤖 Framework  : CrewAI (multi-agent roles)
🔍 Agent 1    : Trend Scout    (DuckDuckGo Search + Groq Llama 3.3)
✍️  Agent 2    : Content Creator (Groq Llama 3.3)
🔁 Correction : Twitter 280-char self-correction active
💾 Save       : approved_posts.txt
```

### Step 3 — Start the Frontend

Open a **second terminal**:

```bash
cd my-app
npm start
```

Open in browser: **http://localhost:3000**

---

## 🧠 AI Architecture & Pipeline Flow

The application uses a secure multi-agent architecture with a built-in pre-search classifier to filter out unknown personal names, preventing hallucinated or fake news generation before the crew kicksoff.

```
                  [ 🚀 User Topic Input ]
                             │
                             ▼
            [ 🔍 Step 1: DuckDuckGo Pre-Search ]
       Queries DuckDuckGo to check live internet mentions
                             │
                             ▼
            [ 🏷️ Step 2: REST Classifier LLM ]
       Classifies topic: FAMOUS_PERSON | UNKNOWN_PERSON | INDUSTRY
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ UNKNOWN_PERSON ]                [ FAMOUS_PERSON / INDUSTRY ]
            │                                 │
     (Zero news/mentions)            (Has active search proof)
            │                                 │
            ▼                                 ▼
   [ ❌ Return 400 Bad Request ]     [ 🚀 Run CrewAI Pipeline ]
    Blocked! Shows warning banner             │
                                              ▼
                             ┌─────────────────────────────────┐
                             │  🤖 AGENT 1: Trend Scout        │
                             │  Role    : Research Expert      │
                             │  Tool    : DuckDuckGo Search    │  ← Performs detailed search
                             │  Goal    : Find 3 trending news │
                             │  LLM     : Llama 3.3 70B (Groq) │
                             └────────────────┬────────────────┘
                                              │ (output passed automatically)
                                              ▼
                             ┌─────────────────────────────────┐
                             │  🤖 AGENT 2: Content Creator    │
                             │  Role    : Social Media Expert  │
                             │  Goal    : Write viral posts    │
                             │  LLM     : Llama 3.3 70B (Groq) │
                             │  Output  : LinkedIn + X + Insta │
                             └────────────────┬────────────────┘
                                              │
                                              ▼
                                     [ 🔁 Self-Correction ]
                                  Ensures tweets are < 280 chars
                                              │
                                              ▼
                                     [ ✅ Display in React UI ]
```

---

## 🎯 Features

| Feature | Description |
|---|---|
| **Topic Input** | Type any niche (e.g. "Gaming Tech", "Sustainable Fashion") |
| **Quick Topics** | One-click topic suggestions |
| **Agent Thought Log** | Real-time log showing what each agent is doing |
| **Trend Scout Agent** | Searches DuckDuckGo for live trending news |
| **Content Creator Agent** | Writes viral posts for 3 platforms |
| **Auto Handoff** | Agent 1 output is automatically passed to Agent 2 |
| **Self-Correction** | Twitter posts over 280 chars are automatically rewritten |
| **Post Gallery** | 3 stories × 3 platforms = 9 post cards |
| **Edit Posts** | Edit any generated post before approving |
| **Approve & Save** | Saves approved posts to `backend/approved_posts.txt` |

---

## 🔧 Tech Stack

| Component | Technology |
|---|---|
| **Agent Framework** | CrewAI (multi-agent roles) |
| **Primary LLM** | Groq API — `llama-3.3-70b-versatile` |
| **Pre-Search Classifier** | Direct REST API to Groq (Llama 3.3 70B) |
| **Search Tool** | DuckDuckGo (real live web search) |
| **Backend** | Python + Flask |
| **Frontend** | React (Create React App) |
| **Self-Correction** | Twitter 280-char auto-rewrite loop (ChatGroq + LangChain) |
| **Fail-Safe & Rate Limits** | Auto-retry logic with exponential backoff & placeholder detection |

---

## 🔑 API Key

Add your Groq API key to `backend/.env`:

```
GROQ_API_KEY=your_key_here
```

Get a free Groq API key at: **https://console.groq.com/keys**

---

## 📁 Approved Posts

When you click **Approve & Save** on any post card, it gets appended to:

```
backend/approved_posts.txt
```

---

## 🗂 Alternative Backends

> ⚠️ Only run **one** backend at a time — all three use port 5000.

| File | Framework | Command |
|---|---|---|
| `server_crewai.py` | CrewAI ✅ (recommended) | `python server_crewai.py` |
| `server.py` | LangChain | `python server.py` |
| `server.js` | Node.js (no framework) | `node server.js` |
