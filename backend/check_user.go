package main
import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"starter/backend/models"
)

func main() {
	db, err := gorm.Open(postgres.Open("host=localhost user=postgres password=Dimasw1950 dbname=simrs port=5432 sslmode=disable"), &gorm.Config{})
	if err != nil {
		fmt.Println(err)
		return
	}
	var users []models.User
	db.Preload("Role").Preload("Employee").Where("full_name LIKE ?", "%Muqqodar%").Find(&users)
	for _, u := range users {
		fmt.Printf("User ID: %d, FullName: %s, EmployeeID: %v, Role: %v\n", u.ID, u.FullName, u.EmployeeID, u.Role.Name)
		if u.Employee != nil {
			fmt.Printf("  Employee: ID=%d, Name=%s, Tipe=%s\n", u.Employee.ID, u.Employee.NamaLengkap, u.Employee.TipeKaryawan)
		} else {
			fmt.Printf("  Employee: NIL!\n")
		}
	}
}
