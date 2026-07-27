import os
import sys
import json
import re
from datetime import datetime

# Fix Windows console encoding for emoji output
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from crewai import Agent, Task, Crew, Process, LLM
from crewai.tools import tool as crewai_tool
from langchain_community.tools import DuckDuckGoSearchRun

# Set global litellm retries for rate limits
import litellm
litellm.num_retries = 5
import time

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# ═══════════════════════════════════════════════════════
#   LLM SETUP — Groq Llama 3.3 (Sir ki requirement)
# ═══════════════════════════════════════════════════════
# llama-3.3-70b-versatile — resets daily (kal se kaam karega)
GROQ_MODEL = "llama-3.3-70b-versatile"

llm = LLM(
    model=f"groq/{GROQ_MODEL}",
    api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=2000,
    max_retries=3
)

# ═══════════════════════════════════════════════════════
#   TOOL: DuckDuckGo Search (Agent 1 ka search tool)
# ═══════════════════════════════════════════════════════
_ddg_search = DuckDuckGoSearchRun()

# ═══════════════════════════════════════════════════════
#   HELPER: Smart Crew Kickoff with Auto-Retry
#   Reads exact wait time from Groq error, sleeps, retries
# ═══════════════════════════════════════════════════════
def kickoff_with_retry(crew, max_retries=5):
    """Run crew.kickoff() — if rate-limited, parse exact wait time from error and retry."""
    for attempt in range(max_retries):
        try:
            crew.kickoff()
            return
        except Exception as e:
            err = str(e)
            if 'rate_limit_exceeded' in err or 'RateLimitError' in err:
                # Parse exact retry time from Groq error message
                match = re.search(r'try again in (\d+(?:\.\d+)?)s', err)
                wait = float(match.group(1)) + 5 if match else 65  # +5s buffer
                print(f"\n⚠️  Rate limit hit (attempt {attempt+1}/{max_retries}).")
                print(f"⏳ Auto-waiting {wait:.0f} seconds before retry...")
                time.sleep(wait)
            else:
                raise  # Re-raise non-rate-limit errors
    raise Exception(f"Rate limit persisted after {max_retries} retries. Please wait a minute and try again.")

@crewai_tool("DuckDuckGo Web Search")
def web_search(query: str) -> str:
    """Search the live internet using DuckDuckGo.
    Use this to find the latest news and trending topics about any subject."""
    print(f"\n🔍 [Tool: DuckDuckGo] Searching: \"{query}\"")
    try:
        result = _ddg_search.run(query)
        # Truncate to save tokens and prevent TPM limit triggers
        truncated = result[:1000] if result else ""
        print(f"✅ Search complete — {len(truncated)} chars returned (truncated to save tokens)")
        return truncated
    except Exception as e:
        return f"Search failed: {str(e)}"

# ═══════════════════════════════════════════════════════
#   HELPER: JSON Extractor
# ═══════════════════════════════════════════════════════
def extract_json(text):
    if not text:
        return None
    try:
        return json.loads(text.strip())
    except Exception:
        pass
    stripped = re.sub(r'^```(?:json)?\s*', '', text.strip())
    stripped = re.sub(r'\s*```\s*$', '', stripped).strip()
    try:
        return json.loads(stripped)
    except Exception:
        pass
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None

# ═══════════════════════════════════════════════════════
#   SELF-CORRECTION LOOP — Twitter 280 char check
# ═══════════════════════════════════════════════════════
def self_correct_twitter(posts):
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage

    corrector = ChatGroq(
        model=GROQ_MODEL,
        api_key=os.getenv("GROQ_API_KEY"),
        max_tokens=300,
        max_retries=5
    )

    print(f"\n🔁 SELF-CORRECTION LOOP — Twitter 280 char check...")
    corrected = []

    for i, post in enumerate(posts):
        post = dict(post)
        twitter = post.get("twitter", "")

        if not twitter or len(twitter) <= 280:
            print(f"✅ Post {i+1} Twitter OK — {len(twitter)} chars")
            corrected.append(post)
            continue

        print(f"⚠️  Post {i+1} Twitter = {len(twitter)} chars — rewriting...")
        response = corrector.invoke([
            SystemMessage(content="You rewrite tweets under 280 characters. Return ONLY the tweet text, nothing else."),
            HumanMessage(content=f"Rewrite this tweet to be under 280 chars. Keep it punchy.\n\nOriginal ({len(twitter)} chars):\n{twitter}\n\nReturn ONLY the new tweet:")
        ])
        rewritten = response.content.strip()
        post["twitter"] = rewritten if len(rewritten) <= 280 else rewritten[:277] + "…"
        print(f"✅ Post {i+1} Twitter rewritten — {len(post['twitter'])} chars")
        corrected.append(post)

    return corrected

