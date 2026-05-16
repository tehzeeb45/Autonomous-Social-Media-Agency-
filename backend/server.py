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
from langchain_groq import ChatGroq
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.messages import SystemMessage, HumanMessage

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

# ═══════════════════════════════════════════════════════
#   LLM & TOOLS SETUP
# ═══════════════════════════════════════════════════════
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=2000
)

search_tool = DuckDuckGoSearchRun()

# ═══════════════════════════════════════════════════════
#   HELPER: JSON Extractor
# ═══════════════════════════════════════════════════════
def extract_json(text):
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
#   AGENT 1: TREND SCOUT
#   Tool: DuckDuckGo Search (FREE, live web)
# ═══════════════════════════════════════════════════════
class TrendScoutAgent:
    def __init__(self):
        self.name = "Trend Scout"
        self.goal = "Find 3 trending news stories"

    def search_web(self, topic):
        """Tool: DuckDuckGo live web search"""
        print(f"🔍 [Trend Scout] DuckDuckGo search: \"{topic}\"")
        results = search_tool.run(f"{topic} latest news 2025")
        print(f"✅ Got search results ({len(results)} chars)")
        return results

    def summarize_to_stories(self, topic, search_results):
        """Use LLM to convert search results into structured stories"""
        print(f"🧠 [Trend Scout] Converting results to stories...")
        response = llm.invoke([
            SystemMessage(content="""You are a Trend Scout AI. Convert search results into story summaries.
Return ONLY raw JSON, no markdown, no explanation."""),
            HumanMessage(content=f"""Based on these live search results about "{topic}", create 3 trending news stories:

{search_results}

Return ONLY this JSON:
{{"stories":[
  {{"headline":"specific headline","source":"real publication name","summary":"2-3 sentence summary","bullets":["fact 1","fact 2","fact 3"]}},
  {{"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}},
  {{"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}}
]}}""")
        ])
        return response.content

    def run(self, topic):
        print(f"\n{'═' * 50}")
        print(f"🤖 AGENT: {self.name}")
        print(f"🎯 GOAL : {self.goal}")
        print(f"{'═' * 50}")

        try:
            results = self.search_web(topic)
            stories_raw = self.summarize_to_stories(topic, results)
        except Exception as err:
            print(f"⚠️  Search failed: {err}")
            print(f"🔄 Using LLM fallback...")
            response = llm.invoke([
                SystemMessage(content="""You are a Trend Scout AI. Return ONLY raw JSON, no markdown."""),
                HumanMessage(content=f"""Generate 3 realistic trending news stories about "{topic}" from 2025.
Return ONLY this JSON:
{{"stories":[
  {{"headline":"specific headline","source":"real publication name","summary":"2-3 sentence summary","bullets":["fact 1","fact 2","fact 3"]}},
  {{"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}},
  {{"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}}
]}}""")
            ])
            stories_raw = response.content

        return stories_raw

# ═══════════════════════════════════════════════════════
#   AGENT 2: CONTENT CREATOR
#   Self-Correction: Twitter 280 char check
# ═══════════════════════════════════════════════════════
class ContentCreatorAgent:
    def __init__(self):
        self.name = "Content Creator"
        self.goal = "Turn news into viral social media content"
        self.max_char = 280

    def write_posts(self, topic, stories):
        print(f"\n{'═' * 50}")
        print(f"🤖 AGENT: {self.name}")
        print(f"🎯 GOAL : {self.goal}")
        print(f"{'═' * 50}")
        print("📝 Writing LinkedIn posts...")
        print("⚡ Writing Twitter posts...")
        print("📸 Writing Instagram captions...")

        story_details = "\n\n".join([
            f"""STORY {i+1}:
Headline : {s['headline']}
Source   : {s['source']}
Summary  : {s['summary']}
Key Facts: {' | '.join(s['bullets'])}"""
            for i, s in enumerate(stories)
        ])

        response = llm.invoke([
            SystemMessage(content="""You are an expert viral social media Content Creator agent.
Rewrite news stories into 3 platform-specific styles:

LINKEDIN (Professional):
- Tone: Authoritative, insightful
- Length: 120-200 words
- Structure: Hook → Facts → Insight → CTA
- End with 3 hashtags

TWITTER/X (Punchy):
- Tone: Bold, direct
- STRICTLY under 280 characters total
- 1-2 emojis, 1-2 hashtags

INSTAGRAM (Visual):
- Tone: Casual, emotional, relatable
- 80-120 words with line breaks
- End with 6 hashtags

Return ONLY raw JSON, zero markdown."""),
            HumanMessage(content=f"""Write viral social media posts for these "{topic}" stories:

{story_details}

Return ONLY this JSON:
{{"posts":[
  {{"story_index":0,"linkedin":"...","twitter":"...","instagram":"..."}},
  {{"story_index":1,"linkedin":"...","twitter":"...","instagram":"..."}},
  {{"story_index":2,"linkedin":"...","twitter":"...","instagram":"..."}}
]}}""")
        ])
        return response.content

    def self_correct(self, posts, stories):
        print(f"\n🔁 SELF-CORRECTION LOOP — Twitter 280 char check...")
        corrected = []

        for i, post in enumerate(posts):
            post = dict(post)
            twitter = post.get("twitter", "")

            if not twitter or len(twitter) <= self.max_char:
                print(f"✅ Post {i+1} Twitter OK — {len(twitter)} chars")
                corrected.append(post)
                continue

            print(f"⚠️  Post {i+1} Twitter = {len(twitter)} chars — rewriting...")
            response = llm.invoke([
                SystemMessage(content="You rewrite tweets to be under 280 characters. Return ONLY the tweet text."),
                HumanMessage(content=f"""Rewrite to under 280 chars about: "{stories[i].get('headline','')}"
Original ({len(twitter)} chars): {twitter}
Return ONLY the new tweet:""")
            ])

            rewritten = response.content.strip()
            post["twitter"] = rewritten if len(rewritten) <= 280 else rewritten[:277] + "…"
            print(f"✅ Post {i+1} Twitter rewritten — {len(post['twitter'])} chars")
            corrected.append(post)

        return corrected

    def run(self, topic, stories):
        return self.write_posts(topic, stories)

