
// ── Flat SVG icons ────────────────────────────────────────────────────────────

const IconApps = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="1"   y="1"   width="5.5" height="5.5" rx="1.2"/>
    <rect x="8.5" y="1"   width="5.5" height="5.5" rx="1.2"/>
    <rect x="1"   y="8.5" width="5.5" height="5.5" rx="1.2"/>
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2"/>
  </svg>
);

const IconClipboard = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="2" width="8" height="11.5" rx="1.2"/>
    <path d="M5.5 2V3a1 1 0 001 1h2a1 1 0 001-1V2"/>
  </svg>
);

const IconTerminal = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="2.5,4.5 6.5,7.5 2.5,10.5"/>
    <line x1="8.5" y1="10.5" x2="12.5" y2="10.5"/>
  </svg>
);

const IconNotes = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2h9a1 1 0 011 1v7.5L10.5 13H3a1 1 0 01-1-1V3a1 1 0 011-1z"/>
    <line x1="4.5" y1="5.5" x2="10.5" y2="5.5"/>
    <line x1="4.5" y1="8" x2="8" y2="8"/>
  </svg>
);

const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7" cy="7" r="2"/>
    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 4.5h3v-3M13.5 10.5h-3v3"/>
    <path d="M12.4 4.5A5.5 5.5 0 004.2 2L1.5 4.5M13.5 10.5l-2.7 2.5a5.5 5.5 0 01-8.2-2.5"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 3.5h10M4.5 3.5v-1a1 1 0 011-1h4a1 1 0 011 1v1M11.5 3.5v9a1 1 0 01-1 1h-6a1 1 0 01-1-1v-9"/>
    <line x1="6" y1="6" x2="6" y2="10"/>
    <line x1="9" y1="6" x2="9" y2="10"/>
  </svg>
);

const IconClear = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="5.5"/>
    <line x1="3.5" y1="3.5" x2="11.5" y2="11.5"/>
  </svg>
);

const IconSettingsSmall = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="1.5"/>
    <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14"/>
  </svg>
);

const IconLock = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="6.5" width="8" height="6" rx="1"/>
    <path d="M5.5 6.5V4.5a2 2 0 1 1 4 0v2"/>
  </svg>
);

const IconHistory = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.5" cy="7.5" r="5.5"/>
    <polyline points="7.5,4.5 7.5,7.5 9.5,8.5"/>
  </svg>
);

const IconFolder = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 2.5h4l1.5 1.5h6.5v8.5a1 1 0 01-1 1h-11a1 1 0 01-1-1z"/>
  </svg>
);

export {
  IconApps,
  IconClipboard,
  IconTerminal,
  IconNotes,
  IconSettings,
  IconRefresh,
  IconTrash,
  IconClear,
  IconSettingsSmall,
  IconLock,
  IconHistory,
  IconFolder
};