# ═══════════════════════════════════════════════════════
#   FALLBACK DATA
# ═══════════════════════════════════════════════════════
def get_fallback_stories(topic):
    return [
        {
            "headline": f"{topic} Market Reaches Record Milestone in 2025",
            "source": "Reuters",
            "summary": f"The {topic} industry crossed a major milestone with record investments and consumer adoption.",
            "bullets": ["Investment up 300% YoY", "Consumer adoption at all-time high", "New regulations expected Q3"]
        },
        {
            "headline": f"AI Transforms the {topic} Industry",
            "source": "TechCrunch",
            "summary": f"AI is reshaping the {topic} landscape, forcing companies to adapt.",
            "bullets": ["70% of companies now use AI", "40% productivity gains reported", "Job market shifting fast"]
        },
        {
            "headline": f"Top {topic} Trends Every Professional Must Know",
            "source": "Forbes",
            "summary": f"Industry experts share top predictions for {topic} in the coming year.",
            "bullets": ["Sustainability top priority", "New leaders emerging globally", "Consumer behavior shifting"]
        }
    ]

# ═══════════════════════════════════════════════════════
#   TOPIC ANALYZER
#   Step 1: DuckDuckGo search karo
#   Step 2: LLM classify (INDUSTRY / FAMOUS_PERSON / UNKNOWN_PERSON)
#   Step 3: For persons only — count check to catch unknown names
# ═══════════════════════════════════════════════════════
def analyze_topic(topic):
    """
    Returns: (topic_type, has_real_news, search_results)
    topic_type  : 'FAMOUS_PERSON' | 'UNKNOWN_PERSON' | 'INDUSTRY'
    has_real_news: True/False
    search_results: raw DuckDuckGo text
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage

    # Step 1: Real DuckDuckGo search
    print(f"\n🔍 [Analyzer] Pre-searching DuckDuckGo for: '{topic}'...")
    search_results = ""
    try:
        search_results = _ddg_search.run(f"{topic} latest news 2025")
        print(f"✅ Pre-search: {len(search_results)} chars returned")
    except Exception as e:
        print(f"⚠️  Pre-search failed: {e}")

    # Count how many times the exact topic phrase appears in search results
    topic_lower = topic.lower()
    results_lower = search_results.lower() if search_results else ""
    mention_count = results_lower.count(topic_lower)
    print(f"📊 Topic mention count in results: {mention_count}")

    # Use a direct REST call to Groq API to avoid reasoning_format issues in langchain-groq library
    import requests
    api_key = os.getenv("GROQ_API_KEY")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You classify topics. Reply with EXACTLY 2 tokens separated by comma. No explanation."
            },
            {
                "role": "user",
                "content": f"""Topic: "{topic}"
DuckDuckGo search results (first 500 chars):
{search_results[:500] if search_results else 'No results found'}

The exact phrase "{topic}" appears {mention_count} time(s) in the search results.

Q1: What TYPE is "{topic}"?
- INDUSTRY = business sector, technology field, or general subject (examples: "Gaming Tech", "Sustainable Fashion", "AI & Machine Learning", "Electric Vehicles", "Crypto", "Space Exploration", "Climate Change")
- FAMOUS_PERSON = a globally famous individual covered by major world media (examples: "Elon Musk", "Taylor Swift", "Barack Obama", "Cristiano Ronaldo")
- UNKNOWN_PERSON = a human name that is NOT globally famous (no Wikipedia page, no major news coverage)

