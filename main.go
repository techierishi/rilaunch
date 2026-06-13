package main

import (
	"context"
	"embed"
	"fmt"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	wailsApp := application.New(application.Options{
		Name: "rilaunch",
		Services: []application.Service{
			application.NewService(app),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	// Create the window instance
	mainWindow := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:          "main",
		Title:         "RiLaunch",
		URL:           "/",
		Width:         700,
		Height:        622,
		Frameless:     true,
		DisableResize: true,
		AlwaysOnTop:   true,

		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),

		Mac:     application.MacWindow{},
		Windows: application.WindowsWindow{},
		Linux:   application.LinuxWindow{},
	})

	app.SetApplication(wailsApp)
	app.SetMainWindow(mainWindow)

	// Wails v3 Lifecycle: Execute startup tasks directly before calling Run()
	app.startup(context.Background())

	// Run the application loop
	if err := wailsApp.Run(); err != nil {
		fmt.Println("Error:", err.Error())
	}
}
