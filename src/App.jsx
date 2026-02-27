import { useState, useEffect } from "react";

// ─── SUPABASE CONFIG ─────────────────────────────────────────────────────────
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
  const ageMin = parseInt(person.age_range_min) || 18;
  const ageMax = parseInt(person.age_range_max) || 99;
  const candAge = parseInt(candidate.age) || 25;
  if (candAge >= ageMin && candAge <= ageMax) score += 20;

  if (person.height_pref && candidate.height) {
    const diff = Math.abs(parseInt(person.height_pref) - parseInt(candidate.height));
    if (diff <= 5) score += 10;
    else if (diff <= 10) score += 5;
  }

  const sharedInterests = (person.interests || []).filter(i => (candidate.interests || []).includes(i));
  score += sharedInterests.length * 8;

  if (person.relationship_goal === candidate.relationship_goal) score += 20;

  const sharedValues = (person.values || []).filter(v => (candidate.values || []).includes(v));
  score += sharedValues.length * 7;

  if (person.comm_style === candidate.comm_style) score += 10;

  const sharedPersonality = (person.personality || []).filter(p => (candidate.personality || []).includes(p));
  score += sharedPersonality.length * 5;

  const sharedGenres = (person.genres || []).filter(g => (candidate.genres || []).includes(g));
  score += sharedGenres.length * 3;

  const allCommon = [...new Set([...sharedInterests, ...sharedValues, ...sharedGenres])];
  const inCommon = allCommon.length > 0 ? allCommon[0] : "a love for good music";

  return { score, inCommon };
}