# ═══════════════════════════════════════════════════════
#   FALLBACK STORIES
# ═══════════════════════════════════════════════════════
def get_fallback_stories(topic):
    return [
        {
            "headline": f"{topic} Market Reaches $100B Milestone in 2025",
            "source": "Reuters",
            "summary": f"The {topic} industry has crossed a major milestone with record investments.",
            "bullets": ["Investment up 300% YoY", "Consumer adoption at all-time high", "New regulations expected in Q3"]
        },
        {
            "headline": f"AI Integration Transforms {topic} Industry",
            "source": "TechCrunch",
            "summary": f"AI is reshaping every corner of the {topic} landscape.",
            "bullets": ["70% of companies now use AI tools", "Productivity gains of 40%", "Job market shifting rapidly"]
        },
        {
            "headline": f"Top {topic} Trends Every Professional Must Know",
            "source": "Forbes",
            "summary": f"Industry experts share their top predictions for {topic}.",
            "bullets": ["Sustainability now a top priority", "New leaders emerging globally", "Consumer behavior shifting"]
        }
    ]

# ═══════════════════════════════════════════════════════
#   API ROUTES
# ═══════════════════════════════════════════════════════
@app.route('/api/pipeline', methods=['POST'])
def pipeline():
    data = request.get_json()
    topic = data.get('topic', '')
    print(f"\n🚀 PIPELINE STARTED: \"{topic}\"")

    try:
        # Agent 1: Trend Scout
        scout = TrendScoutAgent()
        stories_raw = scout.run(topic)

        scout_json = extract_json(stories_raw)
        stories = scout_json.get("stories", []) if scout_json else []

        if not stories:
            print("⚠️  Using fallback stories")
            stories = get_fallback_stories(topic)

        print(f"✅ Scout done — {len(stories)} stories")

        # Agent 2: Content Creator
        creator = ContentCreatorAgent()
        posts_raw = creator.run(topic, stories)

        creator_json = extract_json(posts_raw)
        posts = creator_json.get("posts", []) if creator_json else []

        if not posts:
            posts = [
                {
                    "story_index": i,
                    "linkedin": f"{s['headline']}\n\n{s['summary']}\n\n{'. '.join(s['bullets'])}.\n\n#{topic.replace(' ','')} #Innovation",
                    "twitter": f"🔥 {s['headline'][:220]} #{topic.replace(' ','')}",
                    "instagram": f"✨ Big news in {topic}!\n\n{s['headline']}\n\n{s['summary']}\n\n#{topic.replace(' ','')} #Trending"
                }
                for i, s in enumerate(stories)
            ]

        # Self-Correction
        posts = creator.self_correct(posts, stories)

        print(f"\n🎉 PIPELINE COMPLETE")
        return jsonify({"success": True, "stories": stories, "posts": posts})

    except Exception as error:
        print(f"❌ Pipeline error: {error}")
        return jsonify({"error": str(error)}), 500


@app.route('/api/save', methods=['POST'])
def save_post():
    """Save approved post to text file"""
    data = request.get_json()
    filepath = os.path.join(os.path.dirname(__file__), 'approved_posts.txt')

    entry = f"""
{'=' * 50}
APPROVED POST — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{'=' * 50}
Topic    : {data.get('topic', 'N/A')}
Story #  : {data.get('storyIdx', 0) + 1}
Platform : {data.get('platform', 'N/A')}
{'─' * 50}
{data.get('text', '')}
{'=' * 50}
"""

    with open(filepath, 'a', encoding='utf-8') as f:
        f.write(entry)

    print(f"💾 Post saved to approved_posts.txt")
    return jsonify({"success": True, "message": "Post saved to approved_posts.txt"})


if __name__ == '__main__':
    print('\n✅ Server running on port 5000')
    print('🔍 Agent 1: Trend Scout    (DuckDuckGo Search + Groq Llama 3.3)')
    print('✍️  Agent 2: Content Creator (Groq Llama 3.3)')
    print('🔁 Self-Correction: Twitter 280-char active\n')
    app.run(port=5000, debug=False)
