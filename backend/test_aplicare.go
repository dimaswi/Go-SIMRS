package main

import (
	"fmt"
	"log"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/services/bpjs"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
	cfg := config.Load()
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		log.Fatal(err)
	}
	
	client, err := bpjs.NewAplicareClient()
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	items, err := client.GetRefKelas()
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	for _, item := range items {
		fmt.Printf("Kode: %s, Nama: %s\n", item.KodeKelas, item.NamaKelas)
	}
}
