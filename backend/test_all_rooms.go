package main

import (
	"fmt"
	"starter/backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=postgres password=Dimasw1950 dbname=simrs port=5432 sslmode=disable TimeZone=Asia/Jakarta"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Println("failed to connect to db")
		return
	}

	var rooms []models.Room
	db.Preload("Units").Find(&rooms)
	for _, r := range rooms {
		fmt.Printf("Room: %s, Code: %s\n", r.Name, r.Code)
		for _, u := range r.Units {
			fmt.Printf("  Unit: %s, Code: %s\n", u.Name, u.Code)
		}
	}
}
