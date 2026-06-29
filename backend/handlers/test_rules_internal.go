package handlers

import (
	"fmt"
)

func TestRules() {
	rules := loadDocumentSignatureRules()
	for _, r := range rules {
		if r.DocumentType == "surat_kontrol" {
			fmt.Printf("Surat Kontrol Rule: %+v\n", r)
		}
	}
}
