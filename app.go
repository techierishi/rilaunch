package main

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"rilaunch/pkg/appm"
	"rilaunch/pkg/clipm"
	"rilaunch/pkg/config"
	"rilaunch/pkg/notes"
	goruntime "runtime"
	"strings"
	"sync"
	"time"

	wails_runtime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/hotkey"
)

type App struct {
	ctx          context.Context
	refreshCh    chan bool
	isVisible    bool
	clipData     []clipm.ClipInfo
	filteredData []clipm.ClipInfo
	appManager   *appm.Manager
	lastCommand  string
	lastOutput   string
	notesStore   *notes.NotesStore
	iconCache    map[string]string
	iconMu       sync.RWMutex
}

func NewApp() *App {
	return &App{
		appManager: appm.NewManager(),
		iconCache:  make(map[string]string),
	}
}

func (a *App) startup(ctx context.Context) {

	a.ctx = ctx

	wails_runtime.EventsOn(ctx, "menu_quit", func(optionalData ...interface{}) {
		wails_runtime.Quit(ctx)
	})

	go clipm.Record(ctx)

	go func() {
		if err := a.appManager.Initialize(); err != nil {
			fmt.Printf("Failed to initialize application manager: %v\n", err)
		}
	}()

	// Initialize file-based notes store
	settings := config.LoadSettings()
	a.notesStore = &notes.NotesStore{Dir: settings.NotesDir}
	if err := a.notesStore.EnsureDir(); err != nil {
		fmt.Printf("Failed to init notes dir: %v\n", err)
	}

	a.RegisterHotKey()
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) RegisterHotKey() {
	registerHotkey(a)
}

func (a *App) GetClipData(name string) string {

	clipDb := config.GetInstance()

	clipm := &clipm.ClipM{
		DB: clipDb.DB,
	}

	clipList, err := clipm.ReadAll()
	if err != nil {
		fmt.Println("ReadAll", err)
		return "[]"
	}
	clipm.SortByTimestamp(*clipList)
	jsonClipList, err := json.Marshal(clipList)
	if err != nil {
		fmt.Println("Reverse", err)
	}
	return string(jsonClipList)
}

func (a *App) ToggleClipSecret(hash string) error {
	clipDb := config.GetInstance()
	clipm := &clipm.ClipM{
		DB: clipDb.DB,
	}
	return clipm.MarkSecret(hash)
}


func (a *App) GetAllApps() string {
	apps, err := a.appManager.GetAllApps()
	if err != nil {
		fmt.Printf("GetAllApps error: %v\n", err)
		return "[]"
	}
	return apps
}

func (a *App) SearchApps(query string) string {
	apps, err := a.appManager.SearchApps(query)
	if err != nil {
		fmt.Printf("SearchApps error: %v\n", err)
		return "[]"
	}
	return apps
}

func (a *App) LaunchApp(appID string) error {
	err := a.appManager.LaunchApp(appID)
	if err != nil {
		fmt.Printf("LaunchApp error: %v\n", err)
		return err
	}

	a.hideWindow()
	return nil
}

// interactiveCommands is the set of CLI programs that require a real TTY.
// Running them in a non-TTY exec will hang or produce garbage output.
var interactiveCommands = map[string]bool{
	// TUI monitors
	"top": true, "htop": true, "btop": true, "atop": true, "glances": true,
	// Text editors
	"vim": true, "vi": true, "nvim": true, "nano": true, "emacs": true,
	"pico": true, "micro": true, "helix": true, "hx": true,
	// Pagers
	"less": true, "more": true, "most": true,
	// Interactive finders / file managers
	"fzf": true, "ranger": true, "nnn": true, "broot": true, "lf": true, "yazi": true,
	// Shells
	"bash": true, "sh": true, "zsh": true, "fish": true, "ksh": true,
	"tcsh": true, "csh": true, "dash": true,
	// REPLs
	"python": true, "python3": true, "python2": true,
	"node": true, "deno": true,
	"irb": true, "iex": true, "ghci": true, "sqlite3": true,
	"psql": true, "mysql": true, "mongo": true,
	// Network / remote
	"ssh": true, "telnet": true, "nc": true, "netcat": true,
	// Misc TUI
	"man": true, "watch": true, "crontab": true,
}

func (a *App) ExecuteCommand(command string) string {
	if strings.TrimSpace(command) == "" {
		return "Error: empty command"
	}

	a.lastCommand = command

	parts := strings.Fields(command)
	if len(parts) == 0 {
		return "Error: invalid command"
	}

	// Resolve bare binary name (handles full paths like /usr/bin/vim)
	bin := filepath.Base(parts[0])

	// Block interactive / TTY-dependent commands
	if interactiveCommands[bin] {
		return fmt.Sprintf(
			"[blocked] '%s' is an interactive command that requires a TTY.\n"+
				"Use a non-interactive equivalent instead, e.g.:\n"+
				"  top  →  ps aux\n"+
				"  man  →  man -P cat <topic>\n"+
				"  python  →  python -c '...'",
			bin,
		)
	}

	// Block tail -f / --follow (runs indefinitely)
	if bin == "tail" {
		for _, arg := range parts[1:] {
			if arg == "-f" || arg == "--follow" || (len(arg) > 1 && arg[0] == '-' && arg[1] != '-' && strings.ContainsRune(arg, 'f')) {
				return "[blocked] 'tail -f' follows a file indefinitely and cannot run here.\nUse 'tail -n 50 <file>' for a snapshot instead."
			}
		}
	}

	// Run with a 15-second timeout to prevent accidental hangs
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
	output, err := cmd.CombinedOutput()

	result := string(output)
	if ctx.Err() == context.DeadlineExceeded {
		result = fmt.Sprintf("[timeout] command exceeded 15 s and was killed.\n%s", result)
	} else if err != nil {
		result = fmt.Sprintf("Error: %v\n%s", err, result)
	}

	a.lastOutput = result
	return result
}

