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
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
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
    if (diff <= 5) score += 10; else if (diff <= 10) score += 5;
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
  const [majority, minority] = groupA.length >= groupB.length ? [groupA, groupB] : [groupB, groupA];
  const matches = [];
  const matchCounts = {};
  submissions.forEach(s => { matchCounts[s.id] = 0; });
  const usedMajority = new Set();
  for (const person of [...minority].sort((a, b) => a.id - b.id)) {
    let bestScore = -1, bestMatch = null, bestCommon = null;
    for (const candidate of majority) {
      if (usedMajority.has(candidate.id)) continue;
      const { score, inCommon } = scoreMatch(person, candidate);
      const personAge = parseInt(person.age) || 25;
      const mutual = personAge >= (parseInt(candidate.age_range_min) || 18) && personAge <= (parseInt(candidate.age_range_max) || 99);
      const finalScore = mutual ? score + 10 : score;
      if (finalScore > bestScore) { bestScore = finalScore; bestMatch = candidate; bestCommon = inCommon; }
    }
    if (bestMatch) {
      matches.push({ person_a_id: person.id, person_b_id: bestMatch.id, person_a_name: person.name, person_b_name: bestMatch.name, person_a_email: person.email, person_b_email: bestMatch.email, person_a_wearing: person.wearing, person_b_wearing: bestMatch.wearing, person_a_gender: person.gender, person_b_gender: bestMatch.gender, person_a_description: `${person.age} years old, ${person.height}cm`, person_b_description: `${bestMatch.age} years old, ${bestMatch.height}cm`, in_common: bestCommon, score: bestScore, is_second_match: false, session_id: person.session_id });
      usedMajority.add(bestMatch.id);
      matchCounts[person.id] = (matchCounts[person.id] || 0) + 1;
      matchCounts[bestMatch.id] = (matchCounts[bestMatch.id] || 0) + 1;
    }
  }
  for (const person of majority.filter(p => !usedMajority.has(p.id))) {
    let bestScore = -1, bestMatch = null, bestCommon = null;
    for (const candidate of minority) {
      if ((matchCounts[candidate.id] || 0) >= 2) continue;
      const { score, inCommon } = scoreMatch(person, candidate);
      if (score > bestScore) { bestScore = score; bestMatch = candidate; bestCommon = inCommon; }
    }
    if (bestMatch) {
      matches.push({ person_a_id: bestMatch.id, person_b_id: person.id, person_a_name: bestMatch.name, person_b_name: person.name, person_a_email: bestMatch.email, person_b_email: person.email, person_a_wearing: bestMatch.wearing, person_b_wearing: person.wearing, person_a_gender: bestMatch.gender, person_b_gender: person.gender, person_a_description: `${bestMatch.age} years old, ${bestMatch.height}cm`, person_b_description: `${person.age} years old, ${person.height}cm`, in_common: bestCommon, score: bestScore, is_second_match: true, session_id: person.session_id });
      matchCounts[bestMatch.id] = (matchCounts[bestMatch.id] || 0) + 1;
      matchCounts[person.id] = (matchCounts[person.id] || 0) + 1;
    }
  }
  return matches;
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const G = {
  green: "#1c3d2a",
  greenDark: "#142d1e",
  greenLight: "#254d36",
  cream: "#f5f0e6",
  creamDark: "#e8e0d0",
  wine: "#7a2535",
  gold: "#b8933a",
  text: "#1a2e20",
  muted: "#5a7060",
  white: "#faf8f2",
};

// ─── GEOMETRIC PATTERN SVG ───────────────────────────────────────────────────
const archPattern = `
  <svg xmlns='http://www.w3.org/2000/svg' width='40' height='60'>
    <rect width='40' height='60' fill='none'/>
    <path d='M0,60 L0,30 Q20,0 40,30 L40,60' fill='none' stroke='rgba(245,240,230,0.12)' stroke-width='1'/>
  </svg>
`;
const archPatternEncoded = `url("data:image/svg+xml,${encodeURIComponent(archPattern)}")`;

