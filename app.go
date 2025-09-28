package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"rilaunch/pkg/appm"
	"rilaunch/pkg/clipm"
	"rilaunch/pkg/config"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	wails_runtime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/hotkey"
)

type App struct {
	ctx context.Context
	refreshCh    chan bool
	isVisible    bool
	clipData     []clipm.ClipInfo
	filteredData []clipm.ClipInfo
	appManager   *appm.Manager
	lastCommand  string
	lastOutput   string
}


func NewApp() *App {
	return &App{
		appManager: appm.NewManager(),
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
	runtime.EventsEmit(a.ctx, "Backend:GlobalHotkeyEvent", time.Now().String())
}

func (a *App) hideWindow() {
	a.isVisible = false
	runtime.EventsEmit(a.ctx, "Backend:GlobalHotkeyEvent", time.Now().String())
}

func (a *App) onExit() {}
