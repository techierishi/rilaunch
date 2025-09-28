package main

import (
	"context"
	"encoding/json"
	"fmt"
	"rilaunch/pkg/appm"
	"rilaunch/pkg/clipm"
	"rilaunch/pkg/config"
	"time"

	"github.com/getlantern/systray"
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

func registerHotkey(a *App) {
	hk := hotkey.New([]hotkey.Modifier{hotkey.ModShift}, hotkey.KeySpace)
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


func (a *App)  onReady() {
	systray.SetTitle("Tray App")
	systray.SetTooltip("Running in tray")

	mShow := systray.AddMenuItem("Show Window", "Open the main window")
	mQuit := systray.AddMenuItem("Quit", "Exit the app")

	go func() {
		for {
			select {
			case <-mShow.ClickedCh:
				// Show main window
				runtime.WindowShow(a.ctx)
			case <-mQuit.ClickedCh:
				systray.Quit()
				runtime.Quit(a.ctx)
			}
		}
	}()
}
func (a *App) onExit() {}