function runMatching(submissions) {
  const groupA = submissions.filter(s => s.gender === "woman");
  const groupB = submissions.filter(s => s.gender === "man");

  // Determine majority/minority
  const [majority, minority] = groupA.length >= groupB.length
    ? [groupA, groupB]
    : [groupB, groupA];

  const matches = [];
  const matchCounts = {}; // track how many matches each person has
  submissions.forEach(s => { matchCounts[s.id] = 0; });

  // Round 1: everyone in minority gets their best match from majority
  const usedMajority = new Set();

  const sortedMinority = [...minority].sort((a, b) => a.id - b.id);

  for (const person of sortedMinority) {
    let bestScore = -1;
    let bestMatch = null;
    let bestCommon = null;

    for (const candidate of majority) {
      if (usedMajority.has(candidate.id)) continue;
      const { score, inCommon } = scoreMatch(person, candidate);
      // Check mutual age preference
      const personAge = parseInt(person.age) || 25;
      const candAgeMin = parseInt(candidate.age_range_min) || 18;
      const candAgeMax = parseInt(candidate.age_range_max) || 99;
      const mutual = personAge >= candAgeMin && personAge <= candAgeMax;
      const finalScore = mutual ? score + 10 : score;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = candidate;
        bestCommon = inCommon;
      }
    }

    if (bestMatch) {
      matches.push({
        person_a_id: person.id,
        person_b_id: bestMatch.id,
        person_a_name: person.name,
        person_b_name: bestMatch.name,
        person_a_email: person.email,
        person_b_email: bestMatch.email,
        person_a_wearing: person.wearing,
        person_b_wearing: bestMatch.wearing,
        person_a_gender: person.gender,
        person_b_gender: bestMatch.gender,
        person_a_description: `${person.age} years old, ${person.height}cm, wearing ${person.wearing}`,
        person_b_description: `${bestMatch.age} years old, ${bestMatch.height}cm, wearing ${bestMatch.wearing}`,
        in_common: bestCommon,
        score: bestScore,
        is_second_match: false,
        session_id: person.session_id,
      });
      usedMajority.add(bestMatch.id);
      matchCounts[person.id] = (matchCounts[person.id] || 0) + 1;
      matchCounts[bestMatch.id] = (matchCounts[bestMatch.id] || 0) + 1;
    }
  }

  // Round 2: unmatched majority get a second match with their best available minority person
  // (minority person gets a second match too, max 2 total)
  const unmatchedMajority = majority.filter(p => !usedMajority.has(p.id));

  for (const person of unmatchedMajority) {
    let bestScore = -1;
    let bestMatch = null;
    let bestCommon = null;

    // Find best minority person who has < 2 matches
    for (const candidate of minority) {
      if ((matchCounts[candidate.id] || 0) >= 2) continue;
      const { score, inCommon } = scoreMatch(person, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
        bestCommon = inCommon;
      }
    }

    if (bestMatch) {
      matches.push({
        person_a_id: bestMatch.id,
        person_b_id: person.id,
        person_a_name: bestMatch.name,
        person_b_name: person.name,
        person_a_email: bestMatch.email,
        person_b_email: person.email,
        person_a_wearing: bestMatch.wearing,
        person_b_wearing: person.wearing,
        person_a_gender: bestMatch.gender,
        person_b_gender: person.gender,
        person_a_description: `${bestMatch.age} years old, ${bestMatch.height}cm, wearing ${bestMatch.wearing}`,
        person_b_description: `${person.age} years old, ${person.height}cm, wearing ${person.wearing}`,
        in_common: bestCommon,
        score: bestScore,
        is_second_match: true,
        session_id: person.session_id,
      });
      matchCounts[bestMatch.id] = (matchCounts[bestMatch.id] || 0) + 1;
      matchCounts[person.id] = (matchCounts[person.id] || 0) + 1;
    }
  }

  return matches;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const G = {
  bg: "#0a0705", surface: "#130e0b", card: "#1a1310", border: "#2a1f18",
  ember: "#e8502a", coral: "#f0795a", gold: "#c9a96e", text: "#f0e6dc",
  muted: "#8a7060", success: "#4caf82",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${G.bg}; color: ${G.text}; font-family: 'DM Sans', sans-serif; min-height: 100vh; overflow-x: hidden; }
  .app { min-height: 100vh; position: relative; overflow: hidden; }
  .app::before { content: ''; position: fixed; top: -20%; left: -10%; width: 60%; height: 60%; background: radial-gradient(ellipse, rgba(232,80,42,0.12) 0%, transparent 70%); pointer-events: none; z-index: 0; }
  .app::after { content: ''; position: fixed; bottom: -20%; right: -10%; width: 50%; height: 50%; background: radial-gradient(ellipse, rgba(201,169,110,0.08) 0%, transparent 70%); pointer-events: none; z-index: 0; }
  .screen { position: relative; z-index: 1; max-width: 480px; margin: 0 auto; padding: 24px 20px 48px; min-height: 100vh; display: flex; flex-direction: column; }
  .logo { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 13px; letter-spacing: 0.3em; text-transform: uppercase; color: ${G.ember}; margin-bottom: 8px; }
  h1 { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: clamp(48px, 14vw, 72px); line-height: 0.9; text-transform: uppercase; color: ${G.text}; }
  h1 span { color: ${G.ember}; }
  h2 { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 28px; text-transform: uppercase; letter-spacing: 0.05em; color: ${G.text}; }
  h3 { font-family: 'Barlow Condensed', sans-serif; font-weight: 600; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; color: ${G.muted}; margin-bottom: 20px; }
  p { color: ${G.muted}; font-size: 15px; line-height: 1.6; }
  .divider { width: 40px; height: 2px; background: ${G.ember}; margin: 16px 0; }
  .progress-wrap { display: flex; gap: 6px; margin-bottom: 32px; }
  .progress-dot { height: 3px; flex: 1; border-radius: 2px; background: ${G.border}; transition: background 0.3s ease; }
  .progress-dot.active { background: ${G.ember}; }
  .progress-dot.done { background: ${G.gold}; }
  .step-tag { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: ${G.ember}; font-weight: 500; margin-bottom: 8px; }
  .step-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 32px; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 4px; }
  .step-sub { color: ${G.muted}; font-size: 14px; margin-bottom: 28px; }
  .field { margin-bottom: 20px; }
  .field label { display: block; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: ${G.muted}; margin-bottom: 8px; font-weight: 500; }
  .field input, .field select, .field textarea { width: 100%; background: ${G.card}; border: 1px solid ${G.border}; border-radius: 8px; padding: 14px 16px; color: ${G.text}; font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color 0.2s; appearance: none; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: ${G.ember}; }
  .field input::placeholder { color: ${G.muted}; }
  .field select option { background: ${G.card}; }
  .field textarea { resize: vertical; min-height: 80px; }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { padding: 8px 14px; border-radius: 100px; border: 1px solid ${G.border}; background: ${G.card}; color: ${G.muted}; font-size: 13px; cursor: pointer; transition: all 0.15s; user-select: none; font-family: 'DM Sans', sans-serif; }
  .chip:hover { border-color: ${G.coral}; color: ${G.coral}; }
  .chip.selected { background: rgba(232,80,42,0.15); border-color: ${G.ember}; color: ${G.ember}; font-weight: 500; }
  .rating-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .rating-label { font-size: 14px; color: ${G.muted}; flex: 1; }
  .rating-dots { display: flex; gap: 6px; }
  .rating-dot { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid ${G.border}; background: ${G.card}; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: ${G.muted}; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .rating-dot.active { background: ${G.ember}; border-color: ${G.ember}; color: white; }
  .btn-primary { width: 100%; padding: 18px; background: ${G.ember}; color: white; border: none; border-radius: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
  .btn-primary:hover { background: ${G.coral}; transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .btn-ghost { background: transparent; color: ${G.muted}; border: 1px solid ${G.border}; border-radius: 12px; padding: 14px 20px; font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s; }
  .btn-ghost:hover { border-color: ${G.muted}; color: ${G.text}; }
  .nav-row { display: flex; gap: 12px; margin-top: 12px; }
  .nav-row .btn-ghost { flex: 0 0 auto; }
  .nav-row .btn-primary { flex: 1; }
  .countdown-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .countdown-number { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: clamp(100px, 35vw, 180px); line-height: 1; color: ${G.ember}; text-shadow: 0 0 60px rgba(232,80,42,0.5); }
  .countdown-label { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; letter-spacing: 0.3em; text-transform: uppercase; color: ${G.muted}; margin-top: 12px; }
  .pulse-ring { position: absolute; width: 280px; height: 280px; border-radius: 50%; border: 1px solid rgba(232,80,42,0.2); animation: pulse 2s ease-out infinite; }
  @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
  .match-card { background: ${G.card}; border: 1px solid ${G.border}; border-radius: 20px; padding: 28px 24px; margin: 16px 0; position: relative; overflow: hidden; }
  .match-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, ${G.ember}, ${G.gold}); }
  .match-card.second::before { background: linear-gradient(90deg, ${G.gold}, ${G.coral}); }
  .match-name { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 42px; text-transform: uppercase; color: ${G.text}; margin-bottom: 4px; }
  .match-desc { font-size: 14px; color: ${G.muted}; margin-bottom: 16px; }
  .match-common { background: rgba(232,80,42,0.1); border: 1px solid rgba(232,80,42,0.25); border-radius: 10px; padding: 14px 16px; }
  .match-common-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: ${G.ember}; margin-bottom: 4px; font-weight: 500; }
  .match-common-value { font-size: 15px; color: ${G.text}; }
  .match-wearing { background: rgba(201,169,110,0.08); border: 1px solid rgba(201,169,110,0.2); border-radius: 10px; padding: 14px 16px; margin-top: 12px; }
  .match-wearing-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: ${G.gold}; margin-bottom: 4px; font-weight: 500; }
  .match-wearing-value { font-size: 15px; color: ${G.text}; }
  .waiting-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 20px; }
  .spinner { width: 48px; height: 48px; border: 3px solid ${G.border}; border-top-color: ${G.ember}; border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .admin-screen { padding: 24px 20px; max-width: 780px; margin: 0 auto; position: relative; z-index: 1; }
  .admin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid ${G.border}; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat-card { background: ${G.card}; border: 1px solid ${G.border}; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-num { font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 36px; color: ${G.ember}; }
  .stat-lbl { font-size: 11px; color: ${G.muted}; text-transform: uppercase; letter-spacing: 0.1em; }
  .match-table { width: 100%; border-collapse: collapse; }
  .match-table th { text-align: left; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: ${G.muted}; padding: 10px 12px; border-bottom: 1px solid ${G.border}; }
  .match-table td { padding: 14px 12px; border-bottom: 1px solid ${G.border}; font-size: 14px; color: ${G.text}; }
  .match-table tr:last-child td { border-bottom: none; }
  .tag { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 500; }
  .tag-ember { background: rgba(232,80,42,0.15); color: ${G.ember}; }
  .tag-gold { background: rgba(201,169,110,0.15); color: ${G.gold}; }
  .tag-success { background: rgba(76,175,130,0.15); color: ${G.success}; }
  .error-msg { background: rgba(232,80,42,0.1); border: 1px solid rgba(232,80,42,0.3); border-radius: 8px; padding: 12px 16px; font-size: 14px; color: ${G.coral}; margin-bottom: 16px; }
  .success-msg { background: rgba(76,175,130,0.1); border: 1px solid rgba(76,175,130,0.3); border-radius: 8px; padding: 12px 16px; font-size: 14px; color: ${G.success}; margin-bottom: 16px; }
  .warning-msg { background: rgba(201,169,110,0.1); border: 1px solid rgba(201,169,110,0.3); border-radius: 8px; padding: 12px 16px; font-size: 14px; color: ${G.gold}; margin-bottom: 16px; }
  .session-banner { background: ${G.card}; border: 1px solid ${G.border}; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
  .session-dot { width: 10px; height: 10px; border-radius: 50%; background: ${G.success}; flex-shrink: 0; box-shadow: 0 0 8px ${G.success}; }
  .session-dot.inactive { background: ${G.muted}; box-shadow: none; }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const INTERESTS = ["Music", "Fitness", "Art", "Travel", "Books", "Food", "Spirituality", "Entrepreneurship", "Fashion", "Tech", "Sports", "Nature", "Film", "Gaming", "Cooking"];
const VALUES = ["Loyalty", "Humor", "Ambition", "Creativity", "Kindness", "Integrity", "Adventure", "Family", "Independence", "Growth"];
const PERSONALITY = ["Outgoing", "Introspective", "Adventurous", "Thoughtful", "Witty", "Spontaneous", "Calm", "Passionate", "Caring", "Bold"];
const GENRES = ["Amapiano", "Afrotech", "Tech House", "R&B", "Hip Hop", "Soul", "Jazz", "Classical", "Afrobeats", "House", "Dancehall"];
const COMM_STYLES = ["Direct & clear", "Playful & teasing", "Thoughtful & deep", "Light & fun"];
const WEEKEND_VIBES = ["Big social night out", "Chill gathering at home", "Outdoor adventure", "Exploring the city"];
const REL_GOALS = ["Looking for something casual", "Interested in long-term/serious commitment", "Open to seeing where things go"];
const DATE_VIBES = ["Picnic", "Dinner", "Concert", "Outdoor activity"];
const TOTAL_STEPS = 7;
const ADMIN_PW = "purelav2025"; // ← Change this to your password!

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
function Chips({ options, selected, onChange, max }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(x => x !== opt));
    else if (!max || selected.length < max) onChange([...selected, opt]);
  };
  return <div className="chips">{options.map(opt => <div key={opt} className={`chip ${selected.includes(opt) ? "selected" : ""}`} onClick={() => toggle(opt)}>{opt}</div>)}</div>;
}

function SingleChip({ options, selected, onChange }) {
  return <div className="chips">{options.map(opt => <div key={opt} className={`chip ${selected === opt ? "selected" : ""}`} onClick={() => onChange(opt)}>{opt}</div>)}</div>;
}

function Rating({ label, value, onChange }) {
  return (
    <div className="rating-row">
      <span className="rating-label">{label}</span>
      <div className="rating-dots">
        {[1,2,3,4,5].map(n => <div key={n} className={`rating-dot ${value >= n ? "active" : ""}`} onClick={() => onChange(n)}>{n}</div>)}
      </div>
    </div>
  );
}

function Progress({ step }) {
  return (
    <div className="progress-wrap">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} className={`progress-dot ${i < step ? "done" : i === step ? "active" : ""}`} />
      ))}
    </div>
  );
}

