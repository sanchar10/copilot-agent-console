// Shared content + tiny icon set used by every variation.
// Real-feeling data so directions stay apples-to-apples.

const SESSIONS = [
  { id: 's1', title: "Give feedback on this linkedin profile", time: "9:17 PM", status: "active", tokens: 0.23, agents: 3, sparkline: [2,4,3,6,5,9,7,12,10,14,16,15,18] },
  { id: 's2', title: "LinkedIn Revamp", time: "9:02 PM", status: "idle", tokens: 0.41, agents: 1, sparkline: [3,3,4,6,8,10,9,9,8,7,6,4,2] },
  { id: 's3', title: "What is PyTorch, how do I learn it for an interview", time: "3:00 PM", status: "idle", tokens: 0.18, agents: 0, sparkline: [1,2,3,4,5,6,5,4,3,2,1,1,1] },
  { id: 's4', title: "Review AI Karaoke Spec", time: "11:41 AM", status: "idle", tokens: 0.62, agents: 2, sparkline: [4,8,12,10,8,9,11,14,12,9,7,8,9] },
  { id: 's5', title: "I am looking for repos that hold reference architectures", time: "Wed", status: "idle", tokens: 0.34, agents: 1, sparkline: [1,3,5,4,6,7,5,6,8,7,5,4,3] },
  { id: 's6', title: "AI investment research analyst", time: "Wed", status: "running", tokens: 0.78, agents: 4, sparkline: [5,8,11,14,12,15,18,17,19,21,20,22,24] },
  { id: 's7', title: "Draft Requirements And Spec", time: "Wed", status: "new", tokens: 0.05, agents: 0, sparkline: [0,0,1,1,2,2,3,3,4,4,5,5,6] },
  { id: 's8', title: "Look at my robinhood stocks performance YTD", time: "Wed", status: "idle", tokens: 0.29, agents: 1, sparkline: [3,4,5,4,3,2,3,4,5,6,7,6,5] },
  { id: 's9', title: "Check WorkIQ Plugin Skill", time: "Tue", status: "new", tokens: 0.11, agents: 0, sparkline: [1,1,2,2,3,3,4,4,5,5,6,6,7] },
  { id: 's10', title: "What all MCP servers you have access to", time: "Mon", status: "idle", tokens: 0.08, agents: 0, sparkline: [1,1,1,2,2,2,3,3,3,4,4,4,5] },
  { id: 's11', title: "MGE AI-Native Engineering Pilot", time: "Mon", status: "error", tokens: 0.92, agents: 2, sparkline: [4,7,10,13,16,18,17,15,12,10,8,6,4] },
  { id: 's12', title: "Investigate Stuck Session", time: "Mon", status: "idle", tokens: 0.51, agents: 1, sparkline: [3,5,7,8,7,6,5,4,5,6,7,8,9] },
  { id: 's13', title: "Scope: Use cross-repo-query to find pattern", time: "Mon", status: "idle", tokens: 0.44, agents: 1, sparkline: [2,3,4,5,6,7,6,5,4,5,6,7,8] },
];

const OPEN_TABS = ['s4', 's3', 's2', 's6', 's5', 's1'];
const ACTIVE_TAB = 's1';

// The canonical thread (matches your screenshot).
const THREAD = [
  {
    role: 'assistant', time: '9:08 PM',
    body: "I'll try the public LinkedIn view first and check whether enough profile detail is accessible without login.",
  },
  {
    role: 'assistant', time: '9:10 PM', steps: 8,
    body: "LinkedIn is returning a public 404 for that exact profile URL, so I'm checking whether cached/search snippets expose enough profile context before asking you for access.",
  },
  {
    role: 'assistant', time: '9:10 PM', steps: 5, userInput: true,
    body: "I'll open LinkedIn's sign-in page. Please enter credentials yourself in the browser; I won't handle or store them.",
  },
  {
    role: 'user', time: '9:11 PM',
    body: "Done — signed in. The profile should now be reachable.",
  },
  {
    role: 'assistant', time: '9:12 PM', steps: 5, userInput: true,
    body: "Thanks — I'll reopen the profile now and review what's available.",
  },
  {
    role: 'assistant', time: '9:13 PM', steps: 12,
    body: "The profile is accessible after login. I'm scrolling through the full profile sections now so the feedback covers more than just the headline/activity.",
  },
  {
    role: 'assistant', time: '9:17 PM', steps: 26, final: true,
    body: "Strong profile for AI/MLE/new-grad SWE roles — the standout proof is unusually good: T-Mobile AI internship, Jeeves impact, DuraLang/Temporal, TartanHacks win, 500+ connections, 1.4K followers, and strong recommendations.",
    highestPriority: "the profile showed \u201CPage not found\u201D before login, then worked after login. Verify the public URL in an incognito window and make sure public visibility is enabled. Recruiters often open links from email, resume, GitHub, or ATS without being signed in.",
    table: [
      { area: 'Headline', feedback: 'Strong, but optimized for current status more than full-time recruiting.', change: 'Lead with role target + grad signal. e.g. CS + Data Science @ Purdue · AI/ML Engineer.' },
      { area: 'About', feedback: 'Buried metrics; reads as resume bullets.', change: 'Open with a one-line positioning statement, then 3 bullets with quantified wins.' },
      { area: 'Featured', feedback: 'Mostly screenshots; no demo links.', change: 'Add live demos for Jeeves and DuraLang; pin the TartanHacks repo above the fold.' },
    ],
  },
];

