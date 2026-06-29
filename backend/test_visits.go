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

	var visits []models.Visit
	db.Preload("Room").Order("created_at desc").Limit(10).Find(&visits)
	for _, v := range visits {
		roomName := "N/A"
		serviceType := "N/A"
		if v.Room != nil {
			roomName = v.Room.Name
			serviceType = v.Room.ServiceType
		}
		var bedID uint
		if v.BedID != nil {
			bedID = *v.BedID
		}
		fmt.Printf("VisitID: %d, VisitType: %s, Room: %s, ServiceType: %s, Status: %s, BedID: %v\n", 
			v.ID, v.VisitType, roomName, serviceType, v.Status, bedID)
	}

	fmt.Println("== Beds ==")
	var beds []models.Bed
	db.Joins("JOIN room_units ON room_units.id = beds.room_unit_id").
		Joins("JOIN rooms ON rooms.id = room_units.room_id").
		Where("rooms.name LIKE ?", "%UGD%").
		Find(&beds)
	for _, b := range beds {
		fmt.Printf("BedID: %d, Status: %s\n", b.ID, b.Status)
	}
}
