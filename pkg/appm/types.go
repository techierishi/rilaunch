package appm

import (
	"strings"
	"time"
)

type AppInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	DisplayName string    `json:"displayName"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Path        string    `json:"path"`
	Category    string    `json:"category"`
	Keywords    []string  `json:"keywords"`
	LastUsed    time.Time `json:"lastUsed"`
}

type AppManager struct {
	apps []AppInfo
}

func NewAppManager() *AppManager {
	return &AppManager{
		apps: make([]AppInfo, 0),
	}
}

func (am *AppManager) GetApps() []AppInfo {
	return am.apps
}

func (am *AppManager) AddApp(app AppInfo) {
	am.apps = append(am.apps, app)
}

func (am *AppManager) SearchApps(query string) []AppInfo {
	if query == "" {
		return am.apps
	}

	var results []AppInfo
	query = strings.ToLower(query)

	for _, app := range am.apps {
		if am.matchesQuery(app, query) {
			results = append(results, app)
		}
	}

	return results
}

func (am *AppManager) matchesQuery(app AppInfo, query string) bool {
	if strings.Contains(strings.ToLower(app.Name), query) {
		return true
	}

	if strings.Contains(strings.ToLower(app.DisplayName), query) {
		return true
	}

	if strings.Contains(strings.ToLower(app.Description), query) {
		return true
	}

	for _, keyword := range app.Keywords {
		if strings.Contains(strings.ToLower(keyword), query) {
			return true
		}
	}

	return false
}
