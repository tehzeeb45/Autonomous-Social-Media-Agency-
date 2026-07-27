const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { search } = require('duck-duck-scrape');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// ═══════════════════════════════════════════════════════
//   HELPER: JSON Extractor
// ═══════════════════════════════════════════════════════
function extractJSON(text) {
  try { return JSON.parse(text.trim()); } catch {}
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try { return JSON.parse(stripped); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

// ═══════════════════════════════════════════════════════
//   HELPER: Groq API Call (free, fast LLM)
// ═══════════════════════════════════════════════════════
async function callLLM(systemPrompt, userPrompt, maxTokens = 2000) {
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content;
}

// ═══════════════════════════════════════════════════════
//   AGENT 1: TREND SCOUT
//   Tool: DuckDuckGo Search (real live web search)
// ═══════════════════════════════════════════════════════
class TrendScoutAgent {
  constructor() {
    this.name = "Trend Scout";
    this.goal = "Find 3 trending news stories from live internet";
  }

  // 🔍 TOOL: Real DuckDuckGo web search
  async searchWeb(topic) {
    console.log(`🔍 [Trend Scout] DuckDuckGo search: "${topic} latest news 2025"...`);
    try {
      const results = await search(`${topic} latest news 2025`, { safeSearch: 'OFF' });
      const snippets = results.results
        .slice(0, 8)
        .map((r, i) => `[${i + 1}] ${r.title}\nSource: ${r.url}\n${r.description}`)
        .join('\n\n');
      console.log(`✅ Got ${results.results.length} search results from DuckDuckGo`);
      return snippets;
    } catch (err) {
      console.log(`⚠️  DuckDuckGo search failed: ${err.message}`);
      return null;
    }
  }

  async findStories(topic) {
    // Step 1: Real live web search
    const searchResults = await this.searchWeb(topic);

    // Step 2: LLM extracts structured stories from real results
    console.log(`🧠 [Trend Scout] LLM extracting stories from search results...`);

    const userPrompt = searchResults
      ? `Based on these LIVE search results about "${topic}", extract 3 trending news stories:\n\n${searchResults}\n\nReturn ONLY this JSON:\n{"stories":[\n  {"headline":"exact headline from results","source":"real publication name","summary":"2-3 sentence summary","bullets":["fact 1","fact 2","fact 3"]},\n  {"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]},\n  {"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}\n]}`
      : `Generate 3 realistic trending news stories about "${topic}" from 2025.\nReturn ONLY this JSON:\n{"stories":[\n  {"headline":"specific headline","source":"real publication name","summary":"2-3 sentence summary","bullets":["fact 1","fact 2","fact 3"]},\n  {"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]},\n  {"headline":"...","source":"...","summary":"...","bullets":["...","...","..."]}\n]}`;

    const raw = await callLLM(
      `You are a Trend Scout AI. Extract trending stories from search results and return ONLY raw JSON, no markdown.`,
      userPrompt,
      1500
    );
    return raw;
  }

  async run(topic) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🤖 AGENT: ${this.name}`);
    console.log(`🎯 GOAL : ${this.goal}`);
    console.log(`🛠  TOOL : DuckDuckGo Search`);
    console.log(`${'═'.repeat(50)}`);
    return await this.findStories(topic);
  }
}

// ═══════════════════════════════════════════════════════
//   AGENT 2: CONTENT CREATOR
//   Goal: Turn stories into viral posts (3 styles)
//   Self-Correction: Twitter 280 char check + rewrite
// ═══════════════════════════════════════════════════════
class ContentCreatorAgent {
  constructor() {
    this.name    = "Content Creator";
    this.goal    = "Turn news into viral social media content";
    this.maxChar = 280;
  }

  async writePosts(topic, stories) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🤖 AGENT: ${this.name}`);
    console.log(`🎯 GOAL : ${this.goal}`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`📝 Writing LinkedIn posts...`);
    console.log(`⚡ Writing Twitter posts...`);
    console.log(`📸 Writing Instagram captions...`);

    const storyDetails = stories.map((s, i) =>
      `STORY ${i+1}:
Headline : ${s.headline}
Source   : ${s.source}
Summary  : ${s.summary}
Key Facts: ${s.bullets.join(' | ')}`
    ).join('\n\n');

    const raw = await callLLM(
      `You are an expert viral social media Content Creator agent.
Rewrite news stories into 3 platform-specific styles:

LINKEDIN (Professional):
- Tone: Authoritative, insightful
- Length: 120-200 words
- Structure: Hook → Facts → Insight → CTA
- End with 3 hashtags
- Use actual facts from the story

TWITTER/X (Punchy):
- Tone: Bold, direct
- STRICTLY under 280 characters total
- 1-2 emojis, 1-2 hashtags
- Based on the specific story

INSTAGRAM (Visual):
- Tone: Casual, emotional, relatable
- 80-120 words with line breaks
- End with 6 hashtags

Return ONLY raw JSON, zero markdown.`,
      `Write viral social media posts for these "${topic}" stories:

${storyDetails}

Return ONLY this JSON:
{"posts":[
  {"story_index":0,"linkedin":"...","twitter":"...","instagram":"..."},
  {"story_index":1,"linkedin":"...","twitter":"...","instagram":"..."},
  {"story_index":2,"linkedin":"...","twitter":"...","instagram":"..."}
]}`,
      3000
    );
    return raw;
  }

  async selfCorrect(posts, stories) {
    console.log(`\n🔁 SELF-CORRECTION LOOP — Twitter 280 char check...`);
    const corrected = [];

    for (let i = 0; i < posts.length; i++) {
      const post = { ...posts[i] };

      if (!post.twitter || post.twitter.length <= this.maxChar) {
        console.log(`✅ Post ${i+1} Twitter OK — ${post.twitter?.length || 0} chars`);
        corrected.push(post);
        continue;
      }

      console.log(`⚠️  Post ${i+1} Twitter = ${post.twitter.length} chars — rewriting...`);
      const rewritten = await callLLM(
        `You rewrite tweets to be under 280 characters. Return ONLY the tweet text, nothing else.`,
        `Rewrite this tweet to be under 280 characters. Keep it punchy about: "${stories[i]?.headline}"

Original (${post.twitter.length} chars):
${post.twitter}

Return ONLY the new tweet:`,
        150
      );

      post.twitter = rewritten.trim().length <= 280
        ? rewritten.trim()
        : rewritten.trim().slice(0, 277) + "…";

      console.log(`✅ Post ${i+1} Twitter rewritten — ${post.twitter.length} chars`);
      corrected.push(post);
    }

    return corrected;
  }

  async run(topic, stories) {
    const postsRaw = await this.writePosts(topic, stories);
    return postsRaw;
  }
}

