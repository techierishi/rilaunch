package appm

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"time"
)

type Manager struct {
	appManager *AppManager
	initialized bool
}

func NewManager() *Manager {
	return &Manager{
		appManager: NewAppManager(),
		initialized: false,
	}
}

func (m *Manager) Initialize() error {
	if m.initialized {
		return nil
	}

	fmt.Println("Discovering installed applications...")
	if err := m.appManager.DiscoverApps(); err != nil {
		return fmt.Errorf("failed to discover applications: %w", err)
	}

	if len(m.appManager.GetApps()) == 0 {
		m.addFallbackApps()
	}

	m.initialized = true
	fmt.Printf("Discovered %d applications\n", len(m.appManager.GetApps()))
	return nil
}

func (m *Manager) GetAllApps() (string, error) {
	if !m.initialized {
		if err := m.Initialize(); err != nil {
			return "", err
		}
	}

	apps := m.appManager.GetApps()

	sort.Slice(apps, func(i, j int) bool {
		return strings.ToLower(apps[i].DisplayName) < strings.ToLower(apps[j].DisplayName)
	})

	jsonData, err := json.Marshal(apps)
	if err != nil {
		return "", fmt.Errorf("failed to marshal applications: %w", err)
	}

	return string(jsonData), nil
}

func (m *Manager) SearchApps(query string) (string, error) {
	if !m.initialized {
		if err := m.Initialize(); err != nil {
			return "", err
		}
	}

	results := m.appManager.SearchApps(query)

	// Sort by relevance: exact matches, then starts-with, then alphabetical
	sort.Slice(results, func(i, j int) bool {
		queryLower := strings.ToLower(query)
		nameI := strings.ToLower(results[i].DisplayName)
		nameJ := strings.ToLower(results[j].DisplayName)

		if nameI == queryLower && nameJ != queryLower {
			return true
		}
		if nameI != queryLower && nameJ == queryLower {
			return false
		}

		if strings.HasPrefix(nameI, queryLower) && !strings.HasPrefix(nameJ, queryLower) {
			return true
		}
		if !strings.HasPrefix(nameI, queryLower) && strings.HasPrefix(nameJ, queryLower) {
			return false
		}

		return nameI < nameJ
	})

	jsonData, err := json.Marshal(results)
	if err != nil {
		return "", fmt.Errorf("failed to marshal search results: %w", err)
	}

	return string(jsonData), nil
}

func (m *Manager) LaunchApp(appID string) error {
	if !m.initialized {
		if err := m.Initialize(); err != nil {
			return err
		}
	}

	m.updateLastUsed(appID)

	return m.appManager.LaunchApp(appID)
}

func (m *Manager) updateLastUsed(appID string) {
	apps := m.appManager.GetApps()
	for i, app := range apps {
		if app.ID == appID {
			apps[i].LastUsed = time.Now()
			break
		}
	}
}

func (m *Manager) GetAppCount() int {
	if !m.initialized {
		return 0
	}
	return len(m.appManager.GetApps())
}

func (m *Manager) Refresh() error {
	m.initialized = false
	m.appManager = NewAppManager()
	return m.Initialize()
}

func (m *Manager) addFallbackApps() {
	fallbackApps := []AppInfo{
		{
			ID:          "terminal",
			Name:        "Terminal",
			DisplayName: "Terminal",
			Description: "Open system terminal",
			Icon:        "💻",
			Path:        getTerminalCommand(),
			Category:    "System",
			Keywords:    []string{"terminal", "console", "shell", "command"},
		},
		{
			ID:          "file-manager",
			Name:        "File Manager",
			DisplayName: "File Manager",
			Description: "Open file manager",
			Icon:        "📁",
			Path:        getFileManagerCommand(),
			Category:    "System",
			Keywords:    []string{"files", "folder", "explorer", "finder"},
		},
		{
			ID:          "calculator",
			Name:        "Calculator",
			DisplayName: "Calculator",
			Description: "Open calculator",
			Icon:        "🧮",
			Path:        getCalculatorCommand(),
			Category:    "Utilities",
			Keywords:    []string{"calculator", "calc", "math"},
		},
		{
			ID:          "text-editor",
			Name:        "Text Editor",
			DisplayName: "Text Editor",
			Description: "Open text editor",
			Icon:        "📝",
			Path:        getTextEditorCommand(),
			Category:    "Development",
			Keywords:    []string{"editor", "text", "notepad", "vim", "nano"},
		},
	}

	for _, app := range fallbackApps {
		if app.Path != "" {
			m.appManager.AddApp(app)
		}
	}
}

func getTerminalCommand() string {
	switch runtime.GOOS {
	case "linux":
		terminals := []string{"gnome-terminal", "konsole", "xfce4-terminal", "xterm"}
		for _, term := range terminals {
			if _, err := exec.LookPath(term); err == nil {
				return term
			}
		}
		return "xterm"
	case "darwin":
		return "open -a Terminal"
	case "windows":
		return "cmd"
	}
	return ""
}

func getFileManagerCommand() string {
	switch runtime.GOOS {
	case "linux":
		fileManagers := []string{"nautilus", "dolphin", "thunar", "pcmanfm"}
		for _, fm := range fileManagers {
			if _, err := exec.LookPath(fm); err == nil {
				return fm
			}
		}
		return "nautilus"
	case "darwin":
		return "open -a Finder"
	case "windows":
		return "explorer"
	}
	return ""
}

func getCalculatorCommand() string {
	switch runtime.GOOS {
	case "linux":
		calculators := []string{"gnome-calculator", "kcalc", "galculator", "qalculate-gtk"}
		for _, calc := range calculators {
			if _, err := exec.LookPath(calc); err == nil {
				return calc
			}
		}
		return "gnome-calculator"
	case "darwin":
		return "open -a Calculator"
	case "windows":
		return "calc"
	}
	return ""
}

func getTextEditorCommand() string {
	switch runtime.GOOS {
	case "linux":
		editors := []string{"gedit", "kate", "mousepad", "leafpad", "nano", "vim"}
		for _, editor := range editors {
			if _, err := exec.LookPath(editor); err == nil {
				return editor
			}
		}
		return "nano"
	case "darwin":
		return "open -a TextEdit"
	case "windows":
		return "notepad"
	}
	return ""
}
