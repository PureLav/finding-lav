import { useState, useEffect, useRef } from "react";

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = "https://prcuqxnrlbatoyhicfoa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByY3VxeG5ybGJhdG95aGljZm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjU1MDAsImV4cCI6MjA4NzUwMTUwMH0.toGHIR_Gh_kzSyqg-4duLRKT6z_EkDvTPPo-7a_LJ00";

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.status === 204 ? null : res.json();
}

// ─── MATCHING ALGORITHM ──────────────────────────────────────────────────────
function scoreMatch(person, candidate) {
  let score = 0;

  // Age compatibility
  const ageMin = parseInt(person.age_range_min) || 18;
  const ageMax = parseInt(person.age_range_max) || 99;
  const candAge = parseInt(candidate.age) || 25;
  if (candAge >= ageMin && candAge <= ageMax) score += 20;

  // Height preference (loose match)
  if (person.height_pref && candidate.height) {
    const diff = Math.abs(parseInt(person.height_pref) - parseInt(candidate.height));
    if (diff <= 5) score += 10;
    else if (diff <= 10) score += 5;
  }

  // Shared interests
  const myInterests = person.interests || [];
  const theirInterests = candidate.interests || [];
  const sharedInterests = myInterests.filter((i) => theirInterests.includes(i));
  score += sharedInterests.length * 8;

  // Relationship goals alignment
  if (person.relationship_goal === candidate.relationship_goal) score += 20;

  // Shared values
  const myValues = person.values || [];
  const theirValues = candidate.values || [];
  score += myValues.filter((v) => theirValues.includes(v)).length * 7;

  // Communication style match
  if (person.comm_style === candidate.comm_style) score += 10;

  // Personality overlap
  const myPersonality = person.personality || [];
  const theirPersonality = candidate.personality || [];
  score += myPersonality.filter((p) => theirPersonality.includes(p)).length * 5;

  // Shared genres
  const myGenres = person.genres || [];
  const theirGenres = candidate.genres || [];
  score += myGenres.filter((g) => theirGenres.includes(g)).length * 3;

  return { score, sharedInterests, sharedValues: myValues.filter((v) => theirValues.includes(v)) };
}

