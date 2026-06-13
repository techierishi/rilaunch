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

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.design/x/clipboard"
	"golang.design/x/hotkey"
)

type App struct {
	ctx          context.Context
	wailsApp     *application.App
	mainWindow   *application.WebviewWindow
	refreshCh    chan bool
	clipData     []clipm.ClipInfo
	filteredData []clipm.ClipInfo
	appManager   *appm.Manager
	lastCommand  string
	lastOutput   string
	notesStore   *notes.NotesStore
	iconCache    map[string]string
	iconMu       sync.RWMutex
	visible      bool
	ready        bool
}

func NewApp() *App {
	return &App{
		appManager: appm.NewManager(),
		iconCache:  make(map[string]string),
		refreshCh:  make(chan bool, 1),
	}
}

func (a *App) SetApplication(app *application.App) {
	a.wailsApp = app
}

func (a *App) SetMainWindow(window *application.WebviewWindow) {
	a.mainWindow = window
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	if a.wailsApp != nil {
		a.wailsApp.Event.On("menu_quit", func(event *application.CustomEvent) {
			a.wailsApp.Quit()
		})
	}

	clipm.SetRefreshCallback(func() {
		if a.wailsApp != nil {
			a.wailsApp.Event.Emit("ClipboardUpdated")
		}
	})
	go clipm.Record(ctx)

	go func() {
		if err := a.appManager.Initialize(); err != nil {
			fmt.Printf("Failed to initialize application manager: %v\n", err)
		}
	}()

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
	go registerHotkey(a)
}

func (a *App) GetClipData(name string) string {
	clipDb := config.GetInstance()

	clipStore := &clipm.ClipM{
		DB: clipDb.DB,
	}

	clipList, err := clipStore.ReadAll()
	if err != nil {
		fmt.Println("ReadAll", err)
		return "[]"
	}
	clipStore.SortByTimestamp(*clipList)
	jsonClipList, err := json.Marshal(clipList)
	if err != nil {
		fmt.Println("Marshal", err)
		return "[]"
	}
	return string(jsonClipList)
}

func (a *App) ToggleClipSecret(hash string) error {
	clipDb := config.GetInstance()
	clipStore := &clipm.ClipM{
		DB: clipDb.DB,
	}
	return clipStore.MarkSecret(hash)
}

func (a *App) ClearClipboard() error {
	clipDb := config.GetInstance()
	clipStore := &clipm.ClipM{
		DB: clipDb.DB,
	}
	err := clipStore.DeleteBucket()
	if err == nil {
		go func() {
			clipboard.Write(clipboard.FmtText, []byte(" "))
		}()
	}
	return err
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

	a.Hide()
	return nil
}

var interactiveCommands = map[string]bool{
	"top": true, "htop": true, "btop": true, "atop": true, "glances": true,
	"vim": true, "vi": true, "nvim": true, "nano": true, "emacs": true,
	"pico": true, "micro": true, "helix": true, "hx": true,
	"less": true, "more": true, "most": true,
	"fzf": true, "ranger": true, "nnn": true, "broot": true, "lf": true, "yazi": true,
	"bash": true, "sh": true, "zsh": true, "fish": true, "ksh": true,
	"tcsh": true, "csh": true, "dash": true,
	"python": true, "python3": true, "python2": true,
	"node": true, "deno": true,
	"irb": true, "iex": true, "ghci": true, "sqlite3": true,
	"psql": true, "mysql": true, "mongo": true,
	"ssh": true, "telnet": true, "nc": true, "netcat": true,
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

	bin := filepath.Base(parts[0])

	if interactiveCommands[bin] {
		return fmt.Sprintf(
			"[blocked] '%s' is an interactive command that requires a TTY.\n"+
				"Use a non-interactive equivalent instead, e.g.:\n"+
				"  top  ->  ps aux\n"+
				"  man  ->  man -P cat <topic>\n"+
				"  python  ->  python -c '...'",
			bin,
		)
	}

	if bin == "tail" {
		for _, arg := range parts[1:] {
			if arg == "-f" || arg == "--follow" || (len(arg) > 1 && arg[0] == '-' && arg[1] != '-' && strings.ContainsRune(arg, 'f')) {
				return "[blocked] 'tail -f' follows a file indefinitely and cannot run here.\nUse 'tail -n 50 <file>' for a snapshot instead."
			}
		}
	}

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

func (a *App) SaveNote(content string) string {
	note, err := a.notesStore.Save(content)
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

func (a *App) UpdateNote(id, content string) string {
	note, err := a.notesStore.Update(id, content)
	if err != nil {
		return `{"error":"` + err.Error() + `"}`
	}
	data, _ := json.Marshal(note)
	return string(data)
}

func (a *App) GetNotesDir() string {
	if a.notesStore == nil {
		return ""
	}
	return a.notesStore.Dir
}

func (a *App) ChooseNotesDir() string {
	if a.notesStore == nil || a.wailsApp == nil {
		return ""
	}

	// newDir, err := a.wailsApp.Dialog.SelectDirectory(application.OpenFileDialogOptions{
	// 	Title:            "Select Notes Folder",
	// 	DefaultDirectory: a.notesStore.Dir,
	// 	CanCreateDirs:    true,
	// })
	// if err != nil || newDir == "" {
	// 	return a.notesStore.Dir
	// }

	// settings := config.LoadSettings()
	// settings.NotesDir = newDir
	// config.SaveSettings(settings)
	// a.notesStore.Dir = newDir
	// return newDir
	return ""
}

func (a *App) GetAppIcon(appPath string) string {
	a.iconMu.RLock()
	cached, ok := a.iconCache[appPath]
	a.iconMu.RUnlock()
	if ok {
		return cached
	}

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
	hk := hotkey.New(
		[]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift},
		hotkey.KeySpace,
	)

	if err := hk.Register(); err != nil {
		return
	}

	for {
		select {
		case <-hk.Keyup():
			if a.visible {
				a.Hide()
			} else {
				a.Show()
			}
		}
	}
}

func (a *App) makeWindow() *application.WebviewWindow {
	return a.wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:  "main",
		Title: "RiLaunch",
		URL:   "/",

		Width:  700,
		Height: 622,

		Frameless:     true,
		DisableResize: true,
		AlwaysOnTop:   true,

		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),

		Mac: application.MacWindow{},
	})
}

func (a *App) Toggle() {
	if a.visible {
		a.Hide()
		return
	}
	a.Show()
}

func (a *App) Show() {
	if !a.ready || a.mainWindow == nil {
		return
	}

	a.visible = true

	a.mainWindow.Hide()

	a.mainWindow.Center()
	a.wailsApp.Event.Emit("launcher:show", nil)
	a.mainWindow.Show()
	a.mainWindow.Focus()
}

func (a *App) Hide() {
	if !a.ready || a.mainWindow == nil {
		return
	}

	a.visible = false
	a.mainWindow.Hide()
	if a.wailsApp != nil {
		a.wailsApp.Event.Emit("Backend:GlobalHotkeyEvent", time.Now().String())
	}
}

func (a *App) onExit() {}