// ═══════════════════════════════════════════════════════
//   MAIN PIPELINE
// ═══════════════════════════════════════════════════════
app.post('/api/pipeline', async (req, res) => {
  const { topic } = req.body;
  console.log(`\n🚀 PIPELINE STARTED: "${topic}"`);

  try {
    // ── Agent 1: Trend Scout ──
    const scoutAgent = new TrendScoutAgent();
    const storiesRaw = await scoutAgent.run(topic);

    const scoutJSON = extractJSON(storiesRaw);
    let stories = scoutJSON?.stories || [];

    if (!stories.length) {
      console.log('⚠️  Using hardcoded fallback stories');
      stories = [
        {
          headline: `${topic} Market Reaches $100B Milestone in 2025`,
          source: "Reuters",
          summary: `The ${topic} industry has crossed a major milestone with record investments and consumer adoption reaching all-time highs.`,
          bullets: ["Investment up 300% year over year", "Consumer adoption at all-time high", "New regulations expected in Q3"]
        },
        {
          headline: `AI Integration Transforms ${topic} Industry`,
          source: "TechCrunch",
          summary: `Artificial intelligence is reshaping every corner of the ${topic} landscape, forcing companies to adapt or fall behind.`,
          bullets: ["70% of companies now use AI tools", "Productivity gains of 40% reported", "Job market shifting rapidly"]
        },
        {
          headline: `Top ${topic} Trends Every Professional Must Know`,
          source: "Forbes",
          summary: `Industry experts share their top predictions for ${topic} in the coming year, highlighting key opportunities and risks.`,
          bullets: ["Sustainability now a top priority", "New leaders emerging globally", "Consumer behavior shifting dramatically"]
        }
      ];
    }

    console.log(`✅ Scout done — ${stories.length} stories`);

    // ── Agent 2: Content Creator ──
    const creatorAgent = new ContentCreatorAgent();
    const postsRaw = await creatorAgent.run(topic, stories);

    const creatorJSON = extractJSON(postsRaw);
    let posts = creatorJSON?.posts || [];

    if (!posts.length) {
      posts = stories.map((s, i) => ({
        story_index: i,
        linkedin: `${s.headline}\n\n${s.summary}\n\n${s.bullets.join('. ')}.\n\nThe ${topic} space is evolving fast — are you keeping up?\n\n#${topic.replace(/\s+/g,"")} #Innovation #Industry2025`,
        twitter: `🔥 ${s.headline.slice(0, 220)} #${topic.replace(/\s+/g,"")}`.slice(0, 280),
        instagram: `✨ Big news in ${topic}!\n\n${s.headline}\n\n${s.summary}\n\nDrop a 🔥 if you're following this!\n\n#${topic.replace(/\s+/g,"")} #Trending #2025 #MustKnow #Innovation #Breaking`
      }));
    }

    // ── Self-Correction ──
    posts = await creatorAgent.selfCorrect(posts, stories);

    console.log(`\n🎉 PIPELINE COMPLETE`);
    res.json({ success: true, stories, posts });

  } catch (error) {
    console.error('❌ Pipeline error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════
//   SAVE APPROVED POST
// ═══════════════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');

app.post('/api/save', (req, res) => {
  const { topic, storyIdx, platform, text, at } = req.body;
  const filepath = path.join(__dirname, 'approved_posts.txt');

  const line = [
    '',
    '==================================================',
    `APPROVED POST — ${new Date(at || Date.now()).toLocaleString()}`,
    '==================================================',
    `Topic    : ${topic || 'N/A'}`,
    `Story #  : ${(storyIdx ?? 0) + 1}`,
    `Platform : ${platform || 'N/A'}`,
    '--------------------------------------------------',
    text || '',
    '==================================================',
    '',
  ].join('\n');

  try {
    fs.appendFileSync(filepath, line, 'utf8');
    console.log(`💾 Post saved → approved_posts.txt`);
    res.json({ success: true, message: 'Post saved to approved_posts.txt' });
  } catch (err) {
    console.error('❌ Save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log('\n✅ Server running on port 5000');
  console.log('🔍 Agent 1: Trend Scout    (DuckDuckGo Search + Groq Llama 3.3)');
  console.log('✍️  Agent 2: Content Creator (Groq Llama 3.3 70B)');
  console.log('🔁 Self-Correction: Twitter 280-char active');
  console.log('💾 /api/save → approved_posts.txt\n');
});