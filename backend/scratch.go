package main

import (
	"fmt"
	"log"

	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/models"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		log.Fatal(err)
	}

	var queues []models.BPJSQueue
	if err := database.DB.Where("kode_poli = ?", "BED").Find(&queues).Error; err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d queues:\n", len(queues))
	for _, q := range queues {
		fmt.Printf("- %s | %s | %s | %s | jkn:%s | dr:%s | date:%s\n", q.KodeBooking, q.NomorAntrean, q.Status, q.Keterangan, q.JenisPasien, q.KodeDokter, q.TanggalPeriksa.Format("2006-01-02"))
	}
}
