package clipm

import (
	"encoding/json"
	"fmt"
	"rilaunch/pkg/config"
	"sort"

	"github.com/rs/zerolog"
	bolt "go.etcd.io/bbolt"
)

type ClipM struct {
	Logger *zerolog.Logger
	DB     *bolt.DB
}

type ClipInfo struct {
	Application string   `json:"application"`
	Timestamp   int64    `json:"timestamp"`
	Content     string   `json:"content"`
	Hash        string   `json:"hash"`
	IsSecret    bool     `json:"is_secret"`
	Tag         []string `json:"tag"`
}

func (clipm *ClipM) Create(key string, clipInfo ClipInfo) error {
	return clipm.DB.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket(config.ClipBucket)
		if bucket == nil {
			return fmt.Errorf("clipInfo not found")
		}
		data, err := json.Marshal(clipInfo)
		if err != nil {
			return err
		}
		fmt.Println("Saving to clipdb...")
		return bucket.Put([]byte(key), data)
	})
}

func (clipm *ClipM) Read(key string) (*ClipInfo, error) {
	var clipInfo ClipInfo
	err := clipm.DB.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket(config.ClipBucket)
		if bucket == nil {
			return fmt.Errorf("clipInfo not found")
		}
		data := bucket.Get([]byte(key))
		return json.Unmarshal(data, &clipInfo)
	})
	if err != nil {
		return nil, err
	}
	return &clipInfo, nil
}

func (clipm *ClipM) ReadAll() (*[]ClipInfo, error) {
	var clipInfos []ClipInfo

	err := clipm.DB.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket(config.ClipBucket)
		if bucket == nil {
			return fmt.Errorf("clipInfo not found")
		}

		bucket.ForEach(func(k, v []byte) error {
			var data ClipInfo
			err := json.Unmarshal(v, &data)
			if err != nil {
				clipm.Logger.Printf("Error decoding JSON for key %s: %v", k, err)
				return nil
			}
			data.Hash = string(k)
			clipInfos = append(clipInfos, data)
			return nil
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &clipInfos, nil
}

func (clipm *ClipM) Update(key string, clipInfo ClipInfo) error {
	return clipm.DB.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket(config.ClipBucket)
		if bucket == nil {
			return fmt.Errorf("clipInfo not found")
		}
		data, err := json.Marshal(clipInfo)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(key), data)
	})
}

func (clipm *ClipM) MarkSecret(key string) error {
	return clipm.DB.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket(config.ClipBucket)
		if bucket == nil {
			return fmt.Errorf("clipInfo not found")
		}
		var clipInfo ClipInfo
		data := bucket.Get([]byte(key))
		err := json.Unmarshal(data, &clipInfo)
		if err != nil {
			return err
		}
		clipInfo.IsSecret = !clipInfo.IsSecret
		data, err = json.Marshal(clipInfo)
		if err != nil {
			return err
		}
		return bucket.Put([]byte(key), data)
	})
}

func (clipm *ClipM) DeleteBucket() error {
	return clipm.DB.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(config.ClipBucket)
		if b == nil {
			return nil
		}
		var keys [][]byte
		c := b.Cursor()
		for k, _ := c.First(); k != nil; k, _ = c.Next() {
			// Make a copy of the key because boltDB keys are only valid for the life of the transaction/cursor step
			kCopy := make([]byte, len(k))
			copy(kCopy, k)
			keys = append(keys, kCopy)
		}
		for _, k := range keys {
			if err := b.Delete(k); err != nil {
				return err
			}
		}
		return nil
	})
}

func (clipm *ClipM) Reverse(clipInfos []ClipInfo) {
	for i, j := 0, len(clipInfos)-1; i < j; i, j = i+1, j-1 {
		clipInfos[i], clipInfos[j] = clipInfos[j], clipInfos[i]
	}
}

func (clipm *ClipM) SortByTimestamp(clipInfos []ClipInfo) {
	sort.Sort(ByTimestamp(clipInfos))
}

type ByTimestamp []ClipInfo

func (a ByTimestamp) Len() int           { return len(a) }
func (a ByTimestamp) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a ByTimestamp) Less(i, j int) bool { return a[i].Timestamp > a[j].Timestamp }
