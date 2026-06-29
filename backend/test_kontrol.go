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

	var reg models.Registration
	if err := database.DB.Where("registration_number = ?", "REG202606240001").First(&reg).Error; err != nil {
		fmt.Println("Reg not found:", err)
		return
	}

	fmt.Printf("Reg ID: %d, SourceVisitID: %v\n", reg.ID, reg.SourceVisitID)

	var sk models.SuratKontrol
	if reg.SourceVisitID != nil {
		if err := database.DB.Where("visit_id = ?", *reg.SourceVisitID).First(&sk).Error; err != nil {
			fmt.Printf("SK not found for visit_id %d: %v\n", *reg.SourceVisitID, err)
		} else {
			fmt.Printf("SK Found! ID: %d, No: %s, Status: %s\n", sk.ID, sk.NoSuratKontrol, sk.Status)
		}
	}
}
