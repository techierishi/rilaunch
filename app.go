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

	// Initialize notes store
	cfg := config.GetInstance()
	a.notesStore = &notes.NotesStore{DB: cfg.DB}
	if err := a.notesStore.EnsureBucket(); err != nil {
		fmt.Printf("Failed to init notes store: %v\n", err)
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

func (a *App) ExecuteCommand(command string) string {
	if strings.TrimSpace(command) == "" {
		return "Error: Empty command"
	}

	a.lastCommand = command

	parts := strings.Fields(command)
	if len(parts) == 0 {
		return "Error: Invalid command"
	}

	cmd := exec.Command(parts[0], parts[1:]...)
	output, err := cmd.CombinedOutput()

	result := string(output)
	if err != nil {
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

// ── App Icons ─────────────────────────────────────────────────────────────────

func (a *App) GetAppIcon(appPath string) string {
	if cached, ok := a.iconCache[appPath]; ok {
		return cached
	}
	icon := extractMacOSIconBase64(appPath)
	a.iconCache[appPath] = icon
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
