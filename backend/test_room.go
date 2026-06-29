package main

import (
	"fmt"
	"starter/backend/database"
	"starter/backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=postgres password=postgres dbname=gosimrs port=5432 sslmode=disable TimeZone=Asia/Jakarta"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		fmt.Println("failed to connect to db")
		return
	}

	var room models.Room
	db.Where("name LIKE ?", "%UGD%").First(&room)
	fmt.Printf("Room: %s, ServiceType: %s, Code: %s\n", room.Name, room.ServiceType, room.Code)

	var rooms []models.Room
	db.Find(&rooms)
	for _, r := range rooms {
		fmt.Printf("- %s (ServiceType: %s)\n", r.Name, r.ServiceType)
	}
}