const checkerPattern = `
  <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'>
    <rect width='10' height='10' fill='rgba(245,240,230,0.08)'/>
    <rect x='10' y='10' width='10' height='10' fill='rgba(245,240,230,0.08)'/>
  </svg>
`;
const checkerEncoded = `url("data:image/svg+xml,${encodeURIComponent(checkerPattern)}")`;

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${G.green};
    color: ${G.cream};
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app {
    min-height: 100vh;
    background: ${G.green};
    background-image: ${archPatternEncoded};
  }

  /* ── SCREEN WRAPPER ── */
  .screen {
    position: relative;
    max-width: 460px;
    margin: 0 auto;
    padding: 32px 24px 56px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── DECORATIVE BORDER FRAME ── */
  .frame {
    border: 1px solid rgba(245,240,230,0.2);
    border-radius: 2px;
    position: relative;
    padding: 28px 24px;
    margin-bottom: 24px;
  }
  .frame::before, .frame::after {
    content: '◆';
    position: absolute;
    font-size: 10px;
    color: rgba(245,240,230,0.3);
  }
  .frame::before { top: -7px; left: 50%; transform: translateX(-50%); }
  .frame::after { bottom: -7px; left: 50%; transform: translateX(-50%); }

  .corner-tl, .corner-tr, .corner-bl, .corner-br {
    position: absolute;
    width: 12px;
    height: 12px;
    border-color: rgba(245,240,230,0.35);
    border-style: solid;
  }
  .corner-tl { top: -1px; left: -1px; border-width: 1px 0 0 1px; }
  .corner-tr { top: -1px; right: -1px; border-width: 1px 1px 0 0; }
  .corner-bl { bottom: -1px; left: -1px; border-width: 0 0 1px 1px; }
  .corner-br { bottom: -1px; right: -1px; border-width: 0 1px 1px 0; }

  /* ── TYPOGRAPHY ── */
  .eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: rgba(245,240,230,0.5);
    margin-bottom: 10px;
  }

  .display {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: clamp(52px, 16vw, 80px);
    line-height: 0.92;
    color: ${G.cream};
    letter-spacing: -0.01em;
  }
  .display em {
    font-style: italic;
    color: rgba(245,240,230,0.7);
  }

  .heading {
    font-family: 'Playfair Display', serif;
    font-weight: 600;
    font-size: 28px;
    color: ${G.cream};
    line-height: 1.2;
  }
  .heading em { font-style: italic; }

  .script {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 22px;
    font-weight: 300;
    color: rgba(245,240,230,0.7);
    letter-spacing: 0.02em;
  }

  .step-label {
    font-size: 10px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(245,240,230,0.7);
    margin-bottom: 6px;
  }
  .step-title {
    font-family: 'Playfair Display', serif;
    font-weight: 600;
    font-size: 26px;
    color: ${G.cream};
    margin-bottom: 4px;
  }
  .step-sub {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 17px;
    color: rgba(245,240,230,0.85);
    margin-bottom: 28px;
  }

  p { color: rgba(245,240,230,0.85); font-size: 15px; line-height: 1.65; }

  /* ── ORNAMENT DIVIDER ── */
  .ornament {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 16px 0;
    color: rgba(245,240,230,0.25);
    font-size: 12px;
    letter-spacing: 0.2em;
  }
  .ornament::before, .ornament::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(245,240,230,0.15);
  }

  /* ── PROGRESS BAR ── */
  .progress-wrap { display: flex; gap: 5px; margin-bottom: 28px; }
  .progress-seg {
    height: 2px;
    flex: 1;
    background: rgba(245,240,230,0.12);
    border-radius: 1px;
    transition: background 0.4s ease;
  }
  .progress-seg.done { background: rgba(245,240,230,0.5); }
  .progress-seg.active { background: ${G.cream}; }

  /* ── FORM FIELDS ── */
  .field { margin-bottom: 18px; }
  .field label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(245,240,230,0.75);
    margin-bottom: 8px;
    font-weight: 500;
  }
  .field input, .field select, .field textarea {
    width: 100%;
    background: rgba(245,240,230,0.12);
    border: 1px solid rgba(245,240,230,0.35);
    border-radius: 2px;
    padding: 13px 16px;
    color: ${G.cream};
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .field input:focus, .field select:focus, .field textarea:focus {
    border-color: rgba(245,240,230,0.75);
    background: rgba(245,240,230,0.16);
  }
  .field input::placeholder { color: rgba(245,240,230,0.4); }
  .field select option { background: ${G.greenDark}; color: ${G.cream}; }
  .field textarea { resize: vertical; min-height: 80px; }
  .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* ── CHIPS ── */
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    padding: 8px 16px;
    border-radius: 2px;
    border: 1px solid rgba(245,240,230,0.35);
    background: rgba(245,240,230,0.07);
    color: rgba(245,240,230,0.8);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.02em;
  }
  .chip:hover { border-color: rgba(245,240,230,0.7); color: ${G.cream}; }
  .chip.selected {
    background: rgba(245,240,230,0.18);
    border-color: rgba(245,240,230,0.85);
    color: ${G.cream};
    font-weight: 500;
  }

  /* ── RATINGS ── */
  .rating-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .rating-label { font-size: 14px; color: rgba(245,240,230,0.85); flex: 1; }
  .rating-dots { display: flex; gap: 6px; }
  .rating-dot {
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(245,240,230,0.35);
    background: transparent;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; color: rgba(245,240,230,0.6);
    transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .rating-dot.active { background: rgba(245,240,230,0.2); border-color: rgba(245,240,230,0.85); color: ${G.cream}; }

  /* ── BUTTONS ── */
  .btn-primary {
    width: 100%;
    padding: 16px;
    background: ${G.cream};
    color: ${G.green};
    border: none;
    border-radius: 2px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }
  .btn-primary:hover { background: ${G.creamDark}; }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    color: rgba(245,240,230,0.45);
    border: 1px solid rgba(245,240,230,0.18);
    border-radius: 2px;
    padding: 14px 20px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-ghost:hover { border-color: rgba(245,240,230,0.4); color: ${G.cream}; }

  .btn-wine {
    background: ${G.wine};
    color: ${G.cream};
    border: none;
    border-radius: 2px;
    padding: 16px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .nav-row { display: flex; gap: 10px; margin-top: 12px; }
  .nav-row .btn-ghost { flex: 0 0 auto; }
  .nav-row .btn-primary { flex: 1; }

  /* ── WAITING ── */
  .waiting-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 24px;
  }

  .spinner-ring {
    width: 56px; height: 56px;
    border: 1.5px solid rgba(245,240,230,0.15);
    border-top-color: rgba(245,240,230,0.6);
    border-radius: 50%;
    animation: spin 1.4s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── COUNTDOWN ── */
  .countdown-number {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: clamp(110px, 38vw, 200px);
    line-height: 1;
    color: ${G.cream};
  }
  .countdown-label {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 18px;
    color: rgba(245,240,230,0.5);
    letter-spacing: 0.05em;
    margin-top: 16px;
  }

  /* ── CONFETTI ── */
  @keyframes confettiFall {
    0% { transform: translateY(-80px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
  }
  .confetti-piece {
    position: fixed; top: 0;
    pointer-events: none; z-index: 999;
    animation: confettiFall linear forwards;
  }

  /* ── MATCH CARD ── */
  .match-card {
    border: 1px solid rgba(245,240,230,0.2);
    border-radius: 2px;
    padding: 28px 24px;
    margin: 14px 0;
    position: relative;
    background: rgba(245,240,230,0.04);
  }
  .match-card-accent {
    position: absolute;
    top: 0; left: 24px; right: 24px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(245,240,230,0.5), transparent);
  }
  .match-name {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: 46px;
    color: ${G.cream};
    line-height: 1;
    margin-bottom: 6px;
  }
  .match-desc {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 16px;
    color: rgba(245,240,230,0.5);
    margin-bottom: 18px;
  }
  .info-block {
    border: 1px solid rgba(245,240,230,0.12);
    border-radius: 2px;
    padding: 14px 16px;
    margin-top: 10px;
    background: rgba(245,240,230,0.03);
  }
  .info-block-label {
    font-size: 9px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(245,240,230,0.6);
    margin-bottom: 5px;
    font-weight: 500;
  }
  .info-block-value {
    font-size: 15px;
    color: ${G.cream};
  }

  /* ── ADMIN ── */
  .admin-wrap {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 24px;
  }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
  .stat-card {
    border: 1px solid rgba(245,240,230,0.12);
    border-radius: 2px;
    padding: 16px;
    text-align: center;
    background: rgba(245,240,230,0.03);
  }
  .stat-num {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: 36px;
    color: ${G.cream};
  }
  .stat-lbl { font-size: 10px; color: rgba(245,240,230,0.35); text-transform: uppercase; letter-spacing: 0.15em; }
  .match-table { width: 100%; border-collapse: collapse; }
  .match-table th { text-align: left; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(245,240,230,0.35); padding: 10px 12px; border-bottom: 1px solid rgba(245,240,230,0.1); }
  .match-table td { padding: 13px 12px; border-bottom: 1px solid rgba(245,240,230,0.07); font-size: 14px; color: rgba(245,240,230,0.8); }
  .tag { display: inline-block; padding: 3px 10px; border-radius: 1px; font-size: 11px; font-weight: 500; letter-spacing: 0.05em; border: 1px solid; }
  .tag-cream { border-color: rgba(245,240,230,0.3); color: rgba(245,240,230,0.7); }
  .tag-wine { border-color: rgba(122,37,53,0.6); color: #c4697a; background: rgba(122,37,53,0.15); }
  .tag-gold { border-color: rgba(184,147,58,0.4); color: #d4aa55; background: rgba(184,147,58,0.1); }
  .error-msg { background: rgba(122,37,53,0.15); border: 1px solid rgba(122,37,53,0.4); border-radius: 2px; padding: 12px 16px; font-size: 14px; color: #c4697a; margin-bottom: 16px; }
  .success-msg { background: rgba(245,240,230,0.06); border: 1px solid rgba(245,240,230,0.2); border-radius: 2px; padding: 12px 16px; font-size: 14px; color: rgba(245,240,230,0.8); margin-bottom: 16px; }
  .warning-msg { background: rgba(184,147,58,0.1); border: 1px solid rgba(184,147,58,0.3); border-radius: 2px; padding: 12px 16px; font-size: 14px; color: #d4aa55; margin-bottom: 16px; }

  /* ── LANDING PATTERN STRIP ── */
  .pattern-strip {
    width: 100%;
    height: 8px;
    background-image: ${checkerEncoded};
    background-size: 20px 20px;
    opacity: 0.6;
    margin: 20px 0;
  }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const INTERESTS = ["Music","Fitness","Art","Travel","Books","Food","Spirituality","Entrepreneurship","Fashion","Tech","Sports","Nature","Film","Gaming","Cooking"];
const VALUES = ["Loyalty","Humour","Ambition","Creativity","Kindness","Integrity","Adventure","Family","Independence","Growth"];
const PERSONALITY = ["Outgoing","Introspective","Adventurous","Thoughtful","Witty","Spontaneous","Calm","Passionate","Caring","Bold"];
const GENRES = ["Amapiano","Afrotech","Tech House","R&B","Hip Hop","Soul","Jazz","Classical","Afrobeats","House","Dancehall"];
const COMM_STYLES = ["Direct & clear","Playful & teasing","Thoughtful & deep","Light & fun"];
const WEEKEND_VIBES = ["Big social night out","Chill gathering at home","Outdoor adventure","Exploring the city"];
const REL_GOALS = ["Casual connection","Something serious","Open to wherever it goes"];
const DATE_VIBES = ["Picnic","Dinner","Concert","Outdoor activity"];
const TOTAL_STEPS = 7;
const ADMIN_PW = "purelav2025";

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Frame({ children }) {
  return (
    <div className="frame">
      <div className="corner-tl"/><div className="corner-tr"/>
      <div className="corner-bl"/><div className="corner-br"/>
      {children}
    </div>
  );
}

function Progress({ step }) {
  return (
    <div className="progress-wrap">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} className={`progress-seg ${i < step ? "done" : i === step ? "active" : ""}`} />
      ))}
    </div>
  );
}

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

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function Confetti() {
  const emojis = ["🎉","💕","✨","🥂","💫","❤️","🎊","💖","🌟","💝"];
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i, emoji: emojis[i % emojis.length],
    left: Math.random() * 100, delay: Math.random() * 1.5,
    duration: 1.8 + Math.random() * 2, size: 18 + Math.floor(Math.random() * 22),
  }));
  return <>{pieces.map(p => <div key={p.id} className="confetti-piece" style={{ left: `${p.left}%`, fontSize: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}>{p.emoji}</div>)}</>;
}

// ─── FORM STEPS ───────────────────────────────────────────────────────────────
function Step1({ data, setData, onNext, onBack }) {
  const ok = data.name && data.email && data.gender && data.wearing && data.age;
  return (
    <div className="screen">
      <Progress step={0} />
      <div className="step-label">Step 1 of {TOTAL_STEPS}</div>
      <div className="step-title">The Basics</div>
      <div className="step-sub">Let's begin with who you are tonight.</div>
      <div className="field"><label>Your name *</label><input value={data.name} onChange={e => setData({...data, name: e.target.value})} placeholder="First name" /></div>
      <div className="field"><label>Nickname (optional)</label><input value={data.nickname} onChange={e => setData({...data, nickname: e.target.value})} placeholder="What people call you" /></div>
      <div className="field"><label>Email address *</label><input type="email" value={data.email} onChange={e => setData({...data, email: e.target.value})} placeholder="you@email.com" /></div>
      <div className="field"><label>I am a *</label><SingleChip options={["Woman","Man"]} selected={data.gender} onChange={v => setData({...data, gender: v.toLowerCase()})} /></div>
      <div className="field"><label>What are you wearing tonight? *</label><input value={data.wearing} onChange={e => setData({...data, wearing: e.target.value})} placeholder="e.g. green blazer, black dress" /></div>
      <div className="row-2">
        <div className="field"><label>Your age *</label><input type="number" value={data.age} onChange={e => setData({...data, age: e.target.value})} placeholder="e.g. 28" /></div>
        <div className="field"><label>Height (cm)</label><input type="number" value={data.height} onChange={e => setData({...data, height: e.target.value})} placeholder="e.g. 170" /></div>
      </div>
      <button className="btn-primary" onClick={onNext} disabled={!ok}>Continue</button>
    </div>
  );
}

function Step2({ data, setData, onNext, onBack }) {
  return (
    <div className="screen">
      <Progress step={1} />
      <div className="step-label">Step 2 of {TOTAL_STEPS}</div>
      <div className="step-title">Your Preferences</div>
      <div className="step-sub">Who are you hoping to meet tonight?</div>
      <div className="field"><label>Age range you'd like to meet</label>
        <div className="row-2">
          <input type="number" value={data.age_range_min} onChange={e => setData({...data, age_range_min: e.target.value})} placeholder="Min age" />
          <input type="number" value={data.age_range_max} onChange={e => setData({...data, age_range_max: e.target.value})} placeholder="Max age" />
        </div>
      </div>
      <div className="field"><label>Height preference (cm — optional)</label><input type="number" value={data.height_pref} onChange={e => setData({...data, height_pref: e.target.value})} placeholder="e.g. 180" /></div>
      <div className="field"><label>What are you looking for? *</label><SingleChip options={REL_GOALS} selected={data.relationship_goal} onChange={v => setData({...data, relationship_goal: v})} /></div>
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
      <div className="step-label">Step 3 of {TOTAL_STEPS}</div>
      <div className="step-title">Your World</div>
      <div className="step-sub">Pick everything that speaks to you.</div>
      <div className="field"><label>Interests — pick all that apply</label><Chips options={INTERESTS} selected={data.interests || []} onChange={v => setData({...data, interests: v})} /></div>
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
      <div className="step-label">Step 4 of {TOTAL_STEPS}</div>
      <div className="step-title">Values & Character</div>
      <div className="step-sub">What matters to you in a connection?</div>
      <div className="field"><label>Values you look for — up to 3</label><Chips options={VALUES} selected={data.values || []} onChange={v => setData({...data, values: v})} max={3} /></div>
      <div className="field" style={{marginTop: 24}}><label>Your personality — pick 3</label><Chips options={PERSONALITY} selected={data.personality || []} onChange={v => setData({...data, personality: v})} max={3} /></div>
      <div className="field" style={{marginTop: 24}}><label>Personality you're drawn to — pick 3</label><Chips options={PERSONALITY} selected={data.desired_personality || []} onChange={v => setData({...data, desired_personality: v})} max={3} /></div>
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
      <div className="step-label">Step 5 of {TOTAL_STEPS}</div>
      <div className="step-title">Vibe Check</div>
      <div className="step-sub">How important are these to you in someone?</div>
      <div style={{marginBottom: 24}}>
        <Rating label="Physical attraction" value={data.rating_physical || 0} onChange={v => setData({...data, rating_physical: v})} />
        <Rating label="Shared interests" value={data.rating_interests || 0} onChange={v => setData({...data, rating_interests: v})} />
        <Rating label="Sense of humour" value={data.rating_humor || 0} onChange={v => setData({...data, rating_humor: v})} />
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
      <div className="step-label">Step 6 of {TOTAL_STEPS}</div>
      <div className="step-title">The Fun Part</div>
      <div className="step-sub">The details that actually spark conversation.</div>
      <div className="field"><label>Favourite music genres — up to 3</label><Chips options={GENRES} selected={data.genres || []} onChange={v => setData({...data, genres: v})} max={3} /></div>
      <div className="field" style={{marginTop: 24}}><label>Ideal first date</label><SingleChip options={DATE_VIBES} selected={data.first_date} onChange={v => setData({...data, first_date: v})} /></div>
      <div className="field" style={{marginTop: 24}}><label>Deal-breakers (optional)</label><textarea value={data.dealbreakers} onChange={e => setData({...data, dealbreakers: e.target.value})} placeholder="Anything that's a hard no for you..." /></div>
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
      <div className="step-label">Step 7 of {TOTAL_STEPS}</div>
      <div className="step-title">Almost There</div>
      <div className="step-sub">One last thing before we find your connection.</div>
      <div className="field"><label>Anything else you'd like your match to know?</label><textarea value={data.extra} onChange={e => setData({...data, extra: e.target.value})} placeholder="A fun fact, a question you love asking, your energy tonight..." /></div>
      <Frame>
        <div className="eyebrow" style={{marginBottom: 8}}>A note on privacy</div>
        <p style={{fontSize: 13}}>Your personal details stay private. Only your name, a brief description, and one thing you have in common will be shared with your match. Your email will be kept securely for future Lav Connects events.</p>
      </Frame>
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
        <div className="eyebrow" style={{letterSpacing: "0.4em"}}>Lav Studios Presents</div>
        <div style={{fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 700, color: G.cream, lineHeight: 1, textAlign: "center"}}>
          Lav<br /><em style={{fontStyle: "italic", color: "rgba(245,240,230,0.6)"}}>Connects</em>
        </div>
        <div className="spinner-ring" />
        <div>
          <div style={{fontFamily: "'Playfair Display', serif", fontSize: 22, textAlign: "center", marginBottom: 8, color: G.cream}}>
            You're in, {name}.
          </div>
          <p style={{textAlign: "center", fontSize: 14}}>Sit tight and enjoy the music. Your match will appear on this screen shortly — keep it open!</p>
        </div>
        <Frame>
          <div className="eyebrow" style={{textAlign: "center", marginBottom: 6}}>Keep this screen on</div>
          <p style={{textAlign: "center", fontSize: 13}}>Your match reveal will happen right here.</p>
        </Frame>
      </div>
    </div>
  );
}

// ─── NO MATCH SCREEN ─────────────────────────────────────────────────────────
function NoMatchScreen({ name }) {
  return (
    <div className="screen">
      <div className="waiting-wrap">
        <div className="ornament">✦ ✦ ✦</div>
        <div style={{fontFamily: "'Playfair Display', serif", fontSize: 28, textAlign: "center", color: G.cream}}>
          Thank you,<br /><em style={{fontStyle: "italic"}}>{name}</em>
        </div>
        <p style={{textAlign: "center"}}>Tonight's matches are complete. We couldn't pair you this round, but your details are saved and we'd love to see you at the next event.</p>
        <Frame>
          <div className="eyebrow" style={{textAlign: "center", marginBottom: 6}}>Follow us for the next event</div>
          <p style={{textAlign: "center", fontSize: 14}}>@purelav_ on Instagram</p>
        </Frame>
      </div>
    </div>
  );
}

// ─── COUNTDOWN SCREEN ────────────────────────────────────────────────────────
function CountdownScreen({ onComplete }) {
  const [count, setCount] = useState(10);
  const [done, setDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (count <= 0) {
      setDone(true); setShowConfetti(true);
      setTimeout(() => onComplete(), 2500); return;
    }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="screen" style={{justifyContent: "center", alignItems: "center"}}>
      {showConfetti && <Confetti />}
      <div style={{display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"}}>
        <div className="eyebrow" style={{marginBottom: 16}}>Lav Connects</div>
        <div className="countdown-number">{done ? "✦" : count}</div>
        <div className="countdown-label">{done ? "Your match is here..." : "Your match is being revealed"}</div>
      </div>
    </div>
  );
}

// ─── MATCH REVEAL ────────────────────────────────────────────────────────────
function MatchRevealScreen({ matches, myId }) {
  const myMatches = matches.filter(m => m.person_a_id === myId || m.person_b_id === myId);
  const isDouble = myMatches.length > 1;
  const myName = myMatches[0] ? (myMatches[0].person_a_id === myId ? myMatches[0].person_a_name : myMatches[0].person_b_name) : "";

  const getTheirInfo = (match) => {
    const isA = match.person_a_id === myId;
    return {
      name: isA ? match.person_b_name : match.person_a_name,
      desc: isA ? match.person_b_description : match.person_a_description,
      wearing: isA ? match.person_b_wearing : match.person_a_wearing,
      inCommon: match.in_common,
    };
  };

  return (
    <div className="screen">
      <div className="ornament">✦ ✦ ✦</div>
      <div className="eyebrow">Lav Connects — Your Match</div>
      <div style={{fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "clamp(38px, 12vw, 56px)", color: G.cream, lineHeight: 1, marginBottom: 6}}>
        Hello,<br /><em style={{fontStyle: "italic"}}>{myName}</em>
      </div>
      <div className="pattern-strip" />
      <p style={{marginBottom: 4, fontSize: 14}}>
        {isDouble ? "Tonight you've been matched with two people — the choice is yours." : "Tonight, you've been connected with:"}
      </p>

      {myMatches.map((match, i) => {
        const them = getTheirInfo(match);
        return (
          <div key={i} className="match-card">
            <div className="match-card-accent" />
            {isDouble && <div className="eyebrow" style={{marginBottom: 8}}>Match {i + 1}</div>}
            <div className="match-name">{them.name}</div>
            <div className="match-desc">{them.desc}</div>
            <div className="info-block">
              <div className="info-block-label">You'll find them wearing</div>
              <div className="info-block-value">{them.wearing}</div>
            </div>
            <div className="info-block">
              <div className="info-block-label">You both share a love of</div>
              <div className="info-block-value">{them.inCommon}</div>
            </div>
          </div>
        );
      })}

      <div className="ornament" style={{marginTop: 16}}>✦</div>
      <p style={{textAlign: "center", fontSize: 13, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 17}}>
        The night is yours. Go find them. 🥂
      </p>
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
  const [activeSession, setActiveSession] = useState("");

  useEffect(() => { if (authed) loadData(); }, [authed]);

  async function loadData() {
    try {
      const subs = await supabase("GET", "submissions?select=*&order=created_at.asc");
      const mts = await supabase("GET", "matches?select=*&order=created_at.desc");
      setSubmissions(subs || []);
      setMatches(mts || []);
      if (subs && subs.length > 0) {
        const sessions = [...new Set(subs.map(s => s.session_id).filter(Boolean))];
        if (sessions.length > 0) setActiveSession(sessions[sessions.length - 1]);
      }
    } catch (e) { setError("Failed to load: " + e.message); }
  }

  async function handleRunMatches() {
    if (!activeSession) { setError("No active session found."); return; }
    setLoading(true); setError(""); setMsg("");
    try {
      const sessionSubs = submissions.filter(s => s.session_id === activeSession);
      const newMatches = runMatching(sessionSubs);
      await supabase("DELETE", `matches?session_id=eq.${activeSession}`);
      for (const m of newMatches) await supabase("POST", "matches", m);
      setMsg(`✓ Matched ${newMatches.length} pairs for session "${activeSession}"`);
      await loadData();
    } catch (e) { setError("Error: " + e.message); }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div className="screen" style={{justifyContent: "center"}}>
        <div className="eyebrow" style={{textAlign: "center", marginBottom: 8}}>Admin Access</div>
        <div className="heading" style={{textAlign: "center", marginBottom: 32}}>Lav Connects</div>
        <div className="field"><label>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter admin password" onKeyDown={e => e.key === "Enter" && pw === ADMIN_PW && setAuthed(true)} /></div>
        <button className="btn-primary" onClick={() => { if (pw === ADMIN_PW) setAuthed(true); else setPwError("Incorrect password."); }}>Enter</button>
        {pwError && <div className="error-msg" style={{marginTop: 16}}>{pwError}</div>}
        <button className="btn-ghost" style={{marginTop: 12, width: "100%"}} onClick={onBack}>← Back</button>
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
    <div className="admin-wrap">
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 20, borderBottom: "1px solid rgba(245,240,230,0.1)"}}>
        <div><div className="eyebrow">Admin Panel</div><div className="heading">Lav Connects</div></div>
        <div style={{display: "flex", gap: 10}}>
          <button className="btn-ghost" onClick={loadData}>Refresh</button>
          <button className="btn-ghost" onClick={onBack}>Exit</button>
        </div>
      </div>

      <div style={{border: "1px solid rgba(245,240,230,0.1)", borderRadius: 2, padding: "18px 20px", marginBottom: 24, background: "rgba(245,240,230,0.03)"}}>
        <div className="eyebrow" style={{marginBottom: 10}}>Current Session</div>
        <div style={{display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap"}}>
          <div style={{fontFamily: "'Playfair Display', serif", fontSize: 22, color: G.cream}}>{activeSession || "No submissions yet"}</div>
          {allSessions.length > 1 && (
            <select style={{background: G.greenDark, border: "1px solid rgba(245,240,230,0.15)", borderRadius: 2, padding: "8px 12px", color: G.cream, fontFamily: "'DM Sans', sans-serif", fontSize: 13}} value={activeSession} onChange={e => setActiveSession(e.target.value)}>
              {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{sessionSubs.length}</div><div className="stat-lbl">Total</div></div>
        <div className="stat-card"><div className="stat-num">{women.length}</div><div className="stat-lbl">Women</div></div>
        <div className="stat-card"><div className="stat-num">{men.length}</div><div className="stat-lbl">Men</div></div>
        <div className="stat-card"><div className="stat-num">{sessionMatches.length}</div><div className="stat-lbl">Matches</div></div>
      </div>

      {diff > 0 && sessionSubs.length > 0 && <div className="warning-msg">⚠ {diff} more {majority} than {majority === "women" ? "men" : "women"} — extras will receive a second match.</div>}
      {msg && <div className="success-msg">{msg}</div>}
      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary" onClick={handleRunMatches} disabled={loading || sessionSubs.length === 0} style={{marginBottom: 28}}>
        {loading ? "Matching..." : `Run Matching — ${activeSession || "no session"}`}
      </button>

      {sessionMatches.length > 0 && (
        <>
          <div className="eyebrow" style={{marginBottom: 14}}>Matched Pairs — {activeSession}</div>
          <div style={{overflowX: "auto", marginBottom: 32}}>
            <table className="match-table">
              <thead><tr><th>Person A</th><th>Person B</th><th>In Common</th><th>Score</th><th>Type</th></tr></thead>
              <tbody>
                {sessionMatches.map((m, i) => (
                  <tr key={i}>
                    <td><strong style={{color: G.cream}}>{m.person_a_name}</strong><div style={{fontSize: 12, color: "rgba(245,240,230,0.35)"}}>{m.person_a_email}</div></td>
                    <td><strong style={{color: G.cream}}>{m.person_b_name}</strong><div style={{fontSize: 12, color: "rgba(245,240,230,0.35)"}}>{m.person_b_email}</div></td>
                    <td><span className="tag tag-cream">{m.in_common}</span></td>
                    <td><span className="tag tag-gold">{m.score}</span></td>
                    <td><span className={`tag ${m.is_second_match ? "tag-wine" : "tag-cream"}`}>{m.is_second_match ? "2nd" : "1st"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sessionSubs.length > 0 && (
        <>
          <div className="eyebrow" style={{marginBottom: 14}}>Submissions — {activeSession}</div>
          <div style={{overflowX: "auto"}}>
            <table className="match-table">
              <thead><tr><th>Name</th><th>Gender</th><th>Age</th><th>Email</th><th>Wearing</th></tr></thead>
              <tbody>
                {sessionSubs.map((s, i) => (
                  <tr key={i}>
                    <td style={{color: G.cream}}>{s.name}</td>
                    <td><span className={`tag ${s.gender === "woman" ? "tag-wine" : "tag-cream"}`}>{s.gender}</span></td>
                    <td>{s.age}</td>
                    <td style={{fontSize: 12}}>{s.email}</td>
                    <td style={{fontSize: 13}}>{s.wearing}</td>
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

  const todaySession = `LC-${new Date().toISOString().slice(0, 10)}`;

  const [formData, setFormData] = useState({
    name: "", nickname: "", email: "", gender: "",
    wearing: "", height: "", age: "",
    age_range_min: "22", age_range_max: "38", height_pref: "",
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

  useEffect(() => {
    if (view !== "waiting" || !submissionId) return;
    const interval = setInterval(async () => {
      try {
        const allMatches = await supabase("GET", `matches?select=*&session_id=eq.${todaySession}`);
        if (allMatches && allMatches.length > 0) {
          const mine = allMatches.filter(m => m.person_a_id === submissionId || m.person_b_id === submissionId);
          if (mine.length > 0) { setMyMatches(mine); setView("countdown"); clearInterval(interval); }
          else { setNoMatch(true); setView("reveal"); clearInterval(interval); }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [view, submissionId]);

  async function handleSubmit() {
    setSubmitting(true); setSubmitError("");
    try {
      const result = await supabase("POST", "submissions", formData);
      if (result && result.length > 0) { setSubmissionId(result[0].id); setView("waiting"); }
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
          <div className="screen" style={{justifyContent: "center", minHeight: "100vh"}}>
            <div className="ornament" style={{marginBottom: 24}}>✦ ✦ ✦</div>
            <div className="eyebrow" style={{textAlign: "center", marginBottom: 12}}>Lav Studios Presents</div>
            <div style={{textAlign: "center", marginBottom: 4}}>
              <div className="display">Lav</div>
              <div className="display"><em>Connects</em></div>
            </div>
            <div className="pattern-strip" style={{marginTop: 24}} />
            <p style={{textAlign: "center", marginBottom: 36, marginTop: 8}}>
              Johannesburg's most curated evening for meaningful connections. Fill in your details and let the night do the rest.
            </p>
            <Frame>
              <div className="script" style={{textAlign: "center"}}>An evening for curious, open-hearted people.</div>
            </Frame>
            <button className="btn-primary" style={{marginTop: 8}} onClick={() => setView("form")}>Begin Your Profile</button>
            <p style={{textAlign: "center", marginTop: 12, fontSize: 12, letterSpacing: "0.05em"}}>Your details are private and secure</p>
            <div style={{position: "fixed", bottom: 16, right: 20}}>
              <button onClick={() => setView("admin")} style={{background: "none", border: "none", color: "rgba(245,240,230,0.1)", fontSize: 11, cursor: "pointer"}}>admin</button>
            </div>
          </div>
        )}

        {view === "form" && (
          <StepComponent
            data={formData} setData={setFormData}
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
