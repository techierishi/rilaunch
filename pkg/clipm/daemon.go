package clipm

import (
	"context"
	"encoding/binary"
	"fmt"
	"rilaunch/pkg/config"

	"rilaunch/pkg/util"

	"golang.design/x/clipboard"
)

// ClipboardEventCallback is a function type for clipboard event notifications
type ClipboardEventCallback func()

// Global callback for UI refresh
var refreshCallback ClipboardEventCallback

type Clip struct {
	ID      int
	Time    int64
	Content []byte
}

func itob(v int) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, uint64(v))
	return b
}

func SetRefreshCallback(callback ClipboardEventCallback) {
	refreshCallback = callback
}

func Record(ctx context.Context) error {
	logger := util.GetLogInstance()
	logger.Info().Msg("Clipboard recording started...")

	err := clipboard.Init()
	if err != nil {
		panic(err)
	}

	ch := clipboard.Watch(ctx, clipboard.FmtText)

	for data := range ch {

		clipDb := config.GetInstance()
		clipm := ClipM{
			DB: clipDb.DB,
		}

		copiedStr := string(data)

		timestamp := util.UnixMilli()
		clipInfo := ClipInfo{
			Timestamp: timestamp,
			Content:   copiedStr,
		}
		hash := util.CalculateHash(copiedStr)

		clipm.Create(hash, clipInfo)

		str := util.CleanStr(copiedStr).StandardizeSpaces().TruncateText(10).ReplaceNewLine()
		logger.Info().Msg(string(str + "... COPIED!"))
		fmt.Printf("📋 Saving to clipdb: %s...\n", string(str))

		// Trigger UI refresh if callback is set
		if refreshCallback != nil {
			refreshCallback()
		}

	}

	return nil
}
