package main

import (
	"context"
	"fmt"
	"rilaunch/pkg/clipm"
	"time"

	"github.com/getlantern/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	wails_runtime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/hotkey"
)

// App struct
type App struct {
	ctx context.Context
	refreshCh    chan bool
	isVisible    bool
	clipData     []clipm.ClipInfo
	filteredData []clipm.ClipInfo
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	// go func() {
	// 		systray.Run(a.onReady, a.onExit)
	// 	}()
	a.ctx = ctx

	wails_runtime.EventsOn(ctx, "menu_quit", func(optionalData ...interface{}) {
		wails_runtime.Quit(ctx)
	})

	go clipm.Record(ctx)
	// register hotkey on the app startup
	// if you try to register it anywhere earlier - the app will hang on compile step
	// mainthread.Init(a.RegisterHotKey)
	a.RegisterHotKey()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) RegisterHotKey() {
	registerHotkey(a)
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
			// Refresh clip data when hotkey is pressed
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
