package main

import (
	"fmt"
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

	var beds []models.Bed
	err = db.Joins("JOIN room_units ON room_units.id = beds.room_unit_id").
		Joins("JOIN rooms ON rooms.id = room_units.room_id").
		Where("rooms.service_type = ? OR rooms.name LIKE ?", "emergency", "%UGD%").
		Find(&beds).Error

	if err != nil {
		fmt.Println("Query error:", err)
		return
	}

	fmt.Printf("Found %d beds for UGD/IGD\n", len(beds))
	for _, b := range beds {
		fmt.Printf("BedID: %d, Status: %s, RoomUnitID: %d\n", b.ID, b.Status, b.RoomUnitID)
	}
}
