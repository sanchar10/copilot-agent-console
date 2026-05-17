// ============================================================
// Quiet Doc — initial data + Icon component
// ============================================================

// Inline SVG icon set. All 1.5 stroke, currentColor, 24x24.
const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm5.5-2.5L21 21',
  sparkle: 'M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9L12 3z',
  bot: 'M9 11h6M9 14h3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm5-3v3M9 5h6',
  automation: 'M12 6V3M6 12H3M12 18v3M18 12h3M7 7l-2-2M17 7l2-2M7 17l-2 2M17 17l2 2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  runs: 'M5 4l14 8-14 8V4z',
  flow: 'M5 7h6a3 3 0 0 1 3 3v4a3 3 0 0 0 3 3h2M14 4l4 3-4 3M18 14l4 3-4 3',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 6l6 6-6 6',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
  paperclip: 'M21 10l-9 9a5 5 0 1 1-7-7L13 4a3.5 3.5 0 0 1 5 5L9 18a2 2 0 1 1-3-3l7-7',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  x: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  check: 'M5 12l5 5L20 6',
  cog: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  pulse: 'M3 12h4l2-7 4 14 2-7h6',
  extLink: 'M14 4h6v6M20 4L10 14M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
};

const Icon = ({ name, size = 16, strokeWidth = 1.5, style, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    style={style} aria-hidden="true" {...rest}>
    <path d={ICON_PATHS[name] || ''} />
  </svg>
);

// ============================================================
// Initial data — mirrors the screenshot
// ============================================================

const INITIAL_SESSIONS = [
  { id: 's1', title: "Give feedback on this LinkedIn profile", time: "9:17 PM", status: "active", lastActivity: Date.now() },
  { id: 's2', title: "LinkedIn Revamp",                       time: "9:02 PM", status: "idle",   lastActivity: Date.now() - 900_000 },
  { id: 's3', title: "What is PyTorch, how do I learn it for an interview", time: "3:00 PM", status: "idle", lastActivity: Date.now() - 6 * 3600_000 },
  { id: 's4', title: "Review AI Karaoke Spec",                time: "11:41 AM", status: "idle",  lastActivity: Date.now() - 10 * 3600_000 },
  { id: 's5', title: "I am looking for repos that hold reference architectures", time: "Wed", status: "idle", lastActivity: Date.now() - 86400_000 },
  { id: 's6', title: "AI investment research analyst",        time: "Wed",     status: "running", lastActivity: Date.now() - 86400_000 },
  { id: 's7', title: "Draft Requirements And Spec",           time: "Wed",     status: "new",    lastActivity: Date.now() - 86400_000 },
  { id: 's8', title: "Look at my Robinhood stocks performance YTD", time: "Wed", status: "idle", lastActivity: Date.now() - 86400_000 },
  { id: 's9', title: "Check WorkIQ Plugin Skill",             time: "Tue",     status: "new",    lastActivity: Date.now() - 2 * 86400_000 },
  { id: 's10', title: "What MCP servers you have access to",  time: "Mon",     status: "idle",   lastActivity: Date.now() - 3 * 86400_000 },
  { id: 's11', title: "MGE AI-Native Engineering Pilot",      time: "Mon",     status: "error",  lastActivity: Date.now() - 3 * 86400_000 },
  { id: 's12', title: "Investigate Stuck Session",            time: "Mon",     status: "idle",   lastActivity: Date.now() - 3 * 86400_000 },
  { id: 's13', title: "Scope: cross-repo-query to find pattern", time: "Mon",  status: "idle",   lastActivity: Date.now() - 3 * 86400_000 },
];

const INITIAL_OPEN_TABS = ['s4', 's3', 's2', 's6', 's5', 's1'];
const INITIAL_ACTIVE_TAB = 's1';

const MODELS = [
  { id: 'gpt-5.5', name: 'GPT-5.5', badge: 'G5', profile: 'xhigh', desc: 'Best for complex agentic work' },
  { id: 'gpt-5',   name: 'GPT-5',   badge: 'G',  profile: 'high',  desc: 'Balanced. Default.' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', badge: 'H',  profile: 'fast',  desc: 'Fastest. Low cost.' },
  { id: 'claude-opus-4-5',  name: 'Claude Opus 4.5',  badge: 'O',  profile: 'xhigh', desc: 'Deep reasoning.' },
];

// Canonical thread for the active session (matches the screenshot).
const ACTIVE_THREAD = [
  {
    id: 'm1', role: 'assistant', time: '9:08 PM',
    body: "I'll try the public LinkedIn view first and check whether enough profile detail is accessible without login.",
  },
  {
    id: 'm2', role: 'assistant', time: '9:10 PM', stepsCount: 8,
    body: "LinkedIn is returning a public 404 for that exact profile URL, so I'm checking whether cached/search snippets expose enough profile context before asking you for access.",
    steps: [
      { kind: 'tool',    name: 'web_fetch',  body: 'linkedin.com/in/manas',         time: '9:08' },
      { kind: 'thought', body: 'Public URL returns 404 — checking caches',          time: '9:08' },
      { kind: 'tool',    name: 'web_search', body: '"manas n" linkedin engineer',   time: '9:09' },
      { kind: 'tool',    name: 'web_fetch',  body: 'google.com/search?q=…',         time: '9:09' },
      { kind: 'thought', body: 'Snippets too thin for substantive feedback',         time: '9:10' },
    ],
  },
  {
    id: 'm3', role: 'assistant', time: '9:10 PM', stepsCount: 5, userInput: true,
    body: "I'll open LinkedIn's sign-in page. Please enter credentials yourself in the browser; I won't handle or store them.",
    steps: [
      { kind: 'tool',    name: 'browser.open', body: 'linkedin.com/login',          time: '9:10' },
      { kind: 'input',   body: 'Awaiting credentials from user',                     time: '9:10' },
    ],
  },
  {
    id: 'm4', role: 'user', time: '9:11 PM',
    body: "Done — signed in. The profile should now be reachable.",
  },
  {
    id: 'm5', role: 'assistant', time: '9:12 PM', stepsCount: 5, userInput: true,
    body: "Thanks — I'll reopen the profile now and review what's available.",
  },
  {
    id: 'm6', role: 'assistant', time: '9:13 PM', stepsCount: 12,
    body: "The profile is accessible after login. I'm scrolling through the full profile sections now so the feedback covers more than just the headline/activity.",
  },
  {
    id: 'm7', role: 'assistant', time: '9:17 PM', stepsCount: 26, final: true,
    body: "Strong profile for AI/MLE/new-grad SWE roles — the standout proof is unusually good: T-Mobile AI internship, Jeeves impact, DuraLang/Temporal, TartanHacks win, 500+ connections, 1.4K followers, and strong recommendations.",
    highestPriority: "the profile showed \u201CPage not found\u201D before login, then worked after login. Verify the public URL in an incognito window and make sure public visibility is enabled. Recruiters often open links from email, resume, GitHub, or ATS without being signed in.",
    table: [
      { area: 'Headline', feedback: 'Strong, but optimized for current status more than full-time recruiting.', change: 'Lead with role target + grad signal. e.g. CS + Data Science @ Purdue · AI/ML Engineer.' },
      { area: 'About',    feedback: 'Buried metrics; reads as resume bullets.', change: 'Open with a one-line positioning statement, then 3 bullets with quantified wins.' },
      { area: 'Featured', feedback: 'Mostly screenshots; no demo links.', change: 'Add live demos for Jeeves and DuraLang; pin the TartanHacks repo above the fold.' },
    ],
  },
];

// Map session id → thread. Sessions not in this map start empty.
const THREADS_BY_SESSION = {
  s1: ACTIVE_THREAD,
};

// Expose to other Babel script files.
Object.assign(window, {
  Icon,
  INITIAL_SESSIONS, INITIAL_OPEN_TABS, INITIAL_ACTIVE_TAB,
  MODELS, ACTIVE_THREAD, THREADS_BY_SESSION,
});
