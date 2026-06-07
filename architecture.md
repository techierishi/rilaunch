# Architecture

## Philosophy

rilaunch is a **keyboard-first, plugin-based launcher** for macOS. The core idea: one hotkey (`Ctrl+Shift+Space`) summons a focused, frameless window where you can immediately start typing. No mouse needed.

- **Minimal UI surface**: no title bar, no native chrome. The UI is pure HTML rendered inside a transparent Wails webview, with rounded corners and a subtle shadow.
- **Instant**: the window shows instantly; data loads in the background on first paint.
- **Extensible**: each feature lives as an isolated plugin (tab). Adding a new plugin means a new Go package + a new SolidJS component — nothing else changes.

---

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop shell | [Wails v2](https://wails.io) | Go backend, web frontend, transparent frameless window |
| Frontend | [SolidJS](https://solidjs.com) + Vite | Fine-grained reactivity, no VDOM, tiny bundle |
| Persistence | [bbolt](https://github.com/etcd-io/bbolt) | Embedded key-value DB, no server needed |
| Fuzzy search | [Fuse.js](https://fusejs.io) | Lightweight, zero-dependency fuzzy matcher |

---

## Layers

```
┌─────────────────────────────────────────────┐
│ SolidJS frontend (frontend/src/)            │
│  App.jsx — routing, keyboard, global state  │
│  components/ — one component per plugin     │
└──────────────┬──────────────────────────────┘
               │  Wails JS bridge (wailsjs/)
┌──────────────▼──────────────────────────────┐
│ Go backend (app.go)                         │
│  Exposes methods: GetAllApps, LaunchApp,    │
│  GetClipData, ExecuteCommand,               │
│  GetNotes / SaveNote / DeleteNote,          │
│  GetAppIcon                                 │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ pkg/ — domain packages                      │
│  appm/   — app discovery & launching        │
│  clipm/  — clipboard daemon + bbolt storage │
│  notes/  — note CRUD via bbolt              │
│  config/ — shared bbolt DB singleton        │
│  util/   — logging, string utilities        │
└─────────────────────────────────────────────┘
```

---

## Plugin model

Each plugin is a **tab** in the sidebar. Tabs are isolated: switching tabs resets the search query, which in turn re-filters only the active plugin's data.

A plugin consists of:
- **Go side**: methods on the `App` struct (app.go) that read/write data.
- **Frontend side**: a component in `frontend/src/components/` that receives data + callbacks as props and owns its own state.
- **No coupling**: plugins don't know about each other. App.jsx wires them together.

### Existing plugins

| Tab | Key | Description |
|-----|-----|-------------|
| Apps | ⌘1 | Fuzzy-search all installed macOS apps. Single click or Enter to launch. |
| Clipboard | ⌘2 | Shows clipboard history captured by the background daemon. Click to copy & hide. |
| Shell | ⌘3 | Inline shell executor with command history (localStorage, 50 items). ↑↓ to navigate history. |
| Notes | ⌘4 | Save text snippets tagged as Note / TODO / Snippet / Idea. Stored in bbolt. |

---

## Data flow: Apps tab

```
onMount
  → GetAllApps() [Go: appm.Manager.GetAllApps]
      → scans /Applications, ~/Applications
      → returns JSON array of AppInfo

searchQuery changes
  → Fuse.js fuzzy search over in-memory allApps[]
      (client-side, no round-trip)

User clicks app / presses Enter
  → LaunchApp(id) [Go: open <app.Path>]
  → hideWindow()
```

## Data flow: Clipboard tab

```
switchTab('clipboard')
  → GetClipData() [Go: bbolt Clipboard bucket]
  → client-side substring filter on searchQuery
  → click item → navigator.clipboard.writeText + WindowHide
```

Background: `clipm.Record()` goroutine polls the OS clipboard every 500ms and writes new entries to bbolt.

## Data flow: Notes tab

```
switchTab('notes')
  → GetNotes() [Go: bbolt Notes bucket]
  → client-side substring filter on searchQuery

Click +
  → textarea compose UI → SaveNote(content, tag) [Go: bbolt Notes bucket]
  → reload notes

Click ✕ on note
  → DeleteNote(id)
  → reload notes
```

---

## Window transparency

- `Frameless: true` — removes native title bar / window chrome.
- `WebviewIsTransparent: true` — webview background is transparent.
- `BackgroundColour: {R:0, G:0, B:0, A:0}` — no native background color painted.
- **No** `WindowIsTranslucent` — that enables macOS vibrancy (frosted glass), which was bleeding through transparent CSS regions.

---

## Hotkey

`Ctrl+Shift+Space` (registered via `golang.design/x/hotkey`) toggles window visibility globally. The Go side emits `Backend:GlobalHotkeyEvent` which the frontend listens to via `EventsOn`.
