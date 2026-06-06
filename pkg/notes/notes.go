package notes

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Note is stored as a markdown file with a simple YAML frontmatter header.
// File name: {id}.md   Location: NotesStore.Dir
type Note struct {
	ID        string    `json:"id"`
	Tag       string    `json:"tag"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type NotesStore struct {
	Dir string
}

func (s *NotesStore) EnsureDir() error {
	return os.MkdirAll(s.Dir, 0o700)
}

// ── file helpers ──────────────────────────────────────────────────────────────

func notePath(dir, id string) string {
	return filepath.Join(dir, id+".md")
}

func serializeNote(n *Note) []byte {
	fm := fmt.Sprintf("---\nid: %s\ntag: %s\ncreated: %s\nupdated: %s\n---\n",
		n.ID, n.Tag,
		n.CreatedAt.UTC().Format(time.RFC3339),
		n.UpdatedAt.UTC().Format(time.RFC3339),
	)
	return []byte(fm + n.Content)
}

func deserializeNote(raw string) (*Note, error) {
	if !strings.HasPrefix(raw, "---\n") {
		return nil, fmt.Errorf("missing frontmatter")
	}
	rest := raw[4:]
	end := strings.Index(rest, "\n---\n")
	if end < 0 {
		return nil, fmt.Errorf("unclosed frontmatter")
	}
	fm := rest[:end]
	body := rest[end+5:] // skip "\n---\n"

	meta := make(map[string]string)
	for _, line := range strings.Split(fm, "\n") {
		if p := strings.SplitN(line, ": ", 2); len(p) == 2 {
			meta[strings.TrimSpace(p[0])] = strings.TrimSpace(p[1])
		}
	}

	note := &Note{
		ID:      meta["id"],
		Tag:     meta["tag"],
		Content: body,
	}
	if note.Tag == "" {
		note.Tag = "Note"
	}
	if t, err := time.Parse(time.RFC3339, meta["created"]); err == nil {
		note.CreatedAt = t
	}
	if t, err := time.Parse(time.RFC3339, meta["updated"]); err == nil {
		note.UpdatedAt = t
	}
	return note, nil
}

func readNoteFile(path string) (*Note, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return deserializeNote(string(data))
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

func (s *NotesStore) Save(content, tag string) (*Note, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}
	if tag == "" {
		tag = "Note"
	}
	if err := s.EnsureDir(); err != nil {
		return nil, err
	}

	now := time.Now()
	note := &Note{
		ID:        fmt.Sprintf("%d", now.UnixNano()),
		Tag:       tag,
		Content:   content,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := os.WriteFile(notePath(s.Dir, note.ID), serializeNote(note), 0o600); err != nil {
		return nil, err
	}
	return note, nil
}

func (s *NotesStore) Update(id, content, tag string) (*Note, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}
	if tag == "" {
		tag = "Note"
	}

	path := notePath(s.Dir, id)
	note, err := readNoteFile(path)
	if err != nil {
		return nil, fmt.Errorf("note not found: %s", id)
	}

	note.Tag = tag
	note.Content = content
	note.UpdatedAt = time.Now()

	if err := os.WriteFile(path, serializeNote(note), 0o600); err != nil {
		return nil, err
	}
	return note, nil
}

func (s *NotesStore) GetAll() ([]Note, error) {
	if err := s.EnsureDir(); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(s.Dir)
	if err != nil {
		return nil, err
	}

	var notes []Note
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		note, err := readNoteFile(filepath.Join(s.Dir, e.Name()))
		if err != nil {
			continue // skip malformed files
		}
		notes = append(notes, *note)
	}

	sort.Slice(notes, func(i, j int) bool {
		return notes[i].CreatedAt.After(notes[j].CreatedAt)
	})
	return notes, nil
}

func (s *NotesStore) Delete(id string) error {
	return os.Remove(notePath(s.Dir, id))
}
