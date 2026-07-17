package main

import (
	"fmt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	dsn := "root:@tcp(127.0.0.1:3306)/simrs?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	var v []map[string]interface{}
	db.Table("visits").Where("id = 272").Find(&v)
	fmt.Println("Visit 272:")
	fmt.Println(v)

	var o []map[string]interface{}
	db.Table("procedure_orders").Where("target_visit_id = 272").Find(&o)
	fmt.Println("Orders for target visit 272:")
	fmt.Println(o)
}
