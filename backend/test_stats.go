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

	var room models.Room
	db.Where("name LIKE ?", "%UGD%").First(&room)

	stats := room.ComputeBedStatsByClass(db)
	fmt.Printf("Room: %s\n", room.Name)
	for _, s := range stats {
		fmt.Printf("Class: %s, TotalBeds: %d, AvailableBeds: %d\n", s.Class, s.TotalBeds, s.AvailableBeds)
	}
}