const TOOL_COUNTS = { tools: '0/5', mcp: '1/13', subAgents: '0/21' };

// Tiny inline SVG icons. Stroke-only, 1.5 width, currentColor.
const Icon = ({ name, size = 16, strokeWidth = 1.5, style }) => {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm5.5-2.5L21 21',
    sparkle: 'M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9L12 3z',
    agent: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-7 13a7 7 0 0 1 14 0',
    bot: 'M9 11h6M9 14h3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm5-3v3M9 5h6',
    automation: 'M12 6V3M6 12H3M12 18v3M18 12h3M7 7l-2-2M17 7l2-2M7 17l-2 2M17 17l2 2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    runs: 'M5 4l14 8-14 8V4z',
    flow: 'M5 7h6a3 3 0 0 1 3 3v4a3 3 0 0 0 3 3h2M14 4l4 3-4 3M18 14l4 3-4 3',
    chevDown: 'M6 9l6 6 6-6',
    chevRight: 'M9 6l6 6-6 6',
    chevLeft: 'M15 6l-6 6 6 6',
    cog: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    paperclip: 'M21 10l-9 9a5 5 0 1 1-7-7L13 4a3.5 3.5 0 0 1 5 5L9 18a2 2 0 1 1-3-3l7-7',
    arrowUp: 'M12 19V5M5 12l7-7 7 7',
    stop: 'M6 6h12v12H6z',
    extLink: 'M14 4h6v6M20 4L10 14M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
    folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
    tools: 'M14.7 6.3a4 4 0 0 1 5.4 5.4l-1.4 1.4-4-4 1.4-1.4zM5 21l-2-2 9-9 4 4-9 9-2-2zM3 21h4',
    mcp: 'M4 12h4l2-6 4 12 2-6h4',
    layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5',
    pulse: 'M3 12h4l2-7 4 14 2-7h6',
    dot: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    cmd: 'M8 6a2 2 0 1 1-2 2h12a2 2 0 1 1-2-2v12a2 2 0 1 1 2-2H6a2 2 0 1 1 2 2V6z',
    x: 'M6 6l12 12M18 6L6 18',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    pin: 'M12 17v5M5 9l7-7 7 7-4 2v3l-6 0v-3L5 9z',
    spark: 'M5 12h3l2-7 4 14 2-7h3',
    box: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
    branch: 'M6 4v12M6 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 4a2 2 0 1 0 0-4M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 8c0 4-4 4-6 6',
  };
  const d = paths[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      <path d={d} />
    </svg>
  );
};

// A subtle striped placeholder used in lieu of real avatars/images.
const StripePlaceholder = ({ w = 28, h = 28, radius = 6, hue = 30, style }) => (
  <div style={{
    width: w, height: h, borderRadius: radius,
    background: `repeating-linear-gradient(135deg, oklch(0.72 0.06 ${hue}) 0 4px, oklch(0.78 0.05 ${hue}) 4px 8px)`,
    opacity: 0.55, flexShrink: 0, ...style,
  }} />
);

// Sparkline helper — tiny path
const Sparkline = ({ data, w = 56, h = 14, color = 'currentColor', strokeWidth = 1.2 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const stepX = w / (data.length - 1);
  const d = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
};

const statusColor = (status, light = false) => {
  if (status === 'running') return light ? 'oklch(0.62 0.16 145)' : 'oklch(0.78 0.18 145)';
  if (status === 'active')  return light ? 'oklch(0.55 0.18 60)'  : 'oklch(0.78 0.16 60)';
  if (status === 'error')   return light ? 'oklch(0.58 0.20 25)'  : 'oklch(0.72 0.18 25)';
  if (status === 'new')     return light ? 'oklch(0.55 0.13 250)' : 'oklch(0.75 0.13 250)';
  return light ? 'oklch(0.65 0.01 250)' : 'oklch(0.55 0.01 250)';
};

Object.assign(window, { SESSIONS, OPEN_TABS, ACTIVE_TAB, THREAD, TOOL_COUNTS, Icon, StripePlaceholder, Sparkline, statusColor });
