package notes

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	bolt "go.etcd.io/bbolt"
)

var NotesBucket = []byte("Notes")

type Note struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Tag       string    `json:"tag"`
	CreatedAt time.Time `json:"createdAt"`
}

type NotesStore struct {
	DB *bolt.DB
}

func (n *NotesStore) EnsureBucket() error {
	return n.DB.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(NotesBucket)
		return err
	})
}

func (n *NotesStore) Save(content, tag string) (*Note, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}
	if tag == "" {
		tag = "Note"
	}

	note := &Note{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Content:   content,
		Tag:       tag,
		CreatedAt: time.Now(),
	}

	data, err := json.Marshal(note)
	if err != nil {
		return nil, err
	}

	err = n.DB.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(NotesBucket)
		if b == nil {
			return fmt.Errorf("notes bucket not found")
		}
		return b.Put([]byte(note.ID), data)
	})

	return note, err
}

func (n *NotesStore) GetAll() ([]Note, error) {
	var notes []Note

	err := n.DB.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(NotesBucket)
		if b == nil {
			return nil
		}
		return b.ForEach(func(k, v []byte) error {
			var note Note
			if err := json.Unmarshal(v, &note); err != nil {
				return nil
			}
			notes = append(notes, note)
			return nil
		})
	})

	if err != nil {
		return nil, err
	}

	sort.Slice(notes, func(i, j int) bool {
		return notes[i].CreatedAt.After(notes[j].CreatedAt)
	})

	return notes, nil
}

func (n *NotesStore) Delete(id string) error {
	return n.DB.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(NotesBucket)
		if b == nil {
			return fmt.Errorf("notes bucket not found")
		}
		return b.Delete([]byte(id))
	})
}
