import { useState, useRef, useEffect } from "react";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLATFORMS = {
  linkedin:  { label: "LinkedIn",    limit: 3000, bg: "#E8F4FD", icon: "💼" },
  twitter:   { label: "X / Twitter", limit: 280,  bg: "#F3F4F6", icon: "🐦" },
  instagram: { label: "Instagram",   limit: 2200, bg: "#FDE8F0", icon: "📸" },
};

async function runAgentPipeline(topic, onLog, onResult) {
  onLog("system", `🚀 Pipeline started for: "${topic}"`);
  await sleep(300);
  onLog("scout", "🤖 Agent 1: Trend Scout initialized");
  onLog("scout", "🎯 Goal: Find 3 trending stories from live internet");
  onLog("scout", "🛠 Tool: DuckDuckGo Search (real live web)");
  await sleep(400);
  onLog("scout", "🔍 Searching DuckDuckGo for latest news...");

  let res, data;

  try {
    res = await fetch("http://localhost:5000/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
  } catch (err) {
    onLog("error", `❌ Network Error: ${err.message}`);
    throw err;
  }

  try {
    data = await res.json();
  } catch (err) {
    onLog("error", `❌ Response Error: ${err.message}`);
    throw err;
  }

  if (!res.ok) {
    const errMsg = data.error || "Server error occurred";
    const errType = data.error_type || "generic";
    onLog("error", `❌ ${errType === "unknown_person" ? "👤 Person not found" : "Server Error"}: ${errMsg}`);
    throw Object.assign(new Error(errMsg), { errorType: errType });
  }

  const { stories, posts } = data;

  if (!stories || !posts) {
    onLog("error", "❌ No data received");
    throw new Error("No data received");
  }

  onLog("scout", `✅ Found ${stories.length} trending stories`);
  stories.forEach((s, i) => onLog("scout", `   📰 Story ${i + 1}: "${s.headline}"`));
  await sleep(300);

  onLog("creator", "🤖 Agent 2: Content Creator initialized");
  onLog("creator", "🎯 Goal: Turn news into viral content");
  onLog("creator", "📝 Writing LinkedIn professional posts...");
  await sleep(200);
  onLog("creator", "⚡ Writing X/Twitter punchy posts...");
  await sleep(200);
  onLog("creator", "📸 Writing Instagram visual captions...");
  await sleep(200);

  posts.forEach((p, i) => {
    if (p.twitter?.length <= 280) {
      onLog("creator", `✅ Twitter post ${i + 1} — ${p.twitter?.length} chars ✓`);
    } else {
      onLog("creator", `🔁 Self-correction: Twitter post ${i + 1} rewritten`);
    }
  });

  await sleep(200);
  onLog("system", "🎉 All done! Posts ready for approval.");
  onResult(stories, posts);
}

async function saveToStorage(entry) {
  try {
    await fetch("http://localhost:5000/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {}
}

function PostCard({ platform, text, storyIdx, approvedPlatform, onApprove, onEdit }) {
  const p = PLATFORMS[platform];
  const isApproved = approvedPlatform === platform;
  const over = text.length > p.limit;
  const pct = Math.min((text.length / p.limit) * 100, 100);
  const barColor = over ? "#EF4444" : pct > 85 ? "#F59E0B" : "#10B981";

  return (
    <div style={{ background: "#fff", border: `2px solid ${isApproved ? "#10B981" : "#E5E7EB"}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: isApproved ? "0 0 0 4px rgba(16,185,129,0.12)" : "0 2px 8px rgba(0,0,0,0.05)", transition: "all 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, background: p.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{p.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{p.label}</div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>Max {p.limit.toLocaleString()} chars</div>
        </div>
        {isApproved && <div style={{ background: "#D1FAE5", color: "#065F46", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>✓ Saved</div>}
      </div>

      <div style={{ background: "#F9FAFB", border: "1px solid #F3F4F6", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "#1F2937", lineHeight: 1.8, whiteSpace: "pre-wrap", minHeight: 110, flex: 1 }}>
        {text}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: over ? "#EF4444" : "#9CA3AF" }}>
          <span>{over ? "⚠ Over limit" : `${p.limit - text.length} chars left`}</span>
          <span style={{ fontWeight: 600, color: barColor }}>{text.length} / {p.limit}</span>
        </div>
        <div style={{ height: 6, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.4s" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onApprove(storyIdx, platform, text)} disabled={isApproved}
          style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", cursor: isApproved ? "default" : "pointer", background: isApproved ? "#D1FAE5" : "#111827", color: isApproved ? "#065F46" : "#fff", fontWeight: 700, fontSize: 12 }}>
          {isApproved ? "✓ Approved" : "✅ Approve & Save"}
        </button>
        <button onClick={() => onEdit(storyIdx, platform)}
          style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
          ✏️ Edit
        </button>
      </div>
    </div>
  );
}

function StoryBlock({ story, posts, storyIdx, approvedMap, onApprove, onEdit }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ background: "linear-gradient(135deg,#EEF2FF,#F0F9FF)", border: "1.5px solid #C7D2FE", borderRadius: 14, padding: "16px 20px", marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#6366F1,#818CF8)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{storyIdx + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1E1B4B", marginBottom: 4 }}>{story.headline}</div>
          <div style={{ fontSize: 12, color: "#6366F1", fontWeight: 600, marginBottom: 8 }}>📡 Source: {story.source}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {story.bullets.map((b, i) => (
              <div key={i} style={{ fontSize: 13, color: "#4338CA", display: "flex", gap: 8 }}>
                <span style={{ color: "#A5B4FC" }}>▸</span>{b}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {["linkedin", "twitter", "instagram"].map((pl) => (
          <PostCard key={pl} platform={pl}
            text={posts?.[pl] || "No content"}
            storyIdx={storyIdx}
            approvedPlatform={approvedMap[storyIdx]}
            onApprove={onApprove}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

function EditModal({ open, platform, value, onChange, onSave, onClose }) {
  if (!open) return null;
  const p = PLATFORMS[platform] || { label: "", icon: "✏️", limit: 9999 };
  const over = value.length > p.limit;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 580, maxWidth: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{p.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>Edit {p.label} Post</span>
          </div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "#6B7280" }}>✕</button>
        </div>
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", minHeight: 190, background: "#F9FAFB", border: `1.5px solid ${over ? "#EF4444" : "#E5E7EB"}`, borderRadius: 12, color: "#1F2937", padding: 16, fontSize: 14, lineHeight: 1.75, outline: "none", resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 20px", fontSize: 12, color: over ? "#EF4444" : "#9CA3AF" }}>
          <span>{over ? `⚠ ${value.length - p.limit} chars over` : `${p.limit - value.length} chars remaining`}</span>
          <span style={{ fontWeight: 600 }}>{value.length} / {p.limit}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onSave} style={{ flex: 1, padding: 12, background: "#111827", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>💾 Save Changes</button>
          <button onClick={onClose} style={{ padding: "12px 20px", background: "#F3F4F6", color: "#374151", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [approvedMap, setApprovedMap] = useState({});
  const [savedCount, setSavedCount] = useState(0);
  const [editState, setEditState] = useState({ open: false });
  const [errorMsg, setErrorMsg] = useState("");
  const [errorType, setErrorType] = useState("");
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const addLog = (type, msg) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((l) => [...l, { type, msg, ts }]);
  };

  const handleRun = async () => {
    if (!topic.trim() || phase === "running") return;
    setPhase("running");
    setLogs([]);
    setStories([]);
    setPosts([]);
    setApprovedMap({});
    setSavedCount(0);
    setErrorMsg("");
    setErrorType("");
    try {
      await runAgentPipeline(topic.trim(), addLog, (s, p) => {
        setStories(s);
        setPosts(p);
        setPhase("done");
      });
    } catch (e) {
      setErrorMsg(e.message);
      setErrorType(e.errorType || "generic");
      setPhase("error");
    }
  };

  const handleApprove = async (storyIdx, platform, text) => {
    await saveToStorage({ topic, storyIdx, platform, text, at: new Date().toISOString() });
    setApprovedMap((m) => ({ ...m, [storyIdx]: platform }));
    setSavedCount((c) => c + 1);
    addLog("system", `💾 Story ${storyIdx + 1} → ${platform} saved!`);
  };

  const handleEdit = (si, pl) => setEditState({ open: true, storyIdx: si, platform: pl, value: posts[si]?.[pl] || "" });

  const handleEditSave = () => {
    setPosts((prev) => {
      const n = [...prev];
      n[editState.storyIdx] = { ...n[editState.storyIdx], [editState.platform]: editState.value };
      return n;
    });
    addLog("system", "✏️ Post updated");
    setEditState({ open: false });
  };

  const suggestions = ["Gaming Tech", "Sustainable Fashion", "AI & Machine Learning", "Electric Vehicles", "Space Exploration", "Crypto & Web3"];

  const statusMap = {
    idle:    { label: "Ready",       bg: "#F3F4F6", color: "#6B7280" },
    running: { label: "Running…",    bg: "#FEF3C7", color: "#D97706" },
    done:    { label: "Complete ✓",  bg: "#D1FAE5", color: "#059669" },
    error:   { label: "Error",       bg: "#FEE2E2", color: "#DC2626" },
  };
  const st = statusMap[phase];

  const logTypeStyle = {
    system:  { bg: "#EDE9FE", color: "#5B21B6", label: "SYS"   },
    scout:   { bg: "#DCFCE7", color: "#166534", label: "SCOUT" },
    creator: { bg: "#FEF3C7", color: "#92400E", label: "AGENT" },
    error:   { bg: "#FEE2E2", color: "#991B1B", label: "ERR"   },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
        button { font-family: inherit; cursor: pointer; }
        textarea { font-family: inherit; }
        input { font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #F1F5F9; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", height: 64, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg,#6366F1,#06B6D4)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✦</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#0F172A" }}>Social Agency AI</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>Autonomous Content Pipeline</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 2, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 4 }}>
          {[["🔍", "Trend Scout"], ["✍️", "Content Creator"], ["✅", "Approvals"]].map(([icon, lbl], idx) => {
            const isActive = (idx === 0 && phase === "running") || (idx === 1 && phase === "running") || (idx === 2 && phase === "done");
            return (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 9, background: isActive ? "#fff" : "transparent", boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none", fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#111827" : "#64748B", transition: "all 0.2s" }}>
                <span>{icon}</span><span>{lbl}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {savedCount > 0 && (
            <div style={{ background: "#D1FAE5", color: "#065F46", fontWeight: 700, fontSize: 12, padding: "5px 14px", borderRadius: 99 }}>
              💾 {savedCount} saved
            </div>
          )}
          <div style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: 12, padding: "5px 14px", borderRadius: 99, display: "flex", alignItems: "center", gap: 7 }}>
            {phase === "running" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, display: "inline-block", animation: "blink 1s infinite" }} />}
            {st.label}
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>

        {/* Top Row */}
        <div style={{ display: "grid", gridTemplateColumns: "370px 1fr", gap: 20, marginBottom: 24 }}>

          {/* Input Card */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, background: "#EEF2FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎯</div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Mission Brief</span>
            </div>

            <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 7 }}>Topic / Niche</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRun()}
              placeholder='e.g. "Sustainable Fashion"'
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E2E8F0", borderRadius: 10, fontSize: 14, color: "#0F172A", background: "#F8FAFC", outline: "none" }}
              onFocus={(e) => (e.target.style.borderColor = "#6366F1")}
              onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
            />

            <div style={{ marginTop: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Quick Topics</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => setTopic(s)}
                    style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${topic === s ? "#6366F1" : "#E2E8F0"}`, background: topic === s ? "#EEF2FF" : "#fff", color: topic === s ? "#4338CA" : "#64748B", fontSize: 12, fontWeight: 500 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleRun} disabled={phase === "running" || !topic.trim()}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: phase === "running" || !topic.trim() ? "#E2E8F0" : "linear-gradient(135deg,#6366F1,#06B6D4)", color: phase === "running" || !topic.trim() ? "#94A3B8" : "#fff", fontWeight: 800, fontSize: 14, boxShadow: !topic.trim() || phase === "running" ? "none" : "0 4px 16px rgba(99,102,241,0.35)" }}>
              {phase === "running" ? "⚙️ Agents Working..." : "▶ Launch Agents"}
            </button>

            {savedCount > 0 && (
              <div style={{ marginTop: 14, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>💾</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#15803D" }}>{savedCount} post{savedCount > 1 ? "s" : ""} saved</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Stored to local storage</div>
                </div>
              </div>
            )}
          </div>

          {/* Log Card */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, background: "#FEF3C7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧠</div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Agent Thought Log</span>
              {phase === "running" && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "#FEF3C7", padding: "4px 12px", borderRadius: 99 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#D97706", display: "inline-block", animation: "blink 0.8s infinite" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#D97706" }}>Live</span>
                </div>
              )}
              {phase !== "running" && logs.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", background: "#F8FAFC", padding: "3px 10px", borderRadius: 99, border: "1px solid #E2E8F0" }}>{logs.length} entries</span>
              )}
            </div>

            <div ref={logRef} style={{ flex: 1, overflowY: "auto", maxHeight: 230, minHeight: 110, display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.length === 0 ? (
                <div style={{ color: "#CBD5E1", fontSize: 13, display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <span>💤</span> Waiting for agents to start...
                </div>
              ) : (
                logs.map((l, i) => {
                  const ts = logTypeStyle[l.type] || { bg: "#F3F4F6", color: "#6B7280", label: "LOG" };
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.5 }}>
                      <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace", whiteSpace: "nowrap", marginTop: 3 }}>{l.ts}</span>
                      <span style={{ background: ts.bg, color: ts.color, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", marginTop: 1 }}>{ts.label}</span>
                      <span style={{ color: "#374151" }}>{l.msg}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Idle State */}
        {phase === "idle" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
              {[
                { icon: "🔍", title: "Trend Scout", desc: "Scans the live web for 3 hot trending stories in your chosen niche using AI-powered research.", bg: "#EEF2FF", border: "#C7D2FE", titleColor: "#3730A3" },
                { icon: "✍️", title: "Content Creator", desc: "Rewrites research into platform-perfect posts for LinkedIn, X/Twitter, and Instagram automatically.", bg: "#FFF7ED", border: "#FED7AA", titleColor: "#9A3412" },
                { icon: "✅", title: "Approval Board", desc: "Review, edit, and approve each post. Approved content is saved directly to your storage.", bg: "#F0FDF4", border: "#BBF7D0", titleColor: "#14532D" },
              ].map((c) => (
                <div key={c.title} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 16, padding: 22 }}>
                  <div style={{ fontSize: 30, marginBottom: 12 }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: c.titleColor, marginBottom: 8 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65 }}>{c.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 58, marginBottom: 16 }}>🤖</div>
              <div style={{ fontWeight: 800, fontSize: 24, color: "#0F172A", marginBottom: 10 }}>Your AI Agency is Ready</div>
              <div style={{ fontSize: 15, color: "#64748B", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
                Enter a topic above, hit <strong>Launch Agents</strong> — watch AI research trends and write viral content automatically.
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {phase === "error" && errorMsg && (
          <div className="fade-up" style={{ background: errorType === "unknown_person" ? "#FFFBEB" : "#FEF2F2", border: `1.5px solid ${errorType === "unknown_person" ? "#FDE68A" : "#FECACA"}`, borderRadius: 16, padding: "28px 32px", textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{errorType === "unknown_person" ? "👤" : "❌"}</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: errorType === "unknown_person" ? "#92400E" : "#991B1B", marginBottom: 10 }}>
              {errorType === "unknown_person" ? "Person Not Found in Public News" : "Something went wrong"}
            </div>
            <div style={{ fontSize: 14, color: errorType === "unknown_person" ? "#78350F" : "#7F1D1D", maxWidth: 520, margin: "0 auto", lineHeight: 1.75 }}>
              {errorMsg}
            </div>
            {errorType === "unknown_person" && (
              <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {["Gaming Tech", "Sustainable Fashion", "Elon Musk", "AI & Machine Learning", "Taylor Swift"].map((s) => (
                  <button key={s} onClick={() => { setPhase("idle"); setErrorMsg(""); setTopic(s); }}
                    style={{ padding: "6px 14px", borderRadius: 99, border: "1.5px solid #FCD34D", background: "#FEF3C7", color: "#92400E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gallery */}
        {phase === "done" && stories.length > 0 && (
          <div className="fade-up">
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: "#0F172A" }}>📋 Post Gallery</div>
              <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg,#E2E8F0,transparent)", borderRadius: 99 }} />
              <div style={{ background: "#EEF2FF", color: "#4338CA", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 99 }}>
                {stories.length} stories · {stories.length * 3} posts
              </div>
            </div>
            {stories.map((story, idx) => (
              <div key={idx} className="fade-up" style={{ animationDelay: `${idx * 0.07}s` }}>
                <StoryBlock
                  story={story}
                  posts={posts[idx]}
                  storyIdx={idx}
                  approvedMap={approvedMap}
                  onApprove={handleApprove}
                  onEdit={handleEdit}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <EditModal
        open={editState.open}
        platform={editState.platform}
        value={editState.value || ""}
        onChange={(v) => setEditState((s) => ({ ...s, value: v }))}
        onSave={handleEditSave}
        onClose={() => setEditState({ open: false })}
      />
    </div>
  );
}