package main

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Employee struct {
	ID           uint
	NamaLengkap  string
	TipeKaryawan string
}

func main() {
	dsn := "host=localhost user=postgres password=postgres dbname=gosimrs port=5432 sslmode=disable TimeZone=Asia/Jakarta"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var results []struct {
		TipeKaryawan string
		Count        int
	}
	db.Model(&Employee{}).Select("tipe_karyawan, count(*) as count").Group("tipe_karyawan").Scan(&results)

	fmt.Printf("tipe_karyawan counts:\n")
	for _, r := range results {
		fmt.Printf(" - '%s': %d\n", r.TipeKaryawan, r.Count)
	}
}
