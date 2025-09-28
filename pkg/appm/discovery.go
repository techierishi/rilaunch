package appm

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func (am *AppManager) DiscoverApps() error {
	switch runtime.GOOS {
	case "linux":
		return am.discoverLinuxApps()
	case "darwin":
		return am.discoverMacOSApps()
	case "windows":
		return am.discoverWindowsApps()
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}

func (am *AppManager) discoverLinuxApps() error {
	desktopDirs := []string{
		"/usr/share/applications",
		"/usr/local/share/applications",
		filepath.Join(os.Getenv("HOME"), ".local/share/applications"),
	}

	for _, dir := range desktopDirs {
		if err := am.scanDesktopFiles(dir); err != nil {
			fmt.Printf("Warning: failed to scan %s: %v\n", dir, err)
		}
	}

	return nil
}

func (am *AppManager) discoverMacOSApps() error {
	appDirs := []string{
		"/Applications",
		"/System/Applications",
		filepath.Join(os.Getenv("HOME"), "Applications"),
	}

	for _, dir := range appDirs {
		if err := am.scanMacOSApps(dir); err != nil {
			fmt.Printf("Warning: failed to scan %s: %v\n", dir, err)
		}
	}

	return nil
}

func (am *AppManager) discoverWindowsApps() error {
	programDirs := []string{
		"C:\\Program Files",
		"C:\\Program Files (x86)",
		filepath.Join(os.Getenv("APPDATA"), "Microsoft\\Windows\\Start Menu\\Programs"),
		filepath.Join(os.Getenv("ProgramData"), "Microsoft\\Windows\\Start Menu\\Programs"),
	}

	for _, dir := range programDirs {
		if err := am.scanWindowsApps(dir); err != nil {
			fmt.Printf("Warning: failed to scan %s: %v\n", dir, err)
		}
	}

	return nil
}

func (am *AppManager) scanDesktopFiles(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}

	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !strings.HasSuffix(path, ".desktop") {
			return nil
		}

		app, err := am.parseDesktopFile(path)
		if err != nil {
			return nil
		}

		if app.Name != "" && app.Path != "" {
			am.AddApp(*app)
		}

		return nil
	})
}

func (am *AppManager) scanMacOSApps(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasSuffix(entry.Name(), ".app") {
			continue
		}

		appPath := filepath.Join(dir, entry.Name())
		app := am.parseMacOSApp(appPath)
		if app.Name != "" {
			am.AddApp(*app)
		}
	}

	return nil
}

func (am *AppManager) scanWindowsApps(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil
	}

	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if strings.HasSuffix(strings.ToLower(path), ".exe") || strings.HasSuffix(strings.ToLower(path), ".lnk") {
			app := am.parseWindowsApp(path)
			if app.Name != "" {
				am.AddApp(*app)
			}
		}

		return nil
	})
}

func (am *AppManager) parseDesktopFile(path string) (*AppInfo, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(content), "\n")
	app := &AppInfo{
		ID:       filepath.Base(path),
		Category: "Application",
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Name=") {
			app.Name = strings.TrimPrefix(line, "Name=")
			app.DisplayName = app.Name
		} else if strings.HasPrefix(line, "Comment=") {
			app.Description = strings.TrimPrefix(line, "Comment=")
		} else if strings.HasPrefix(line, "Exec=") {
			execLine := strings.TrimPrefix(line, "Exec=")
			// Remove desktop entry field codes
			execLine = strings.ReplaceAll(execLine, "%f", "")
			execLine = strings.ReplaceAll(execLine, "%F", "")
			execLine = strings.ReplaceAll(execLine, "%u", "")
			execLine = strings.ReplaceAll(execLine, "%U", "")
			app.Path = strings.TrimSpace(execLine)
		} else if strings.HasPrefix(line, "Icon=") {
			app.Icon = strings.TrimPrefix(line, "Icon=")
		} else if strings.HasPrefix(line, "Categories=") {
			categories := strings.TrimPrefix(line, "Categories=")
			if categories != "" {
				app.Category = strings.Split(categories, ";")[0]
			}
		} else if strings.HasPrefix(line, "Keywords=") {
			keywords := strings.TrimPrefix(line, "Keywords=")
			app.Keywords = strings.Split(keywords, ";")
		}
	}

	return app, nil
}

func (am *AppManager) parseMacOSApp(path string) *AppInfo {
	name := filepath.Base(path)
	name = strings.TrimSuffix(name, ".app")

	app := &AppInfo{
		ID:          name,
		Name:        name,
		DisplayName: name,
		Path:        path,
		Category:    "Application",
		Icon:        "🖥️",
	}

	infoPlist := filepath.Join(path, "Contents", "Info.plist")
	if _, err := os.Stat(infoPlist); err == nil {
		app.Description = fmt.Sprintf("macOS application: %s", name)
	}

	return app
}

func (am *AppManager) parseWindowsApp(path string) *AppInfo {
	name := filepath.Base(path)
	name = strings.TrimSuffix(name, filepath.Ext(name))

	app := &AppInfo{
		ID:          name,
		Name:        name,
		DisplayName: name,
		Path:        path,
		Category:    "Application",
		Icon:        "🖥️",
		Description: fmt.Sprintf("Windows application: %s", name),
	}

	return app
}

func (am *AppManager) LaunchApp(appID string) error {
	var app *AppInfo
	for _, a := range am.apps {
		if a.ID == appID {
			app = &a
			break
		}
	}

	if app == nil {
		return fmt.Errorf("application not found: %s", appID)
	}

	return am.launchAppByPath(app.Path)
}

func (am *AppManager) launchAppByPath(path string) error {
	switch runtime.GOOS {
	case "linux":
		parts := strings.Fields(path)
		if len(parts) == 0 {
			return fmt.Errorf("invalid path: %s", path)
		}
		cmd := exec.Command(parts[0], parts[1:]...)
		return cmd.Start()
	case "darwin":
		cmd := exec.Command("open", path)
		return cmd.Start()
	case "windows":
		cmd := exec.Command("cmd", "/c", "start", "", path)
		return cmd.Start()
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}
}
