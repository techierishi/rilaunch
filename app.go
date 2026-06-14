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
	"rilaunch/pkg/clipm"
	"rilaunch/pkg/config"
	"rilaunch/pkg/notes"
	goruntime "runtime"
	"strings"
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
	lastCommand  string
	lastOutput   string
	notesStore   *notes.NotesStore
	visible      bool
	ready        bool
}

func NewApp() *App {
	return &App{
		refreshCh: make(chan bool, 1),
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

	a.wailsApp.Dialog.SaveFileWithOptions(&application.SaveFileDialogOptions{})

	// settings := config.LoadSettings()
	// settings.NotesDir = newDir.
	// config.SaveSettings(settings)
	// a.notesStore.Dir = newDir
	return ""
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
				a.WindowHide()
			} else {
				a.WindowShow()
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

		Mac: application.MacWindow{
			// CollectionBehavior: application.MacWindowCollectionBehaviorCanJoinAllSpaces |
			// 	application.MacWindowCollectionBehaviorFullScreenAuxiliary,
			CollectionBehavior: application.MacWindowCollectionBehaviorMoveToActiveSpace,
			WindowLevel:        application.MacWindowLevelFloating,
		},
	})
}

func (a *App) Toggle() {
	if a.visible {
		a.WindowHide()
		return
	}
	a.WindowShow()
}

func (a *App) WindowShow() {
	if !a.ready || a.mainWindow == nil {
		return
	}

	a.visible = true

	a.wailsApp.Event.Emit("launcher:show", nil)
	a.mainWindow.Hide()
	time.Sleep(10 * time.Millisecond)
	a.mainWindow.Center()
	a.mainWindow.Show()
	a.mainWindow.Focus()
}

func (a *App) WindowHide() {
	if !a.ready || a.mainWindow == nil {
		return
	}

	a.visible = false
	a.mainWindow.Hide()
	if a.wailsApp != nil {
		a.wailsApp.Event.Emit("Backend:GlobalHotkeyEvent", time.Now().String())
	}
}

func (a *App) Quit() {
	if a.wailsApp != nil {
		a.wailsApp.Quit()
	}
}

func (a *App) onExit() {}
