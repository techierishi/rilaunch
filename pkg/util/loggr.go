package util

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/rs/zerolog"
)

var logger *zerolog.Logger
var once sync.Once

func GetLogInstance() *zerolog.Logger {
	once.Do(func() {
		var err error
		logger, err = NewLogger(zerolog.DebugLevel)
		if err != nil {
			log.Fatal("error getting logger instance ", err)
		}
	})
	return logger
}

func GetDefaultConfigDir() (dir string, err error) {
	if env, ok := os.LookupEnv("PAL_CONFIG_DIR"); ok {
		dir = env
	} else if runtime.GOOS == "windows" {
		dir = os.Getenv("APPDATA")
		if dir == "" {
			dir = filepath.Join(os.Getenv("USERPROFILE"), "Application Data", "pal")
		}
		dir = filepath.Join(dir, "pal")
	} else {
		dir = filepath.Join(os.Getenv("HOME"), ".config", "pal")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("cannot create directory: %v", err)
	}
	return dir, nil
}


func NewLogger(level zerolog.Level) (*zerolog.Logger, error) {
	dataDir, err := GetDefaultConfigDir()
	if err != nil {
		return nil, fmt.Errorf("error while getting RESH data dir: %w", err)
	}
	logPath := filepath.Join(dataDir, "pal.log")

	file, err := os.OpenFile(
		logPath,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0664,
	)
	if err != nil {
		panic(err)
	}

	// defer file.Close()

	logger := zerolog.New(file).With().Timestamp().Logger()
	zerolog.SetGlobalLevel(level)

	return &logger, nil
}
