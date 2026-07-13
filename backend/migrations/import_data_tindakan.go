package migrations

import (
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"starter/backend/models"

	"gorm.io/gorm"
)

// ImportDataTindakan reads data_tindakan.csv and replaces all existing procedures and tariffs
func ImportDataTindakan(db *gorm.DB) error {
	log.Println("Starting procedure data import...")

	// Open the CSV file
	file, err := os.Open("../data_tindakan.csv")
	if err != nil {
		file, err = os.Open("data_tindakan.csv")
		if err != nil {
			return fmt.Errorf("failed to open data_tindakan.csv: %w", err)
		}
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = ';'
	reader.LazyQuotes = true

	headers, err := reader.Read()
	if err != nil {
		return fmt.Errorf("failed to read headers: %w", err)
	}
	log.Printf("Found %d columns", len(headers))

	records, err := reader.ReadAll()
	if err != nil {
		return fmt.Errorf("failed to read records: %w", err)
	}
	log.Printf("Found %d data rows", len(records))

	// ========== PHASE 1: DELETE ALL EXISTING DATA ==========
	log.Println("Phase 1: Clearing existing procedure data...")

	// Use raw SQL to avoid FK issues; each statement in its own exec
	tables := []string{
		"DELETE FROM procedure_order_items",
		"DELETE FROM room_procedures",
		"DELETE FROM procedure_parameters",
		"DELETE FROM procedure_tariffs",
		"DELETE FROM clinical_package_procedure_items",
		"DELETE FROM visit_procedures",
		"DELETE FROM procedures",
	}
	for _, sql := range tables {
		if result := db.Exec(sql); result.Error != nil {
			log.Printf("Warning: %s -> %v", sql, result.Error)
		}
	}
	log.Println("Existing data cleared.")

	// ========== PHASE 2: GROUP CSV BY UNIQUE PROCEDURE ==========
	type csvTariffRow struct {
		kelasTarif string
		record     []string
	}
	type csvProcedure struct {
		namaTindakan  string
		jenisTindakan string
		tindakanID    string
		tariffs       []csvTariffRow
	}

	procMap := make(map[string]*csvProcedure)
	var procOrder []string

	for _, record := range records {
		if len(record) < 17 {
			continue
		}
		nama := strings.TrimSpace(record[0])
		if nama == "" {
			continue
		}

		if _, exists := procMap[nama]; !exists {
			procMap[nama] = &csvProcedure{
				namaTindakan:  nama,
				jenisTindakan: strings.TrimSpace(record[2]),
				tindakanID:    strings.TrimSpace(record[5]),
			}
			procOrder = append(procOrder, nama)
		}
		procMap[nama].tariffs = append(procMap[nama].tariffs, csvTariffRow{
			kelasTarif: strings.TrimSpace(record[3]),
			record:     record,
		})
	}

	log.Printf("Found %d unique procedures with tariffs", len(procOrder))

	// ========== PHASE 3: INSERT EACH PROCEDURE + TARIFFS ==========
	log.Println("Phase 2: Inserting procedures and tariffs...")

	createdProcedures := 0
	createdTariffs := 0
	failedProcedures := 0
	usedCodes := make(map[string]bool)

	for idx, nama := range procOrder {
		p := procMap[nama]

		procedureType := "medical"
		if strings.EqualFold(p.jenisTindakan, "Laboratorium") {
			procedureType = "laboratory"
		} else if strings.EqualFold(p.jenisTindakan, "Radiologi") {
			procedureType = "radiology"
		}
		isSurgical := strings.EqualFold(p.jenisTindakan, "Prosedur Bedah")

		// Generate unique code
		code := "TND-" + p.tindakanID
		if p.tindakanID == "" || p.tindakanID == `\N` {
			code = fmt.Sprintf("TND-X%d", time.Now().UnixNano())
		}
		if usedCodes[code] {
			code = fmt.Sprintf("%s-%d", code, idx)
		}
		usedCodes[code] = true

		// Use a savepoint (nested tx) so one failure doesn't kill everything
		txErr := db.Transaction(func(tx *gorm.DB) error {
			newProc := models.Procedure{
				Code:          code,
				Name:          p.namaTindakan,
				ProcedureType: procedureType,
				ServiceType:   "all",
				IsSurgical:    isSurgical,
				IsActive:      true,
			}
			if err := tx.Create(&newProc).Error; err != nil {
				return fmt.Errorf("create procedure: %w", err)
			}

			seenClass := make(map[string]bool)
		for _, t := range p.tariffs {
				pc := mapPatientClass(t.kelasTarif)
				if seenClass[pc] {
					continue // skip duplicate class
				}
				seenClass[pc] = true
				tariff := models.ProcedureTariff{
					ProcedureID:    newProc.ID,
					PatientClass:   mapPatientClass(t.kelasTarif),
					Administrasi:   parseFloat(t.record[7]),
					Sarana:         parseFloat(t.record[8]),
					BHP:            parseFloat(t.record[9]),
					DokterOperator: parseFloat(t.record[10]),
					DokterAnastesi: parseFloat(t.record[11]),
					DokterLainnya:  parseFloat(t.record[12]),
					PenataAnastesi: parseFloat(t.record[13]),
					Paramedis:      parseFloat(t.record[14]),
					NonMedis:       parseFloat(t.record[15]),
				}
				if err := tx.Create(&tariff).Error; err != nil {
					return fmt.Errorf("create tariff %s: %w", t.kelasTarif, err)
				}
				createdTariffs++
			}

			createdProcedures++
			return nil
		})

		if txErr != nil {
			log.Printf("FAILED [%d] %s (code %s): %v", idx, p.namaTindakan, code, txErr)
			failedProcedures++
		}
	}

	log.Println("============================================")
	log.Printf("Import Completed!")
	log.Printf("  Procedures created : %d", createdProcedures)
	log.Printf("  Tariffs created    : %d", createdTariffs)
	log.Printf("  Failed procedures  : %d", failedProcedures)
	log.Println("============================================")

	if failedProcedures > 0 {
		log.Printf("WARNING: %d procedures had issues but were skipped", failedProcedures)
	}
	return nil
}

// parseFloat safely converts a string to float64
func parseFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" || s == `\N` || s == "\\N" {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}

// mapPatientClass maps Indonesian class names to system class constants
func mapPatientClass(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	switch {
	case strings.Contains(input, "non kelas") || strings.Contains(input, "non_kelas"):
		return "non_kelas"
	case strings.Contains(input, "kelas iii") || strings.Contains(input, "kelas 3") || input == "3":
		return "kelas_3"
	case strings.Contains(input, "kelas ii") || strings.Contains(input, "kelas 2") || input == "2":
		return "kelas_2"
	case strings.Contains(input, "kelas i") || strings.Contains(input, "kelas 1") || input == "1":
		return "kelas_1"
	case strings.Contains(input, "vvip"):
		return "vvip"
	case strings.Contains(input, "vip"):
		return "vip"
	case strings.Contains(input, "hcu"):
		return "hcu"
	case strings.Contains(input, "intensif") || strings.Contains(input, "icu"):
		return "intensif"
	case strings.Contains(input, "isolasi"):
		return "isolasi"
	default:
		return "non_kelas"
	}
}