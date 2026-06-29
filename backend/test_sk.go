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
	err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN)
	if err != nil {
		fmt.Println("DB error:", err)
		return
	}

	var registrations []models.Registration
	database.DB.Where("is_follow_up = ?", true).Find(&registrations)

	for _, reg := range registrations {
		fmt.Printf("Reg %s: SourceVisitID=%v\n", reg.RegistrationNumber, reg.SourceVisitID)
		if reg.SourceVisitID != nil {
			var sks []models.SuratKontrol
			database.DB.Where("visit_id = ?", *reg.SourceVisitID).Find(&sks)
			if len(sks) == 0 {
				fmt.Printf("  -> No SuratKontrol found\n")
			} else {
				for _, sk := range sks {
					fmt.Printf("  -> Found SK: %s (Status=%s, RegID=%v, VisitID=%v)\n", sk.NoSuratKontrol, sk.Status, sk.RegistrationID, sk.VisitID)
				}
			}
		}
	}
	fmt.Println("Done.")
}
