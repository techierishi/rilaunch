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
		Name: "RiLaunch",
		Services: []application.Service{
			application.NewService(app),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	app.SetApplication(wailsApp)
	mainWindow := app.makeWindow()
	app.SetMainWindow(mainWindow)
	mainWindow.Show()
	mainWindow.Hide()
	app.ready = true
	app.startup(context.Background())

	// Run the application loop
	if err := wailsApp.Run(); err != nil {
		fmt.Println("Error:", err.Error())
	}
}