// ─── FORM STEPS ───────────────────────────────────────────────────────────────
function Step1({ data, setData, onNext, sessionId }) {
  const ok = data.name && data.email && data.gender && data.wearing;
  return (
    <div className="screen">
      <Progress step={0} />
      <div className="step-tag">Step 1 of {TOTAL_STEPS}</div>
      <div className="step-title">The Basics</div>
      <p className="step-sub">Let's start with who you are tonight.</p>
      <div className="field"><label>Your name *</label><input value={data.name} onChange={e => setData({...data, name: e.target.value})} placeholder="First name" /></div>
      <div className="field"><label>Nickname (optional)</label><input value={data.nickname} onChange={e => setData({...data, nickname: e.target.value})} placeholder="What people call you" /></div>
      <div className="field"><label>Email address *</label><input type="email" value={data.email} onChange={e => setData({...data, email: e.target.value})} placeholder="you@email.com" /></div>
      <div className="field"><label>I am a *</label><SingleChip options={["Woman", "Man"]} selected={data.gender} onChange={v => setData({...data, gender: v.toLowerCase()})} /></div>
      <div className="field"><label>What are you wearing tonight? *</label><input value={data.wearing} onChange={e => setData({...data, wearing: e.target.value})} placeholder="e.g. black dress, red shirt" /></div>
      <div className="row-2">
        <div className="field"><label>Height (cm)</label><input type="number" value={data.height} onChange={e => setData({...data, height: e.target.value})} placeholder="e.g. 168" /></div>
        <div className="field"><label>Your age *</label><input type="number" value={data.age} onChange={e => setData({...data, age: e.target.value})} placeholder="e.g. 27" /></div>
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
      <div className="field"><label>Age range you'd like to meet</label>
        <div className="row-2">
          <input type="number" value={data.age_range_min} onChange={e => setData({...data, age_range_min: e.target.value})} placeholder="Min age" />
          <input type="number" value={data.age_range_max} onChange={e => setData({...data, age_range_max: e.target.value})} placeholder="Max age" />
        </div>
      </div>
      <div className="field"><label>Height preference (cm, optional)</label><input type="number" value={data.height_pref} onChange={e => setData({...data, height_pref: e.target.value})} placeholder="e.g. 180" /></div>
      <div className="field"><label>Relationship goal *</label><SingleChip options={REL_GOALS} selected={data.relationship_goal} onChange={v => setData({...data, relationship_goal: v})} /></div>
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
      <div className="field"><label>Interests (pick all that apply)</label><Chips options={INTERESTS} selected={data.interests || []} onChange={v => setData({...data, interests: v})} /></div>
      <div className="field" style={{marginTop: 24}}><label>Ideal weekend</label><SingleChip options={WEEKEND_VIBES} selected={data.weekend} onChange={v => setData({...data, weekend: v})} /></div>
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
      <div className="field"><label>Values you look for (up to 3)</label><Chips options={VALUES} selected={data.values || []} onChange={v => setData({...data, values: v})} max={3} /></div>
      <div className="field" style={{marginTop: 24}}><label>Your personality (pick 3)</label><Chips options={PERSONALITY} selected={data.personality || []} onChange={v => setData({...data, personality: v})} max={3} /></div>
      <div className="field" style={{marginTop: 24}}><label>Personality you're looking for (pick 3)</label><Chips options={PERSONALITY} selected={data.desired_personality || []} onChange={v => setData({...data, desired_personality: v})} max={3} /></div>
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
      <div style={{marginBottom: 28}}>
        <Rating label="Physical attraction" value={data.rating_physical || 0} onChange={v => setData({...data, rating_physical: v})} />
        <Rating label="Shared interests" value={data.rating_interests || 0} onChange={v => setData({...data, rating_interests: v})} />
        <Rating label="Sense of humor" value={data.rating_humor || 0} onChange={v => setData({...data, rating_humor: v})} />
      </div>
      <div className="field"><label>Your communication style</label><SingleChip options={COMM_STYLES} selected={data.comm_style} onChange={v => setData({...data, comm_style: v})} /></div>
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
      <div className="field"><label>Favourite music genres (pick up to 3)</label><Chips options={GENRES} selected={data.genres || []} onChange={v => setData({...data, genres: v})} max={3} /></div>
      <div className="field" style={{marginTop: 24}}><label>Ideal first date</label><SingleChip options={DATE_VIBES} selected={data.first_date} onChange={v => setData({...data, first_date: v})} /></div>
      <div className="field" style={{marginTop: 24}}><label>Deal-breakers (optional — may be shared with your match)</label><textarea value={data.dealbreakers} onChange={e => setData({...data, dealbreakers: e.target.value})} placeholder="Anything that's a hard no for you..." /></div>
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
      <p className="step-sub">One last thing before we find your match.</p>
      <div className="field"><label>Anything else you'd like your match to know? (optional)</label><textarea value={data.extra} onChange={e => setData({...data, extra: e.target.value})} placeholder="Fun fact, a question you love asking, your vibe tonight..." /></div>
      <div style={{background: "rgba(201,169,110,0.06)", border: `1px solid rgba(201,169,110,0.2)`, borderRadius: 12, padding: "16px 18px", marginBottom: 24}}>
        <div style={{fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: G.gold, marginBottom: 8}}>Privacy note</div>
        <p style={{fontSize: 13, color: G.muted}}>Your personal details stay private. Only your name, a short description, and one thing you have in common will be shared with your match. Your email will be kept for future Finding Lav events.</p>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onSubmit} disabled={loading}>{loading ? "Submitting..." : "Submit & Find My Match"}</button>
      </div>
    </div>
  );
}