func (a *App) GetLastCommand() string {
	return a.lastCommand
}

func (a *App) GetLastOutput() string {
	return a.lastOutput
}

// ── Notes ─────────────────────────────────────────────────────────────────────

func (a *App) SaveNote(content, tag string) string {
	note, err := a.notesStore.Save(content, tag)
	if err != nil {
		return `{"error":"` + err.Error() + `"}`
	}
	data, _ := json.Marshal(note)
	return string(data)
}

func (a *App) GetNotes() string {
	ns, err := a.notesStore.GetAll()
	if err != nil {
		return "[]"
	}
	data, _ := json.Marshal(ns)
	return string(data)
}

func (a *App) DeleteNote(id string) error {
	return a.notesStore.Delete(id)
}

func (a *App) UpdateNote(id, content, tag string) string {
	note, err := a.notesStore.Update(id, content, tag)
	if err != nil {
		return `{"error":"` + err.Error() + `"}`
	}
	data, _ := json.Marshal(note)
	return string(data)
}

func (a *App) GetNotesDir() string {
	return a.notesStore.Dir
}

// ChooseNotesDir opens a native folder picker, saves the choice, and returns the new path.
func (a *App) ChooseNotesDir() string {
	newDir, err := wails_runtime.OpenDirectoryDialog(a.ctx, wails_runtime.OpenDialogOptions{
		Title:                "Select Notes Folder",
		DefaultDirectory:     a.notesStore.Dir,
		CanCreateDirectories: true,
	})
	if err != nil || newDir == "" {
		return a.notesStore.Dir // cancelled or error
	}
	settings := config.LoadSettings()
	settings.NotesDir = newDir
	config.SaveSettings(settings)
	a.notesStore.Dir = newDir
	return newDir
}

// ── App Icons ─────────────────────────────────────────────────────────────────

func (a *App) GetAppIcon(appPath string) string {
	// Fast path: check cache under read lock
	a.iconMu.RLock()
	cached, ok := a.iconCache[appPath]
	a.iconMu.RUnlock()
	if ok {
		return cached
	}

	// Slow path: extract icon, then store under write lock
	icon := extractMacOSIconBase64(appPath)

	a.iconMu.Lock()
	a.iconCache[appPath] = icon
	a.iconMu.Unlock()

	return icon
}

func extractMacOSIconBase64(appPath string) string {
	if goruntime.GOOS != "darwin" {
		return ""
	}

	plistPath := filepath.Join(appPath, "Contents", "Info.plist")
	if _, err := os.Stat(plistPath); err != nil {
		return ""
	}

	out, err := exec.Command("plutil", "-extract", "CFBundleIconFile", "raw", "-o", "-", plistPath).Output()
	iconName := strings.TrimSpace(string(out))
	if err != nil || iconName == "" {
		iconName = "AppIcon"
	}
	if !strings.HasSuffix(iconName, ".icns") {
		iconName += ".icns"
	}

	icnsPath := filepath.Join(appPath, "Contents", "Resources", iconName)
	if _, err := os.Stat(icnsPath); err != nil {
		for _, name := range []string{"AppIcon.icns", "icon.icns", "Application.icns"} {
			p := filepath.Join(appPath, "Contents", "Resources", name)
			if _, err := os.Stat(p); err == nil {
				icnsPath = p
				break
			}
		}
		if _, err := os.Stat(icnsPath); err != nil {
			return ""
		}
	}

	// Use cached temp PNG if already converted
	hash := md5.Sum([]byte(appPath))
	tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("rilaunch_%x.png", hash))
	if _, err := os.Stat(tmpFile); err != nil {
		if err := exec.Command("sips", "-s", "format", "png", "-Z", "32", icnsPath, "--out", tmpFile).Run(); err != nil {
			return ""
		}
	}

	data, err := os.ReadFile(tmpFile)
	if err != nil {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
}

func registerHotkey(a *App) {
	hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.KeySpace)
	err := hk.Register()
	if err != nil {
		fmt.Printf("Failed to register hotkey: %v\n", err)
		return
	}

	fmt.Printf("hotkey: %v is registered\n", hk)

	for {
		select {
		case <-hk.Keydown():
			fmt.Printf("hotkey: %v is down\n", hk)
		case <-hk.Keyup():
			fmt.Printf("hotkey: %v is up\n", hk)

			if a.isVisible {
				a.hideWindow()
			} else {
				a.showWindow()
			}

			select {
			case a.refreshCh <- true:
			default:
			}
		case <-time.After(time.Second * 30):
			continue
		}
	}
}

func (a *App) showWindow() {
	a.isVisible = true
	wails_runtime.EventsEmit(a.ctx, "Backend:GlobalHotkeyEvent", time.Now().String())
}

func (a *App) hideWindow() {
	a.isVisible = false
	wails_runtime.EventsEmit(a.ctx, "Backend:GlobalHotkeyEvent", time.Now().String())
}

func (a *App) onExit() {}
