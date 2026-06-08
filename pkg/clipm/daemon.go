package clipm

import (
	"context"
	"encoding/binary"
	"fmt"
	"reflect"
	"rilaunch/pkg/config"
	"strings"

	"rilaunch/pkg/util"

	goclipboard "golang.design/x/clipboard"
)

type ClipboardEventCallback func()

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

	err := goclipboard.Init()
	if err != nil {
		panic(err)
	}

	ch := goclipboard.Watch(ctx, goclipboard.FmtText)

	for incomingData := range ch {
		var rawBytes []byte

		val := reflect.ValueOf(incomingData)
		if val.Kind() == reflect.Struct {
			for i := 0; i < val.NumField(); i++ {
				if val.Field(i).Kind() == reflect.Slice && val.Field(i).Type().Elem().Kind() == reflect.Uint8 {
					rawBytes = val.Field(i).Bytes()
					break
				}
			}
		} else if val.Kind() == reflect.Slice {
			rawBytes = val.Bytes()
		}

		clipDb := config.GetInstance()
		clipm := ClipM{
			DB: clipDb.DB,
		}

		copiedStr := string(rawBytes)
		if len(strings.TrimSpace(copiedStr)) == 0 {
			continue
		}

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

		if refreshCallback != nil {
			refreshCallback()
		}
	}

	return nil
}