// ─── WAITING SCREEN ───────────────────────────────────────────────────────────
function WaitingScreen({ name }) {
  return (
    <div className="screen">
      <div className="waiting-wrap">
        <div style={{fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: G.ember}}>Pure Lav Presents</div>
        <div style={{position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 120, height: 120}}>
          <div className="pulse-ring" style={{width: 120, height: 120}} />
          <div className="spinner" />
        </div>
        <div>
          <h2 style={{textAlign: "center", marginBottom: 8}}>You're in, {name}!</h2>
          <p style={{textAlign: "center"}}>Sit tight. The matching countdown will begin shortly. Keep an eye on the screen — and enjoy the music.</p>
        </div>
        <div style={{background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 20px", width: "100%", textAlign: "center"}}>
          <div style={{fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: G.muted, marginBottom: 6}}>Your match will appear on this screen</div>
          <p style={{fontSize: 14}}>Stay on this page and keep your screen on!</p>
        </div>
      </div>
    </div>
  );
}

// ─── NO MATCH SCREEN ─────────────────────────────────────────────────────────
function NoMatchScreen({ name }) {
  return (
    <div className="screen">
      <div className="waiting-wrap">
        <div style={{fontSize: 48}}>✦</div>
        <div>
          <h2 style={{textAlign: "center", marginBottom: 8}}>Hey {name}!</h2>
          <p style={{textAlign: "center"}}>Tonight's matches are complete but we couldn't find your perfect pair this time. Don't worry — Finding Lav happens every week and we've saved your details for next time!</p>
        </div>
        <div style={{background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 20px", width: "100%", textAlign: "center"}}>
          <div style={{fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: G.ember, marginBottom: 6}}>Follow us for the next event</div>
          <p style={{fontSize: 14}}>IG: @purelav_</p>
        </div>
      </div>
    </div>
  );
}

// ─── COUNTDOWN SCREEN ────────────────────────────────────────────────────────
function CountdownScreen({ onComplete }) {
  const [count, setCount] = useState(10);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (count <= 0) { setDone(true); setTimeout(() => onComplete(), 1500); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="screen" style={{justifyContent: "center", alignItems: "center"}}>
      <div className="countdown-wrap">
        <div style={{position: "relative", display: "flex", alignItems: "center", justifyContent: "center"}}>
          <div className="pulse-ring" />
          <div className="pulse-ring" style={{animationDelay: "0.5s"}} />
          <div className="countdown-number">{done ? "✦" : count}</div>
        </div>
        <div className="countdown-label">{done ? "Finding your match..." : "Your match is being revealed"}</div>
      </div>
    </div>
  );
}

// ─── MATCH REVEAL ────────────────────────────────────────────────────────────
function MatchRevealScreen({ matches, myId }) {
  // Find all matches involving this person
  const myMatches = matches.filter(m => m.person_a_id === myId || m.person_b_id === myId);
  const isDoubleMatch = myMatches.length > 1;

  const getTheirInfo = (match) => {
    const isA = match.person_a_id === myId;
    return {
      name: isA ? match.person_b_name : match.person_a_name,
      desc: isA ? match.person_b_description : match.person_a_description,
      wearing: isA ? match.person_b_wearing : match.person_a_wearing,
      inCommon: match.in_common,
    };
  };

  const firstName = myMatches[0] ? (myMatches[0].person_a_id === myId ? myMatches[0].person_a_name : myMatches[0].person_b_name) : "";

  return (
    <div className="screen">
      <div style={{marginBottom: 8}}>
        <div className="logo">{isDoubleMatch ? "You have 2 matches tonight!" : "It's a match"}</div>
        <h1 style={{fontSize: "clamp(36px, 12vw, 56px)"}}>Hello,<br /><span>{firstName}</span></h1>
      </div>
      <div className="divider" />
      <p style={{marginBottom: 20}}>{isDoubleMatch ? "Tonight you've been matched with two people — the choice is yours!" : "Tonight, you've been matched with:"}</p>

      {myMatches.map((match, i) => {
        const them = getTheirInfo(match);
        return (
          <div key={i} className={`match-card ${i > 0 ? "second" : ""}`}>
            {isDoubleMatch && <div style={{fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: i === 0 ? G.ember : G.gold, marginBottom: 8}}>Match {i + 1}</div>}
            <div className="match-name">{them.name}</div>
            <div className="match-desc">{them.desc}</div>
            <div className="match-wearing">
              <div className="match-wearing-label">Find them — they're wearing</div>
              <div className="match-wearing-value">{them.wearing}</div>
            </div>
            <div className="match-common" style={{marginTop: 12}}>
              <div className="match-common-label">You both share a love of</div>
              <div className="match-common-value">{them.inCommon}</div>
            </div>
          </div>
        );
      })}

      <div style={{background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center", marginTop: 8}}>
        <p style={{fontSize: 14}}>Now go find {isDoubleMatch ? "them" : "them"} — the night is yours. 🎶</p>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [activeSession, setActiveSession] = useState("");

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  async function loadData() {
    try {
      const subs = await supabase("GET", "submissions?select=*&order=created_at.asc");
      const mts = await supabase("GET", "matches?select=*&order=created_at.desc");
      setSubmissions(subs || []);
      setMatches(mts || []);
      // Get latest session
      if (subs && subs.length > 0) {
        const sessions = [...new Set(subs.map(s => s.session_id).filter(Boolean))];
        if (sessions.length > 0) setActiveSession(sessions[sessions.length - 1]);
      }
    } catch (e) { setError("Failed to load: " + e.message); }
  }

  async function handleRunMatches() {
    if (!activeSession) { setError("No active session found. Make sure guests are submitting with a session code."); return; }
    setLoading(true); setError(""); setMsg("");
    try {
      const sessionSubs = submissions.filter(s => s.session_id === activeSession);
      const newMatches = runMatching(sessionSubs);
      // Delete old matches for this session
      await supabase("DELETE", `matches?session_id=eq.${activeSession}`);
      for (const m of newMatches) {
        await supabase("POST", "matches", m);
      }
      setMsg(`✓ Matched ${newMatches.length} pairs for session "${activeSession}"!`);
      await loadData();
    } catch (e) { setError("Error: " + e.message); }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div className="screen" style={{justifyContent: "center"}}>
        <div className="logo">Admin Access</div>
        <h2 style={{marginBottom: 24}}>Finding Lav</h2>
        <div className="field"><label>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter admin password" onKeyDown={e => e.key === "Enter" && pw === ADMIN_PW && setAuthed(true)} /></div>
        <button className="btn-primary" onClick={() => { if (pw === ADMIN_PW) setAuthed(true); else setPwError("Wrong password."); }}>Enter</button>
        {pwError && <div className="error-msg" style={{marginTop: 16}}>{pwError}</div>}
        <button className="btn-ghost" style={{marginTop: 12, width: "100%"}} onClick={onBack}>← Back to app</button>
      </div>
    );
  }

  const sessionSubs = activeSession ? submissions.filter(s => s.session_id === activeSession) : [];
  const women = sessionSubs.filter(s => s.gender === "woman");
  const men = sessionSubs.filter(s => s.gender === "man");
  const diff = Math.abs(women.length - men.length);
  const majority = women.length > men.length ? "women" : "men";
  const sessionMatches = activeSession ? matches.filter(m => m.session_id === activeSession) : [];
  const allSessions = [...new Set(submissions.map(s => s.session_id).filter(Boolean))];

  return (
    <div className="admin-screen">
      <div className="admin-header">
        <div><div className="logo">Admin Panel</div><h2>Finding Lav</h2></div>
        <div style={{display: "flex", gap: 10}}>
          <button className="btn-ghost" onClick={loadData}>Refresh</button>
          <button className="btn-ghost" onClick={onBack}>← Exit</button>
        </div>
      </div>

      {/* Session selector */}
      <div style={{background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: "20px", marginBottom: 24}}>
        <div style={{fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: G.gold, marginBottom: 12}}>Event Session</div>
        <p style={{fontSize: 13, color: G.muted, marginBottom: 16}}>Each event has a unique session code. The app automatically uses today's date. Only guests from the current session will be matched together.</p>
        <div style={{display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap"}}>
          <div className="session-banner" style={{flex: 1, minWidth: 200}}>
            <div className={`session-dot ${activeSession ? "" : "inactive"}`} />
            <div>
              <div style={{fontSize: 12, color: G.muted}}>Active session</div>
              <div style={{fontSize: 16, fontWeight: 600, color: G.text}}>{activeSession || "No submissions yet"}</div>
            </div>
          </div>
          {allSessions.length > 1 && (
            <select style={{background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: "10px 14px", color: G.text, fontFamily: "'DM Sans', sans-serif", fontSize: 14}} value={activeSession} onChange={e => setActiveSession(e.target.value)}>
              {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{sessionSubs.length}</div><div className="stat-lbl">Total</div></div>
        <div className="stat-card"><div className="stat-num" style={{color: G.coral}}>{women.length}</div><div className="stat-lbl">Women</div></div>
        <div className="stat-card"><div className="stat-num" style={{color: G.gold}}>{men.length}</div><div className="stat-lbl">Men</div></div>
        <div className="stat-card"><div className="stat-num" style={{color: G.success}}>{sessionMatches.length}</div><div className="stat-lbl">Matches</div></div>
      </div>

      {/* Warnings */}
      {diff > 0 && sessionSubs.length > 0 && (
        <div className="warning-msg">
          ⚠️ You have {diff} more {majority} than {majority === "women" ? "men" : "women"} this session. The {diff} extra {majority} will each receive a second match instead of going unmatched.
        </div>
      )}

      {msg && <div className="success-msg">{msg}</div>}
      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary" onClick={handleRunMatches} disabled={loading || sessionSubs.length === 0} style={{marginBottom: 28}}>
        {loading ? "Matching..." : `⚡ Run Matching — Session: ${activeSession || "none"}`}
      </button>

      {/* Matches table */}
      {sessionMatches.length > 0 && (
        <>
          <h3>Matched Pairs — {activeSession} ({sessionMatches.length})</h3>
          <div style={{overflowX: "auto", marginBottom: 32}}>
            <table className="match-table">
              <thead><tr><th>Person A</th><th>Person B</th><th>In Common</th><th>Score</th><th>Type</th></tr></thead>
              <tbody>
                {sessionMatches.map((m, i) => (
                  <tr key={i}>
                    <td><strong>{m.person_a_name}</strong><div style={{fontSize: 12, color: G.muted}}>{m.person_a_email}</div></td>
                    <td><strong>{m.person_b_name}</strong><div style={{fontSize: 12, color: G.muted}}>{m.person_b_email}</div></td>
                    <td><span className="tag tag-ember">{m.in_common}</span></td>
                    <td><span className="tag tag-gold">{m.score}</span></td>
                    <td><span className={`tag ${m.is_second_match ? "tag-gold" : "tag-success"}`}>{m.is_second_match ? "2nd" : "1st"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* All sessions summary */}
      {allSessions.length > 1 && (
        <>
          <h3>All Sessions ({allSessions.length})</h3>
          <div style={{overflowX: "auto", marginBottom: 32}}>
            <table className="match-table">
              <thead><tr><th>Session</th><th>Submissions</th><th>Matches</th></tr></thead>
              <tbody>
                {allSessions.map((s, i) => {
                  const sSubs = submissions.filter(sub => sub.session_id === s);
                  const sMatches = matches.filter(m => m.session_id === s);
                  return (
                    <tr key={i}>
                      <td><strong>{s}</strong></td>
                      <td>{sSubs.length}</td>
                      <td>{sMatches.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Submissions table */}
      {sessionSubs.length > 0 && (
        <>
          <h3>Submissions — {activeSession} ({sessionSubs.length})</h3>
          <div style={{overflowX: "auto"}}>
            <table className="match-table">
              <thead><tr><th>Name</th><th>Gender</th><th>Age</th><th>Email</th><th>Wearing</th></tr></thead>
              <tbody>
                {sessionSubs.map((s, i) => (
                  <tr key={i}>
                    <td>{s.name}</td>
                    <td><span className={`tag ${s.gender === "woman" ? "tag-ember" : "tag-gold"}`}>{s.gender}</span></td>
                    <td>{s.age}</td>
                    <td style={{fontSize: 12}}>{s.email}</td>
                    <td style={{fontSize: 13, color: G.muted}}>{s.wearing}</td>
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
  const [view, setView] = useState("landing");
  const [step, setStep] = useState(0);
  const [submissionId, setSubmissionId] = useState(null);
  const [myMatches, setMyMatches] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [noMatch, setNoMatch] = useState(false);

  // Generate session ID based on today's date e.g. "FL-2026-03-01"
  const todaySession = `FL-${new Date().toISOString().slice(0, 10)}`;

  const [formData, setFormData] = useState({
    name: "", nickname: "", email: "", gender: "",
    wearing: "", height: "", age: "",
    age_range_min: "19", age_range_max: "40", height_pref: "",
    relationship_goal: "", interests: [], weekend: "",
    values: [], personality: [], desired_personality: [],
    rating_physical: 3, rating_interests: 3, rating_humor: 3,
    comm_style: "", genres: [], first_date: "",
    dealbreakers: "", extra: "",
    session_id: todaySession,
  });

  useEffect(() => {
    if (window.location.hash === "#admin") setView("admin");
  }, []);

  // Poll for matches after submission
  useEffect(() => {
    if (view !== "waiting" || !submissionId) return;
    const interval = setInterval(async () => {
      try {
        const allMatches = await supabase("GET", `matches?select=*&session_id=eq.${todaySession}`);
        if (allMatches && allMatches.length > 0) {
          const mine = allMatches.filter(m => m.person_a_id === submissionId || m.person_b_id === submissionId);
          if (mine.length > 0) {
            setMyMatches(mine);
            setView("countdown");
            clearInterval(interval);
          } else {
            // Check if matching has been run but this person wasn't matched
            const anyMatch = allMatches.find(m => m.session_id === todaySession);
            if (anyMatch) {
              // Matching was run but person wasn't included — show no match screen
              setNoMatch(true);
              setView("reveal");
              clearInterval(interval);
            }
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [view, submissionId]);

  async function handleSubmit() {
    setSubmitting(true); setSubmitError("");
    try {
      const result = await supabase("POST", "submissions", formData);
      if (result && result.length > 0) {
        setSubmissionId(result[0].id);
        setView("waiting");
      }
    } catch (e) { setSubmitError("Something went wrong. Please try again. (" + e.message + ")"); }
    setSubmitting(false);
  }

  const steps = [Step1, Step2, Step3, Step4, Step5, Step6, Step7];
  const StepComponent = steps[step];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="app">
        {view === "landing" && (
          <div className="screen" style={{justifyContent: "center"}}>
            <div className="logo">Pure Lav Presents</div>
            <h1>Finding<br /><span>Lav</span></h1>
            <div className="divider" />
            <p style={{marginBottom: 40}}>Welcome to Johannesburg's most unique dating experience. Fill in your details and let the night find your match.</p>
            <button className="btn-primary" onClick={() => setView("form")}>Begin</button>
            <p style={{textAlign: "center", marginTop: 16, fontSize: 13}}>Your details are private and secure</p>
            <div style={{position: "fixed", bottom: 16, right: 20}}>
              <button onClick={() => setView("admin")} style={{background: "none", border: "none", color: G.border, fontSize: 11, cursor: "pointer"}}>admin</button>
            </div>
          </div>
        )}
        {view === "form" && (
          <StepComponent
            data={formData} setData={setFormData}
            sessionId={todaySession}
            onNext={() => { if (step < TOTAL_STEPS - 1) setStep(step + 1); }}
            onBack={() => { if (step > 0) setStep(step - 1); else setView("landing"); }}
            onSubmit={handleSubmit} loading={submitting} error={submitError}
          />
        )}
        {view === "waiting" && <WaitingScreen name={formData.name} />}
        {view === "countdown" && <CountdownScreen onComplete={() => setView("reveal")} />}
        {view === "reveal" && !noMatch && myMatches.length > 0 && <MatchRevealScreen matches={myMatches} myId={submissionId} />}
        {view === "reveal" && noMatch && <NoMatchScreen name={formData.name} />}
        {view === "admin" && <AdminPanel onBack={() => setView("landing")} />}
      </div>
    </>
  );
}
