# Autonomous Social Media Agency

An AI-powered web application that uses multi-agent architecture (Trend Scout & Content Creator) to autonomously research trending topics on the live internet and generate platform-specific social media posts (LinkedIn, X/Twitter, Instagram) for human approval.

## Requirements

- **Node.js** (v18+)
- **Python** (v3.12+)
- A free **Groq API Key** (Get one at: https://console.groq.com/keys)

## Setup Instructions for New Developers

If you just cloned this repository, follow these 3 simple steps to get the app running:

### Step 1: Set up Environment Variables
1. Go into the `backend/` folder.
2. Rename or copy the `.env.example` file to `.env`.
3. Open the `.env` file and paste your Groq API key:
   ```env
   GROQ_API_KEY=gsk_your_real_api_key_here
   ```

### Step 2: Install All Dependencies
Open your terminal in the root folder (where this README is) and run:
```bash
npm install
npm run install-all
```
*(This will automatically install both the Python requirements for the backend and the Node modules for the frontend.)*

### Step 3: Start the App
To run both the backend API and the React frontend simultaneously, run:
```bash
npm start
```
The dashboard will open automatically at `http://localhost:3000`.

## Architecture
- **Frontend**: React.js
- **Backend**: Python (Flask)
- **AI Agents**: LangChain + Groq Llama 3.3
- **Search**: DuckDuckGo Live Search
