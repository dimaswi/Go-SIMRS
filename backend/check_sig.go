package main

import (
	"fmt"
	"github.com/joho/godotenv"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/models"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		fmt.Println("Error:", err)
		return
	}

	var types []string
	database.DB.Model(&models.DocumentSignature{}).Select("distinct(document_type)").Pluck("document_type", &types)
	fmt.Println("Document types in DB:", types)
	
	// Print all surat_kontrol rows
	var sigs []models.DocumentSignature
	database.DB.Where("document_type = ?", "surat_kontrol").Find(&sigs)
	fmt.Printf("Found %d surat_kontrol signatures\n", len(sigs))
	for _, s := range sigs {
		fmt.Printf("ID: %d, Required: %d\n", s.ID, s.RequiredSignatures)
	}
}