function runMatching(submissions) {
  const women = submissions.filter((s) => s.gender === "woman");
  const men = submissions.filter((s) => s.gender === "man");

  const matches = [];
  const matchedMen = new Set();
  const matchedWomen = new Set();

  // Sort women by submission time (first come first served for fairness)
  const sortedWomen = [...women].sort((a, b) => a.id - b.id);

  for (const woman of sortedWomen) {
    let bestScore = -1;
    let bestMan = null;
    let bestCommon = null;

    for (const man of men) {
      if (matchedMen.has(man.id)) continue;
      const { score, sharedInterests, sharedValues } = scoreMatch(woman, man);
      // Also check man's preference for woman's age
      const womanAge = parseInt(woman.age) || 25;
      const manAgeMin = parseInt(man.age_range_min) || 18;
      const manAgeMax = parseInt(man.age_range_max) || 99;
      const manLikesWoman = womanAge >= manAgeMin && womanAge <= manAgeMax;

      const finalScore = manLikesWoman ? score + 10 : score;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMan = man;
        const all = [...new Set([...sharedInterests, ...sharedValues])];
        bestCommon = all.length > 0 ? all[0] : "a love for good music";
      }
    }

    if (bestMan) {
      matches.push({
        person_a_id: woman.id,
        person_b_id: bestMan.id,
        person_a_name: woman.name,
        person_b_name: bestMan.name,
        person_a_email: woman.email,
        person_b_email: bestMan.email,
        person_a_wearing: woman.wearing,
        person_b_wearing: bestMan.wearing,
        person_a_description: `${woman.age} years old, ${woman.height}cm tall, wearing ${woman.wearing}`,
        person_b_description: `${bestMan.age} years old, ${bestMan.height}cm tall, wearing ${bestMan.wearing}`,
        in_common: bestCommon,
        score: bestScore,
      });
      matchedMen.add(bestMan.id);
      matchedWomen.add(woman.id);
    }
  }

  return matches;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const G = {
  bg: "#0a0705",
  surface: "#130e0b",
  card: "#1a1310",
  border: "#2a1f18",
  ember: "#e8502a",
  coral: "#f0795a",
  gold: "#c9a96e",
  text: "#f0e6dc",
  muted: "#8a7060",
  success: "#4caf82",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${G.bg};
    color: ${G.text};
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app {
    min-height: 100vh;
    position: relative;
    overflow: hidden;
  }

  /* Ambient background glow */
  .app::before {
    content: '';
    position: fixed;
    top: -20%;
    left: -10%;
    width: 60%;
    height: 60%;
    background: radial-gradient(ellipse, rgba(232,80,42,0.12) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .app::after {
    content: '';
    position: fixed;
    bottom: -20%;
    right: -10%;
    width: 50%;
    height: 50%;
    background: radial-gradient(ellipse, rgba(201,169,110,0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .screen {
    position: relative;
    z-index: 1;
    max-width: 480px;
    margin: 0 auto;
    padding: 24px 20px 48px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .logo {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 13px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: ${G.ember};
    margin-bottom: 8px;
  }

  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: clamp(48px, 14vw, 72px);
    line-height: 0.9;
    text-transform: uppercase;
    letter-spacing: -0.01em;
    color: ${G.text};
  }

  h1 span { color: ${G.ember}; }

  h2 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 28px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${G.text};
  }

  h3 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 18px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${G.muted};
    margin-bottom: 20px;
  }

  p { color: ${G.muted}; font-size: 15px; line-height: 1.6; }

  .divider {
    width: 40px;
    height: 2px;
    background: ${G.ember};
    margin: 16px 0;
  }

  /* Progress bar */
  .progress-wrap {
    display: flex;
    gap: 6px;
    margin-bottom: 32px;
  }
  .progress-dot {
    height: 3px;
    flex: 1;
    border-radius: 2px;
    background: ${G.border};
    transition: background 0.3s ease;
  }
  .progress-dot.active { background: ${G.ember}; }
  .progress-dot.done { background: ${G.gold}; }

  /* Step header */
  .step-tag {
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${G.ember};
    font-weight: 500;
    margin-bottom: 8px;
  }
  .step-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 32px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-bottom: 4px;
  }
  .step-sub { color: ${G.muted}; font-size: 14px; margin-bottom: 28px; }

  /* Form elements */
  .field { margin-bottom: 20px; }
  .field label {
    display: block;
    font-size: 12px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: ${G.muted};
    margin-bottom: 8px;
    font-weight: 500;
  }
  .field input, .field select, .field textarea {
    width: 100%;
    background: ${G.card};
    border: 1px solid ${G.border};
    border-radius: 8px;
    padding: 14px 16px;
    color: ${G.text};
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
    appearance: none;
  }
  .field input:focus, .field select:focus, .field textarea:focus {
    border-color: ${G.ember};
  }
  .field input::placeholder { color: ${G.muted}; }
  .field select option { background: ${G.card}; }
  .field textarea { resize: vertical; min-height: 80px; }

  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* Chip selects */
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    padding: 8px 14px;
    border-radius: 100px;
    border: 1px solid ${G.border};
    background: ${G.card};
    color: ${G.muted};
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
    font-family: 'DM Sans', sans-serif;
  }
  .chip:hover { border-color: ${G.coral}; color: ${G.coral}; }
  .chip.selected {
    background: rgba(232,80,42,0.15);
    border-color: ${G.ember};
    color: ${G.ember};
    font-weight: 500;
  }

  /* Rating */
  .rating-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .rating-label { font-size: 14px; color: ${G.muted}; flex: 1; }
  .rating-dots { display: flex; gap: 6px; }
  .rating-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid ${G.border};
    background: ${G.card};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: ${G.muted};
    transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .rating-dot.active {
    background: ${G.ember};
    border-color: ${G.ember};
    color: white;
  }

  /* Buttons */
  .btn-primary {
    width: 100%;
    padding: 18px;
    background: ${G.ember};
    color: white;
    border: none;
    border-radius: 12px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }
  .btn-primary:hover { background: ${G.coral}; transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .btn-ghost {
    background: transparent;
    color: ${G.muted};
    border: 1px solid ${G.border};
    border-radius: 12px;
    padding: 14px 20px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-ghost:hover { border-color: ${G.muted}; color: ${G.text}; }

  .nav-row {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }
  .nav-row .btn-ghost { flex: 0 0 auto; }
  .nav-row .btn-primary { flex: 1; }

  /* Countdown screen */
  .countdown-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .countdown-number {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: clamp(100px, 35vw, 180px);
    line-height: 1;
    color: ${G.ember};
    text-shadow: 0 0 60px rgba(232,80,42,0.5);
    transition: all 0.3s;
  }
  .countdown-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: ${G.muted};
    margin-top: 12px;
  }
  .pulse-ring {
    position: absolute;
    width: 280px;
    height: 280px;
    border-radius: 50%;
    border: 1px solid rgba(232,80,42,0.2);
    animation: pulse 2s ease-out infinite;
  }
  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  /* Match reveal */
  .match-card {
    background: ${G.card};
    border: 1px solid ${G.border};
    border-radius: 20px;
    padding: 28px 24px;
    margin: 20px 0;
    position: relative;
    overflow: hidden;
  }
  .match-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, ${G.ember}, ${G.gold});
  }
  .match-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 42px;
    text-transform: uppercase;
    color: ${G.text};
    margin-bottom: 4px;
  }
  .match-desc { font-size: 14px; color: ${G.muted}; margin-bottom: 16px; }
  .match-common {
    background: rgba(232,80,42,0.1);
    border: 1px solid rgba(232,80,42,0.25);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .match-common-label {
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${G.ember};
    margin-bottom: 4px;
    font-weight: 500;
  }
  .match-common-value { font-size: 15px; color: ${G.text}; }
  .match-wearing {
    background: rgba(201,169,110,0.08);
    border: 1px solid rgba(201,169,110,0.2);
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 12px;
  }
  .match-wearing-label {
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${G.gold};
    margin-bottom: 4px;
    font-weight: 500;
  }
  .match-wearing-value { font-size: 15px; color: ${G.text}; }

  /* Waiting */
  .waiting-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 20px;
  }
  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid ${G.border};
    border-top-color: ${G.ember};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Admin */
  .admin-screen { padding: 24px 20px; max-width: 700px; margin: 0 auto; }
  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid ${G.border};
  }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat-card {
    background: ${G.card};
    border: 1px solid ${G.border};
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  .stat-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 36px;
    color: ${G.ember};
  }
  .stat-lbl { font-size: 11px; color: ${G.muted}; text-transform: uppercase; letter-spacing: 0.1em; }

  .match-table { width: 100%; border-collapse: collapse; }
  .match-table th {
    text-align: left;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: ${G.muted};
    padding: 10px 12px;
    border-bottom: 1px solid ${G.border};
  }
  .match-table td {
    padding: 14px 12px;
    border-bottom: 1px solid ${G.border};
    font-size: 14px;
    color: ${G.text};
  }
  .match-table tr:last-child td { border-bottom: none; }

  .tag {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 100px;
    font-size: 11px;
    font-weight: 500;
  }
  .tag-ember { background: rgba(232,80,42,0.15); color: ${G.ember}; }
  .tag-gold { background: rgba(201,169,110,0.15); color: ${G.gold}; }

  .error-msg {
    background: rgba(232,80,42,0.1);
    border: 1px solid rgba(232,80,42,0.3);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    color: ${G.coral};
    margin-bottom: 16px;
  }

  .success-msg {
    background: rgba(76,175,130,0.1);
    border: 1px solid rgba(76,175,130,0.3);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    color: ${G.success};
    margin-bottom: 16px;
  }

  /* Note about Supabase setup */
  .setup-note {
    background: ${G.card};
    border: 1px solid ${G.border};
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
    font-size: 13px;
    color: ${G.muted};
    line-height: 1.7;
  }
  .setup-note strong { color: ${G.gold}; }
  .setup-note code {
    background: rgba(255,255,255,0.06);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    color: ${G.coral};
  }

  @media (max-width: 400px) {
    .row-2 { grid-template-columns: 1fr; }
    .stat-grid { grid-template-columns: repeat(3, 1fr); }
  }
