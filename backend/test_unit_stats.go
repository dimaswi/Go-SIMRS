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

	unitStats := room.ComputeBedStatsByUnit(db)
	fmt.Printf("Room: %s (Code: %s)\n", room.Name, room.Code)
	for _, s := range unitStats {
		fmt.Printf("UnitCode: %s, UnitName: %s, Class: %s, TotalBeds: %d, AvailableBeds: %d\n", s.UnitCode, s.UnitName, s.Class, s.TotalBeds, s.AvailableBeds)
	}

	var rawat models.Room
	db.Where("name LIKE ?", "%BIR ALI%").First(&rawat)
	rUnitStats := rawat.ComputeBedStatsByUnit(db)
	fmt.Printf("Room: %s (Code: %s)\n", rawat.Name, rawat.Code)
	for _, s := range rUnitStats {
		fmt.Printf("UnitCode: %s, UnitName: %s, Class: %s, TotalBeds: %d, AvailableBeds: %d\n", s.UnitCode, s.UnitName, s.Class, s.TotalBeds, s.AvailableBeds)
	}
}
