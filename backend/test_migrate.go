//go:build ignore

package main

import (
	"fmt"
	"starter/backend/database"
)

func main() {
	database.Connect()
	err := database.Migrate()
	if err != nil {
		fmt.Println("MIGRATE ERROR:", err)
	} else {
		fmt.Println("MIGRATE SUCCESS")
	}
}