`;

// ─── STEP DATA ────────────────────────────────────────────────────────────────
const INTERESTS = ["Music", "Fitness", "Art", "Travel", "Books", "Food", "Spirituality", "Entrepreneurship", "Fashion", "Tech", "Sports", "Nature", "Film", "Gaming", "Cooking"];
const VALUES = ["Loyalty", "Humor", "Ambition", "Creativity", "Kindness", "Integrity", "Adventure", "Family", "Independence", "Growth"];
const PERSONALITY = ["Outgoing", "Introspective", "Adventurous", "Thoughtful", "Witty", "Spontaneous", "Calm", "Passionate", "Caring", "Bold"];
const GENRES = ["Amapiano", "Afrotech", "Tech House", "R&B", "Hip Hop", "Soul", "Jazz", "Classical", "Afrobeats", "House", "Dancehall"];
const COMM_STYLES = ["Direct & clear", "Playful & teasing", "Thoughtful & deep", "Light & fun"];
const WEEKEND_VIBES = ["Big social night out", "Chill gathering at home", "Outdoor adventure", "Exploring the city"];
const REL_GOALS = ["Looking for something casual", "Interested in long-term/serious commitment", "Open to seeing where things go"];
const DATE_VIBES = ["Picnic", "Dinner", "Concert", "Outdoor activity"];

const TOTAL_STEPS = 7;

// ─── CHIP COMPONENT ───────────────────────────────────────────────────────────
function Chips({ options, selected, onChange, max }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((x) => x !== opt));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="chips">
      {options.map((opt) => (
        <div key={opt} className={`chip ${selected.includes(opt) ? "selected" : ""}`} onClick={() => toggle(opt)}>
          {opt}
        </div>
      ))}
    </div>
  );
}

function SingleChip({ options, selected, onChange }) {
  return (
    <div className="chips">
      {options.map((opt) => (
        <div key={opt} className={`chip ${selected === opt ? "selected" : ""}`} onClick={() => onChange(opt)}>
          {opt}
        </div>
      ))}
    </div>
  );
}

function Rating({ label, value, onChange }) {
  return (
    <div className="rating-row">
      <span className="rating-label">{label}</span>
      <div className="rating-dots">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`rating-dot ${value >= n ? "active" : ""}`} onClick={() => onChange(n)}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function Progress({ step }) {
  return (
    <div className="progress-wrap">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} className={`progress-dot ${i < step ? "done" : i === step ? "active" : ""}`} />
      ))}
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function LandingScreen({ onStart }) {
  return (
    <div className="screen" style={{ justifyContent: "center" }}>
      <div className="logo">Pure Lav Presents</div>
      <h1>Finding<br /><span>Lav</span></h1>
      <div className="divider" />
      <p style={{ marginBottom: 40 }}>Welcome to Johannesburg's most unique dating experience. Fill in your details and let the night find your match.</p>
      <button className="btn-primary" onClick={onStart}>Begin</button>
      <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>Your details are private and secure</p>
    </div>
  );
}

function Step1({ data, setData, onNext }) {
  const ok = data.name && data.email && data.gender && data.wearing;
  return (
    <div className="screen">
      <Progress step={0} />
      <div className="step-tag">Step 1 of {TOTAL_STEPS}</div>
      <div className="step-title">The Basics</div>
      <p className="step-sub">Let's start with who you are tonight.</p>

      <div className="field">
        <label>Your name *</label>
        <input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="First name" />
      </div>
      <div className="field">
        <label>Nickname (optional)</label>
        <input value={data.nickname} onChange={(e) => setData({ ...data, nickname: e.target.value })} placeholder="What people call you" />
      </div>
      <div className="field">
        <label>Email address *</label>
        <input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="you@email.com" />
      </div>
      <div className="field">
        <label>I am a *</label>
        <SingleChip options={["Woman", "Man"]} selected={data.gender} onChange={(v) => setData({ ...data, gender: v.toLowerCase() })} />
      </div>
      <div className="field">
        <label>What are you wearing tonight? *</label>
        <input value={data.wearing} onChange={(e) => setData({ ...data, wearing: e.target.value })} placeholder="e.g. black dress, red shirt" />
      </div>
      <div className="row-2">
        <div className="field">
          <label>Height (cm)</label>
          <input type="number" value={data.height} onChange={(e) => setData({ ...data, height: e.target.value })} placeholder="e.g. 168" />
        </div>
        <div className="field">
          <label>Your age *</label>
          <input type="number" value={data.age} onChange={(e) => setData({ ...data, age: e.target.value })} placeholder="e.g. 27" />
        </div>
      </div>

      <button className="btn-primary" onClick={onNext} disabled={!ok}>Continue</button>
    </div>
  );
}

function Step2({ data, setData, onNext, onBack }) {
  return (
    <div className="screen">
      <Progress step={1} />
      <div className="step-tag">Step 2 of {TOTAL_STEPS}</div>
      <div className="step-title">Your Preferences</div>
      <p className="step-sub">Who are you hoping to meet?</p>

      <div className="field">
        <label>Age range you'd like to meet</label>
        <div className="row-2">
          <input type="number" value={data.age_range_min} onChange={(e) => setData({ ...data, age_range_min: e.target.value })} placeholder="Min age" />
          <input type="number" value={data.age_range_max} onChange={(e) => setData({ ...data, age_range_max: e.target.value })} placeholder="Max age" />
        </div>
      </div>
      <div className="field">
        <label>Height preference (cm, optional)</label>
        <input type="number" value={data.height_pref} onChange={(e) => setData({ ...data, height_pref: e.target.value })} placeholder="e.g. 180" />
      </div>
      <div className="field">
        <label>Relationship goal *</label>
        <SingleChip options={REL_GOALS} selected={data.relationship_goal} onChange={(v) => setData({ ...data, relationship_goal: v })} />
      </div>

      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onNext} disabled={!data.relationship_goal}>Continue</button>
      </div>
    </div>
  );
}

function Step3({ data, setData, onNext, onBack }) {
  return (
    <div className="screen">
      <Progress step={2} />
      <div className="step-tag">Step 3 of {TOTAL_STEPS}</div>
      <div className="step-title">Your Interests</div>
      <p className="step-sub">Pick everything that speaks to you.</p>

      <div className="field">
        <label>Interests (pick all that apply)</label>
        <Chips options={INTERESTS} selected={data.interests || []} onChange={(v) => setData({ ...data, interests: v })} />
      </div>
      <div className="field" style={{ marginTop: 24 }}>
        <label>Ideal weekend</label>
        <SingleChip options={WEEKEND_VIBES} selected={data.weekend} onChange={(v) => setData({ ...data, weekend: v })} />
      </div>

      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function Step4({ data, setData, onNext, onBack }) {
  return (
    <div className="screen">
      <Progress step={3} />
      <div className="step-tag">Step 4 of {TOTAL_STEPS}</div>
      <div className="step-title">Values & Character</div>
      <p className="step-sub">What matters most to you in a partner?</p>

      <div className="field">
        <label>Values you look for (up to 3)</label>
        <Chips options={VALUES} selected={data.values || []} onChange={(v) => setData({ ...data, values: v })} max={3} />
      </div>
      <div className="field" style={{ marginTop: 24 }}>
        <label>Your personality (pick 3)</label>
        <Chips options={PERSONALITY} selected={data.personality || []} onChange={(v) => setData({ ...data, personality: v })} max={3} />
      </div>
      <div className="field" style={{ marginTop: 24 }}>
        <label>Personality you're looking for (pick 3)</label>
        <Chips options={PERSONALITY} selected={data.desired_personality || []} onChange={(v) => setData({ ...data, desired_personality: v })} max={3} />
      </div>

      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function Step5({ data, setData, onNext, onBack }) {
  return (
    <div className="screen">
      <Progress step={4} />
      <div className="step-tag">Step 5 of {TOTAL_STEPS}</div>
      <div className="step-title">Vibe Check</div>
      <p className="step-sub">How important are these to you?</p>

      <div style={{ marginBottom: 28 }}>
        <Rating label="Physical attraction" value={data.rating_physical || 0} onChange={(v) => setData({ ...data, rating_physical: v })} />
        <Rating label="Shared interests" value={data.rating_interests || 0} onChange={(v) => setData({ ...data, rating_interests: v })} />
        <Rating label="Sense of humor" value={data.rating_humor || 0} onChange={(v) => setData({ ...data, rating_humor: v })} />
      </div>

      <div className="field">
        <label>Your communication style</label>
        <SingleChip options={COMM_STYLES} selected={data.comm_style} onChange={(v) => setData({ ...data, comm_style: v })} />
      </div>

      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function Step6({ data, setData, onNext, onBack }) {
  return (
    <div className="screen">
      <Progress step={5} />
      <div className="step-tag">Step 6 of {TOTAL_STEPS}</div>
      <div className="step-title">Fun Stuff</div>
      <p className="step-sub">The icebreakers that actually matter.</p>

      <div className="field">
        <label>Favourite music genres (pick up to 3)</label>
        <Chips options={GENRES} selected={data.genres || []} onChange={(v) => setData({ ...data, genres: v })} max={3} />
      </div>
      <div className="field" style={{ marginTop: 24 }}>
        <label>Ideal first date</label>
        <SingleChip options={DATE_VIBES} selected={data.first_date} onChange={(v) => setData({ ...data, first_date: v })} />
      </div>
      <div className="field" style={{ marginTop: 24 }}>
        <label>Deal-breakers (optional — may be shared with your match)</label>
        <textarea value={data.dealbreakers} onChange={(e) => setData({ ...data, dealbreakers: e.target.value })} placeholder="Anything that's a hard no for you..." />
      </div>

      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

function Step7({ data, setData, onSubmit, onBack, loading, error }) {
  return (
    <div className="screen">
      <Progress step={6} />
      <div className="step-tag">Step 7 of {TOTAL_STEPS}</div>
      <div className="step-title">Almost There</div>
      <p className="step-sub">A couple of final things.</p>

      <div className="field">
        <label>Anything else you'd like your match to know? (optional)</label>
        <textarea value={data.extra} onChange={(e) => setData({ ...data, extra: e.target.value })} placeholder="Fun fact, a question you love asking, your vibe tonight..." />
      </div>

      <div style={{ background: "rgba(201,169,110,0.06)", border: `1px solid rgba(201,169,110,0.2)`, borderRadius: 12, padding: "16px 18px", marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: G.gold, marginBottom: 8 }}>Privacy note</div>
        <p style={{ fontSize: 13, color: G.muted }}>Your personal details stay private. Only your name, a short description, and one thing you have in common will be shared with your match.</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onSubmit} disabled={loading}>{loading ? "Submitting..." : "Submit & Find My Match"}</button>
      </div>
    </div>
  );
}

function WaitingScreen({ name }) {
  return (
    <div className="screen">
      <div className="waiting-wrap">
        <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: G.ember }}>Pure Lav Presents</div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 120, height: 120 }}>
          <div className="pulse-ring" style={{ width: 120, height: 120 }} />
          <div className="spinner" />
        </div>
        <div>
          <h2 style={{ textAlign: "center", marginBottom: 8 }}>You're in, {name}!</h2>
          <p style={{ textAlign: "center" }}>Sit tight. The matching countdown will begin shortly. Keep an eye on the screen — and enjoy the music.</p>
        </div>
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 20px", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: G.muted, marginBottom: 6 }}>Check your email after the reveal</div>
          <p style={{ fontSize: 14 }}>Your match details will be sent to your inbox.</p>
        </div>
      </div>
    </div>
  );
}

function CountdownScreen({ onComplete }) {
  const [count, setCount] = useState(10);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (count <= 0) {
      setDone(true);
      setTimeout(() => onComplete(), 1500);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="countdown-wrap">
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="pulse-ring" />
          <div className="pulse-ring" style={{ animationDelay: "0.5s" }} />
          <div className="countdown-number">{done ? "✦" : count}</div>
        </div>
        <div className="countdown-label">{done ? "Finding your match..." : "Your match is being revealed"}</div>
      </div>
    </div>
  );
}

function MatchRevealScreen({ match, myId }) {
  const isA = match.person_a_id === myId;
  const myName = isA ? match.person_a_name : match.person_b_name;
  const theirName = isA ? match.person_b_name : match.person_a_name;
  const theirDesc = isA ? match.person_b_description : match.person_a_description;
  const theirWearing = isA ? match.person_b_wearing : match.person_a_wearing;

  return (
    <div className="screen">
      <div style={{ marginBottom: 8 }}>
        <div className="logo">It's a match</div>
        <h1 style={{ fontSize: "clamp(36px, 12vw, 56px)" }}>Hello,<br /><span>{myName}</span></h1>
      </div>
      <div className="divider" />
      <p style={{ marginBottom: 20 }}>Tonight, you've been matched with:</p>

      <div className="match-card">
        <div className="match-name">{theirName}</div>
        <div className="match-desc">{theirDesc}</div>
        <div className="match-wearing">
          <div className="match-wearing-label">Find them — they're wearing</div>
          <div className="match-wearing-value">{theirWearing}</div>
        </div>
        <div className="match-common" style={{ marginTop: 12 }}>
          <div className="match-common-label">You both share a love of</div>
          <div className="match-common-value">{match.in_common}</div>
        </div>
      </div>

      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 14 }}>Full match details have been sent to your email. Now go find them — the night is yours. 🎶</p>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const ADMIN_PW = "Chease123"; // Change this!

  const [submissions, setSubmissions] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  async function loadData() {
    try {
      const subs = await supabase("GET", "submissions?select=*&order=created_at.asc");
      const mts = await supabase("GET", "matches?select=*&order=created_at.desc");
      setSubmissions(subs || []);
      setMatches(mts || []);
    } catch (e) {
      setError("Failed to load data: " + e.message);
    }
  }

  async function handleRunMatches() {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const newMatches = runMatching(submissions);
      // Clear old matches and insert new
      await supabase("DELETE", "matches?id=gt.0");
      for (const m of newMatches) {
        await supabase("POST", "matches", m);
      }
      setMsg(`✓ Matched ${newMatches.length} pairs successfully!`);
      await loadData();
    } catch (e) {
      setError("Error running matches: " + e.message);
    }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div className="screen" style={{ justifyContent: "center" }}>
        <div className="logo">Admin Access</div>
        <h2 style={{ marginBottom: 24 }}>Finding Lav</h2>
        <div className="field">
          <label>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter admin password" onKeyDown={(e) => e.key === "Enter" && pw === ADMIN_PW && setAuthed(true)} />
        </div>
        <button className="btn-primary" onClick={() => { if (pw === ADMIN_PW) setAuthed(true); else setError("Wrong password."); }} >Enter</button>
        {error && <div className="error-msg" style={{ marginTop: 16 }}>{error}</div>}
        <button className="btn-ghost" style={{ marginTop: 12, width: "100%" }} onClick={onBack}>← Back to app</button>
      </div>
    );
  }

  const women = submissions.filter((s) => s.gender === "woman");
  const men = submissions.filter((s) => s.gender === "man");

  return (
    <div className="admin-screen">
      <div className="admin-header">
        <div>
          <div className="logo">Admin Panel</div>
          <h2>Finding Lav</h2>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={loadData}>Refresh</button>
          <button className="btn-ghost" onClick={onBack}>← Exit</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{submissions.length}</div>
          <div className="stat-lbl">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: G.coral }}>{women.length}</div>
          <div className="stat-lbl">Women</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: G.gold }}>{men.length}</div>
          <div className="stat-lbl">Men</div>
        </div>
      </div>

      <div className="setup-note">
        <strong>⚠ Supabase setup required</strong><br />
        Before using this app, set up two tables in your Supabase project:<br /><br />
        Table <code>submissions</code>: id (int8, pk), name, nickname, email, gender, wearing, height, age, age_range_min, age_range_max, height_pref, relationship_goal, interests (text[]), weekend, values (text[]), personality (text[]), desired_personality (text[]), rating_physical (int2), rating_interests (int2), rating_humor (int2), comm_style, genres (text[]), first_date, dealbreakers, extra, created_at (timestamptz default now())<br /><br />
        Table <code>matches</code>: id, person_a_id, person_b_id, person_a_name, person_b_name, person_a_email, person_b_email, person_a_wearing, person_b_wearing, person_a_description, person_b_description, in_common, score, created_at<br /><br />
        Then replace <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> at the top of this file.
      </div>

      {msg && <div className="success-msg">{msg}</div>}
      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary" onClick={handleRunMatches} disabled={loading} style={{ marginBottom: 28 }}>
        {loading ? "Matching..." : `⚡ Run Matching Algorithm (${Math.min(women.length, men.length)} pairs)`}
      </button>

      {matches.length > 0 && (
        <>
          <h3>Matched Pairs ({matches.length})</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="match-table">
              <thead>
                <tr>
                  <th>Woman</th>
                  <th>Man</th>
                  <th>In Common</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{m.person_a_name}</strong>
                      <div style={{ fontSize: 12, color: G.muted }}>{m.person_a_email}</div>
                    </td>
                    <td>
                      <strong>{m.person_b_name}</strong>
                      <div style={{ fontSize: 12, color: G.muted }}>{m.person_b_email}</div>
                    </td>
                    <td><span className="tag tag-ember">{m.in_common}</span></td>
                    <td><span className="tag tag-gold">{m.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {submissions.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>All Submissions ({submissions.length})</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="match-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Email</th>
                  <th>Wearing</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={i}>
                    <td>{s.name}</td>
                    <td><span className={`tag ${s.gender === "woman" ? "tag-ember" : "tag-gold"}`}>{s.gender}</span></td>
                    <td>{s.age}</td>
                    <td style={{ fontSize: 12 }}>{s.email}</td>
                    <td style={{ fontSize: 13, color: G.muted }}>{s.wearing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("landing"); // landing | form | waiting | countdown | reveal | admin
  const [step, setStep] = useState(0);
  const [submissionId, setSubmissionId] = useState(null);
  const [myMatch, setMyMatch] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "", nickname: "", email: "", gender: "",
    wearing: "", height: "", age: "",
    age_range_min: "19", age_range_max: "40", height_pref: "",
    relationship_goal: "",
    interests: [], weekend: "",
    values: [], personality: [], desired_personality: [],
    rating_physical: 3, rating_interests: 3, rating_humor: 3,
    comm_style: "", genres: [], first_date: "",
    dealbreakers: "", extra: "",
  });

  // Check URL for admin
  useEffect(() => {
    if (window.location.hash === "#admin") setView("admin");
  }, []);

  // Poll for match after submission
  useEffect(() => {
    if (view !== "waiting" || !submissionId) return;
    const interval = setInterval(async () => {
      try {
        const matches = await supabase("GET", `matches?or=(person_a_id.eq.${submissionId},person_b_id.eq.${submissionId})&select=*`);
        if (matches && matches.length > 0) {
          setMyMatch(matches[0]);
          setView("countdown");
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [view, submissionId]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await supabase("POST", "submissions", formData);
      if (result && result.length > 0) {
        setSubmissionId(result[0].id);
        setView("waiting");
      }
    } catch (e) {
      setSubmitError("Something went wrong. Please try again. (" + e.message + ")");
    }
    setSubmitting(false);
  }

  const steps = [Step1, Step2, Step3, Step4, Step5, Step6, Step7];
  const StepComponent = steps[step];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="app">
        {view === "landing" && <LandingScreen onStart={() => setView("form")} />}
        {view === "form" && (
          <StepComponent
            data={formData}
            setData={setFormData}
            onNext={() => { if (step < TOTAL_STEPS - 1) setStep(step + 1); }}
            onBack={() => { if (step > 0) setStep(step - 1); else setView("landing"); }}
            onSubmit={handleSubmit}
            loading={submitting}
            error={submitError}
          />
        )}
        {view === "waiting" && <WaitingScreen name={formData.name} />}
        {view === "countdown" && <CountdownScreen onComplete={() => setView("reveal")} />}
        {view === "reveal" && myMatch && <MatchRevealScreen match={myMatch} myId={submissionId} />}
        {view === "admin" && <AdminPanel onBack={() => setView("landing")} />}

        {/* Admin access link */}
        {view === "landing" && (
          <div style={{ position: "fixed", bottom: 16, right: 20, zIndex: 10 }}>
            <button onClick={() => setView("admin")} style={{ background: "none", border: "none", color: G.border, fontSize: 11, cursor: "pointer", letterSpacing: "0.1em" }}>
              admin
            </button>
          </div>
        )}
      </div>
    </>
  );
}
