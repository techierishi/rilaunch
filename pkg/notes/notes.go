package notes

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/adrg/frontmatter"
)

// Note is the application-side representation of a note
type Note struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// NoteMeta maps strictly to the YAML frontmatter block inside the markdown files
type NoteMeta struct {
	ID        string    `yaml:"id"`
	CreatedAt time.Time `yaml:"created"`
	UpdatedAt time.Time `yaml:"updated"`
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
	fm := fmt.Sprintf("---\nid: %s\ncreated: %s\nupdated: %s\n---\n",
		n.ID,
		n.CreatedAt.UTC().Format(time.RFC3339),
		n.UpdatedAt.UTC().Format(time.RFC3339),
	)
	return []byte(fm + n.Content)
}

func deserializeNote(raw string) (*Note, error) {
	var meta NoteMeta

	// frontmatter.Parse reads the YAML frontmatter block into our struct,
	// and returns the rest of the file contents as the markdown body.
	body, err := frontmatter.Parse(bytes.NewReader([]byte(raw)), &meta)
	if err != nil {
		return nil, fmt.Errorf("failed to parse frontmatter: %w", err)
	}

	return &Note{
		ID:        meta.ID,
		Content:   string(body),
		CreatedAt: meta.CreatedAt,
		UpdatedAt: meta.UpdatedAt,
	}, nil
}

func readNoteFile(path string) (*Note, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return deserializeNote(string(data))
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

func (s *NotesStore) Save(content string) (*Note, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}
	if err := s.EnsureDir(); err != nil {
		return nil, err
	}

	now := time.Now()
	id := now.Format("02_Jan_2006")
	path := notePath(s.Dir, id)

	_, err := os.Stat(path)
	exists := !os.IsNotExist(err)

	var note *Note

	if exists {
		existingNote, err := readNoteFile(path)
		if err != nil {
			return nil, fmt.Errorf("failed to read existing note for append: %w", err)
		}

		note = &Note{
			ID:        id,
			Content:   existingNote.Content + "\n\n" + content,
			CreatedAt: existingNote.CreatedAt,
			UpdatedAt: now,
		}
	} else {
		note = &Note{
			ID:        id,
			Content:   content,
			CreatedAt: now,
			UpdatedAt: now,
		}
	}

	if err := os.WriteFile(path, serializeNote(note), 0o600); err != nil {
		return nil, err
	}

	return note, nil
}

func (s *NotesStore) Update(id, content string) (*Note, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}

	path := notePath(s.Dir, id)
	note, err := readNoteFile(path)
	if err != nil {
		return nil, fmt.Errorf("note not found: %s", id)
	}

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
