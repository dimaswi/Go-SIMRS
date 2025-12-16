package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"starter/backend/config"
	"starter/backend/models"
)

func main() {
	// Load config
	cfg := config.Load()

	// Connect to database
	dsn := cfg.DatabaseDSN

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Get file path from args or use default
	filePath := "../Code Systems 20250925 - iDRG.tsv"
	if len(os.Args) > 1 {
		filePath = os.Args[1]
	}

	fmt.Println("=== ICD Code Systems Importer ===")
	fmt.Println("File:", filePath)
	fmt.Println()

	// Run migrations first
	fmt.Println("Running migrations...")
	if err := db.AutoMigrate(&models.ICD10{}, &models.ICD9CM{}, &models.ICDOMorphology{}); err != nil {
		log.Fatal("Failed to migrate:", err)
	}

	// Ask user if they want to clear existing data
	fmt.Print("Clear existing ICD data before import? (y/n): ")
	var answer string
	fmt.Scanln(&answer)
	if strings.ToLower(answer) == "y" {
		fmt.Println("Clearing existing data...")
		db.Exec("TRUNCATE TABLE icd10 RESTART IDENTITY CASCADE")
		db.Exec("TRUNCATE TABLE icd9cm RESTART IDENTITY CASCADE")
		db.Exec("TRUNCATE TABLE icdo_morphology RESTART IDENTITY CASCADE")
	}

	// Import data
	importTSV(db, filePath)
}

func importTSV(db *gorm.DB, filePath string) {
	file, err := os.Open(filePath)
	if err != nil {
		log.Fatal("Failed to open file:", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	// Skip header line
	if scanner.Scan() {
		header := scanner.Text()
		fmt.Println("Header:", header)
	}

	var icd10Count, icd9cmCount, icdoCount int
	var icd10Batch []models.ICD10
	var icd9cmBatch []models.ICD9CM
	var icdoBatch []models.ICDOMorphology

	batchSize := 1000
	startTime := time.Now()
	lineNum := 1

	fmt.Println()
	fmt.Println("Importing data...")

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		fields := strings.Split(line, "\t")

		if len(fields) < 8 {
			continue
		}

		code := strings.TrimSpace(fields[0])
		code2 := strings.TrimSpace(fields[1])
		display := strings.TrimSpace(fields[2])
		system := strings.TrimSpace(fields[3])
		validCode := fields[4] == "1"
		accPdx := fields[5] == "Y"
		asterisk := fields[6] == "1"
		im := fields[7] == "1"

		switch system {
		case "ICD10_2010_IM":
			icd10Batch = append(icd10Batch, models.ICD10{
				Code:      code,
				Code2:     code2,
				Display:   display,
				ValidCode: validCode,
				AccPdx:    accPdx,
				Asterisk:  asterisk,
				IM:        im,
				IsActive:  true,
			})
			icd10Count++

			if len(icd10Batch) >= batchSize {
				if err := db.CreateInBatches(icd10Batch, batchSize).Error; err != nil {
					log.Printf("Error inserting ICD-10 batch at line %d: %v", lineNum, err)
				}
				icd10Batch = nil
				fmt.Printf("\rICD-10: %d | ICD-9-CM: %d | ICD-O: %d", icd10Count, icd9cmCount, icdoCount)
			}

		case "ICD9CM_2010_IM":
			icd9cmBatch = append(icd9cmBatch, models.ICD9CM{
				Code:      code,
				Code2:     code2,
				Display:   display,
				ValidCode: validCode,
				AccPdx:    accPdx,
				Asterisk:  asterisk,
				IM:        im,
				IsActive:  true,
			})
			icd9cmCount++

			if len(icd9cmBatch) >= batchSize {
				if err := db.CreateInBatches(icd9cmBatch, batchSize).Error; err != nil {
					log.Printf("Error inserting ICD-9-CM batch at line %d: %v", lineNum, err)
				}
				icd9cmBatch = nil
				fmt.Printf("\rICD-10: %d | ICD-9-CM: %d | ICD-O: %d", icd10Count, icd9cmCount, icdoCount)
			}

		case "ICDO_MORFOLOGY":
			icdoBatch = append(icdoBatch, models.ICDOMorphology{
				Code:      code,
				Code2:     code2,
				Display:   display,
				ValidCode: validCode,
				IsActive:  true,
			})
			icdoCount++

			if len(icdoBatch) >= batchSize {
				if err := db.CreateInBatches(icdoBatch, batchSize).Error; err != nil {
					log.Printf("Error inserting ICD-O batch at line %d: %v", lineNum, err)
				}
				icdoBatch = nil
				fmt.Printf("\rICD-10: %d | ICD-9-CM: %d | ICD-O: %d", icd10Count, icd9cmCount, icdoCount)
			}
		}
	}

	// Insert remaining batches
	if len(icd10Batch) > 0 {
		if err := db.CreateInBatches(icd10Batch, batchSize).Error; err != nil {
			log.Printf("Error inserting final ICD-10 batch: %v", err)
		}
	}
	if len(icd9cmBatch) > 0 {
		if err := db.CreateInBatches(icd9cmBatch, batchSize).Error; err != nil {
			log.Printf("Error inserting final ICD-9-CM batch: %v", err)
		}
	}
	if len(icdoBatch) > 0 {
		if err := db.CreateInBatches(icdoBatch, batchSize).Error; err != nil {
			log.Printf("Error inserting final ICD-O batch: %v", err)
		}
	}

	elapsed := time.Since(startTime)

	fmt.Println()
	fmt.Println()
	fmt.Println("=== Import Complete ===")
	fmt.Printf("ICD-10:    %d records\n", icd10Count)
	fmt.Printf("ICD-9-CM:  %d records\n", icd9cmCount)
	fmt.Printf("ICD-O:     %d records\n", icdoCount)
	fmt.Printf("Total:     %d records\n", icd10Count+icd9cmCount+icdoCount)
	fmt.Printf("Time:      %v\n", elapsed.Round(time.Millisecond))

	if err := scanner.Err(); err != nil {
		log.Fatal("Error reading file:", err)
	}
}
