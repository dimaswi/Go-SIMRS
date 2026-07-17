package main

import (
	"os"
	"path/filepath"
	"strings"
)

func main() {
	files, _ := filepath.Glob("backend/handlers/*.go")
	for _, f := range files {
		b, _ := os.ReadFile(f)
		s := string(b)
		if strings.Contains(s, "SetDrawColor(0, 0, 0)") {
			os.WriteFile(f, []byte(strings.ReplaceAll(s, "SetDrawColor(0, 0, 0)", "SetDrawColor(100, 100, 100)")), 0644)
		}
	}
}