IMPORTANT: "Sustainable Fashion", "Gaming Tech", "Electric Vehicles" are INDUSTRY topics, NOT persons.

Q2: Do search results contain real news specifically about "{topic}"?
- YES = search results clearly discuss "{topic}"
- NO = results are empty or unrelated

Reply format: TYPE,NEWS
Examples: INDUSTRY,YES or FAMOUS_PERSON,YES or UNKNOWN_PERSON,NO"""
            }
        ],
        "temperature": 0.0,
        "max_tokens": 10
    }

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=10)
        res_json = res.json()
        content = res_json["choices"][0]["message"]["content"]
        raw = content.strip().upper().replace(" ", "")
        parts = raw.split(",")


        # Parse topic_type
        if len(parts) >= 1:
            if "FAMOUS" in parts[0]:
                topic_type = "FAMOUS_PERSON"
            elif "UNKNOWN" in parts[0]:
                topic_type = "UNKNOWN_PERSON"
            else:
                topic_type = "INDUSTRY"
        else:
            topic_type = "INDUSTRY"

        # Parse has_real_news
        has_real_news = len(parts) >= 2 and "YES" in parts[1]

        # Safety net: if LLM says FAMOUS_PERSON but topic never appears in search → unknown
        # ONLY apply if the search was successful and returned actual content
        search_successful = search_results and "ratelimit" not in search_results.lower() and len(search_results.strip()) > 50
        if topic_type == "FAMOUS_PERSON" and mention_count == 0 and search_successful:
            print(f"⚠️  Safety net: LLM said FAMOUS_PERSON but '{topic}' has 0 mentions → UNKNOWN_PERSON")
            topic_type = "UNKNOWN_PERSON"
            has_real_news = False

        print(f"✅ Analysis: type={topic_type}, has_news={has_real_news}, mentions={mention_count}")
        return topic_type, has_real_news, search_results


    except Exception as e:
        print(f"⚠️  Analyzer error: {e} — defaulting to INDUSTRY/True")
        return "INDUSTRY", True, search_results



# ═══════════════════════════════════════════════════════
#   API ROUTE: /api/pipeline  (CrewAI multi-agent)
# ═══════════════════════════════════════════════════════
@app.route('/api/pipeline', methods=['POST'])
def pipeline():
    data = request.get_json()
    topic = data.get('topic', '')
    print(f"\n🚀 CREWAI PIPELINE STARTED: \"{topic}\"")

    try:
        # ── STEP 0: Analyze topic + pre-search ─────────────────────
        topic_type, has_real_news, pre_search = analyze_topic(topic)

        # Block if: unknown person name OR person with no real news
        if topic_type == "UNKNOWN_PERSON" or (topic_type == "FAMOUS_PERSON" and not has_real_news):
            print(f"⚠️  Blocked: type={topic_type}, has_news={has_real_news}")
            return jsonify({
                "error": f"No public news found for '{topic}'. Please try an industry topic like 'Gaming Tech' or a well-known public figure like 'Elon Musk'.",
                "error_type": "unknown_person"
            }), 400

        is_person = (topic_type == "FAMOUS_PERSON")
        print(f"{'👤 Person mode' if is_person else '🏢 Industry mode'}: Proceeding with \"{topic}\"")

        # ── AGENT 1: Trend Scout ──────────────────────────
        scout_goal = (
            f"Find 3 real recent news stories about the public figure '{topic}' from the live internet"
            if is_person else
            f"Find 3 real trending news stories about '{topic}' from the live internet"
        )
        trend_scout = Agent(
            role="Trend Scout",
            goal=scout_goal,
            backstory="""You are an expert research agent. You use DuckDuckGo search
            to scan the live internet for real, current trending news stories.
            You always find accurate, up-to-date information and present it clearly.""",
            tools=[web_search],
            llm=llm,
            verbose=True,
            allow_delegation=False,
            max_iter=1
        )

        # ── AGENT 2: Content Creator ──────────────────────
        creator_goal = (
            "Transform news stories about this public figure into viral social media posts"
            if is_person else
            "Transform industry news stories into viral social media posts for LinkedIn, Twitter/X, and Instagram"
        )
        content_creator = Agent(
            role="Social Media Content Creator",
            goal=creator_goal,
            backstory="""You are an expert viral content creator who writes platform-perfect posts.
            You write professional content for LinkedIn, punchy posts for Twitter 
            (always strictly under 280 characters), and engaging captions for Instagram.""",
            llm=llm,
            verbose=True,
            allow_delegation=False,
            max_iter=1 # Limit to 1 iteration to prevent rate limits
        )

        # ── TASK 1: Scout searches live web ───────────────
        scout_task = Task(
            description=f"""Use the DuckDuckGo Web Search tool to search for: "{topic} latest news 2025"
            
            Find 3 real trending news stories about "{topic}".
            
            Return ONLY this exact JSON (no markdown, no explanation):
            {{"stories":[
              {{"headline":"real headline from search","source":"publication name","summary":"2-3 sentence summary","bullets":["fact 1","fact 2","fact 3"]}},
              {{"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}},
              {{"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}}
            ]}}""",
            agent=trend_scout,
            expected_output="JSON object with 3 trending news stories"
        )
        # ── TASK 2: Creator writes posts (description updated dynamically later) ──
        creator_task = Task(
            description="",
            agent=content_creator,
            expected_output="JSON with LinkedIn, Twitter, Instagram posts for all 3 stories"
        )

        # ── RUN AGENT 1 (Trend Scout) ────────────────────────
        crew_scout = Crew(
            agents=[trend_scout],
            tasks=[scout_task],
            verbose=True
        )

        print(f"\n{'═'*52}")
        print(f"🤖 AGENT 1 KICKOFF — Trend Scout [DuckDuckGo + Groq]")
        print(f"{'═'*52}\n")

        # Sleep to separate Classifier call tokens from Agent 1 call tokens
        print("⏳ Sleeping 5 seconds before launching Trend Scout...")
        time.sleep(5)

        kickoff_with_retry(crew_scout)

        # Parse Scout output
        scout_raw = scout_task.output.raw if scout_task.output else ""
        scout_json = extract_json(scout_raw)
        stories = scout_json.get("stories", []) if scout_json else []

        # If agent failed to return valid stories, or returned "No results available" placeholders
        has_placeholders = any("no results" in str(s.get('headline', '')).lower() or "no trending" in str(s.get('headline', '')).lower() for s in stories)
        if not stories or has_placeholders:
            print("⚠️ No valid stories found or contains rate limit placeholders. Using fallback stories.")
            stories = get_fallback_stories(topic)
            scout_raw = json.dumps({"stories": stories})

        print(f"✅ Scout done — {len(stories)} stories extracted")



        # ── SLEEP 5 SECONDS BETWEEN AGENTS ───────────────────
        print(f"\n⏳ Sleeping 5 seconds between agents...")
        time.sleep(5)

        # ── RUN AGENT 2 (Content Creator) ────────────────────
        if is_person:
            creator_desc = f"""Using these 3 news stories about the public figure "{topic}":
            
            {scout_raw}

            Write 3 platform-specific posts for EACH story:

            LINKEDIN (Professional):
            - Reference {topic} directly, authoritative tone, 120-200 words
            - Structure: Hook about {topic} → Key facts → Why it matters → CTA
            - End with 3 relevant hashtags including #{topic.replace(' ', '')}

            TWITTER/X (Punchy):
            - Bold and direct, mention {topic} by name
            - STRICTLY under 280 characters total
            - 1-2 emojis, 1-2 hashtags

            INSTAGRAM (Visual):
            - Casual, engaging, reference {topic} personally
            - 80-120 words with line breaks
            - End with 6 hashtags

            Return ONLY this exact JSON (no markdown):
            {{"posts":[
              {{"story_index":0,"linkedin":"...","twitter":"...","instagram":"..."}},
              {{"story_index":1,"linkedin":"...","twitter":"...","instagram":"..."}},
              {{"story_index":2,"linkedin":"...","twitter":"...","instagram":"..."}}
            ]}}"""
        else:
            creator_desc = f"""Using these 3 news stories about "{topic}":
            
            {scout_raw}

            Write 3 platform-specific posts for EACH story:

            LINKEDIN (Professional):
            - Authoritative tone, 120-200 words
            - Structure: Hook → Facts → Insight → CTA
            - End with 3 relevant hashtags

            TWITTER/X (Punchy):
            - Bold and direct tone
            - STRICTLY under 280 characters total
            - 1-2 emojis, 1-2 hashtags

            INSTAGRAM (Visual):
            - Casual, emotional, relatable tone
            - 80-120 words with line breaks
            - End with 6 hashtags

            Return ONLY this exact JSON (no markdown):
            {{"posts":[
              {{"story_index":0,"linkedin":"full linkedin post...","twitter":"tweet under 280 chars","instagram":"instagram caption..."}},
              {{"story_index":1,"linkedin":"...","twitter":"...","instagram":"..."}},
              {{"story_index":2,"linkedin":"...","twitter":"...","instagram":"..."}}
            ]}}"""

        creator_task.description = creator_desc

        crew_creator = Crew(
            agents=[content_creator],
            tasks=[creator_task],
            verbose=True
        )

        print(f"\n{'═'*52}")
        print(f"🤖 AGENT 2 KICKOFF — Content Creator [Groq Llama 3.1]")
        print(f"{'═'*52}\n")

        kickoff_with_retry(crew_creator)

        # ── Parse Creator output ──────────────────────────
        creator_raw = creator_task.output.raw if creator_task.output else ""
        creator_json = extract_json(creator_raw)
        posts = creator_json.get("posts", []) if creator_json else []

        if not posts:
            posts = [
                {
                    "story_index": i,
                    "linkedin": f"{s['headline']}\n\n{s['summary']}\n\n{'. '.join(s['bullets'])}.\n\n#{topic.replace(' ','')} #Innovation #Industry2025",
                    "twitter": f"🔥 {s['headline'][:220]} #{topic.replace(' ','')}",
                    "instagram": f"✨ Big news in {topic}!\n\n{s['headline']}\n\n{s['summary']}\n\n#{topic.replace(' ','')} #Trending #2025"
                }
                for i, s in enumerate(stories)
            ]

        # ── Self-Correction Loop ──────────────────────────
        posts = self_correct_twitter(posts)

        print(f"\n🎉 CREWAI PIPELINE COMPLETE — {len(stories)} stories, {len(posts)} posts")
        return jsonify({"success": True, "stories": stories, "posts": posts})

    except Exception as error:
        print(f"❌ Pipeline error: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(error)}), 500


# ═══════════════════════════════════════════════════════
#   API ROUTE: /api/save  (Approve & Save button)
# ═══════════════════════════════════════════════════════
@app.route('/api/save', methods=['POST'])
def save_post():
    data = request.get_json()
    filepath = os.path.join(os.path.dirname(__file__), 'approved_posts.txt')

    entry = f"""
{'='*50}
APPROVED POST — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{'='*50}
Topic    : {data.get('topic', 'N/A')}
Story #  : {data.get('storyIdx', 0) + 1}
Platform : {data.get('platform', 'N/A')}
{'─'*50}
{data.get('text', '')}
{'='*50}
"""
    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(entry)

    print(f"💾 Post saved to approved_posts.txt")
    return jsonify({"success": True, "message": "Post saved to approved_posts.txt"})


if __name__ == '__main__':
    print('\n✅ CrewAI Server running on port 5000')
    print('🤖 Framework  : CrewAI (multi-agent roles)')
    print('🔍 Agent 1    : Trend Scout    (DuckDuckGo Search + Llama 3.3 70B)')
    print('✍️  Agent 2    : Content Creator (Llama 3.3 70B)')
    print('🔁 Correction : Twitter 280-char self-correction active')
    print('💾 Save       : approved_posts.txt\n')
    app.run(port=5000, debug=False)
