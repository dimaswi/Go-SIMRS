package main

import (
	"encoding/csv"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"starter/backend/config"
	"starter/backend/models"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const sourceTimeLayout = "2006-01-02 15:04:05"

var strengthPattern = regexp.MustCompile(`(?i)(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|gr|kg|ml|l|iu|meq|%)(?:/\d+(?:[.,]\d+)?\s*(?:ml|g|l))?)`)

type supplierCSVRow struct {
	ID      string
	Name    string
	Address string
	Phone   string
	Fax     string
	Date    string
	Status  string
	RefID   string
}

type medicineCSVRow struct {
	ID               string
	Name             string
	CategoryCode     string
	UnitCode         string
	BrandCode        string
	SupplierID       string
	GenericID        string
	GenericType      string
	Formulary        string
	Stock            string
	PurchasePrice    string
	VAT              string
	SellingPrice     string
	ExpiryDate       string
	UsageType        string
	SeparateClaim    string
	Date             string
	CreatedBy        string
	Status           string
	PreparationGroup string
	PreparationCode  string
}

type supplierImportStats struct {
	Created int
	Updated int
	Skipped int
}

type medicineImportStats struct {
	Created            int
	Updated            int
	Skipped            int
	SkippedNonMedicine int
	RoomStocksUpserted int
}

func main() {
	var (
		dryRun       bool
		supplierFile string
		medicineFile string
	)

	flag.BoolVar(&dryRun, "dry-run", false, "preview import without changing data")
	flag.StringVar(&supplierFile, "supplier-file", filepath.Clean("..\\supplier.csv"), "path to supplier csv")
	flag.StringVar(&medicineFile, "medicine-file", filepath.Clean("..\\data_obat.csv"), "path to medicine csv")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.DatabaseDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	fmt.Println("=== Supplier & Medicine CSV Importer ===")
	fmt.Println("Supplier file:", supplierFile)
	fmt.Println("Medicine file:", medicineFile)
	fmt.Println("Dry run:", dryRun)
	fmt.Println()

	suppliers, err := readSupplierCSV(supplierFile)
	if err != nil {
		log.Fatalf("failed to read supplier csv: %v", err)
	}

	medicines, err := readMedicineCSV(medicineFile)
	if err != nil {
		log.Fatalf("failed to read medicine csv: %v", err)
	}

	supplierNameByID := make(map[string]string, len(suppliers))
	supplierStats := importSuppliers(db, suppliers, dryRun, supplierNameByID)

	room, roomErr := findMedicineImportRoom(db)
	if roomErr != nil {
		log.Printf("warning: stock room not found, medicine master will still be imported: %v", roomErr)
	}
	medicineStats := importMedicines(db, medicines, dryRun, room, supplierNameByID)

	fmt.Println()
	fmt.Println("=== Import Summary ===")
	fmt.Printf("Suppliers created: %d\n", supplierStats.Created)
	fmt.Printf("Suppliers updated: %d\n", supplierStats.Updated)
	fmt.Printf("Suppliers skipped: %d\n", supplierStats.Skipped)
	fmt.Printf("Medicines created: %d\n", medicineStats.Created)
	fmt.Printf("Medicines updated: %d\n", medicineStats.Updated)
	fmt.Printf("Medicines skipped: %d\n", medicineStats.Skipped)
	fmt.Printf("Non-medicine rows skipped: %d\n", medicineStats.SkippedNonMedicine)
	fmt.Printf("Room stocks upserted: %d\n", medicineStats.RoomStocksUpserted)
	if room != nil {
		fmt.Printf("Stock room: %s (%s)\n", room.Name, room.Code)
	} else {
		fmt.Println("Stock room: not found")
	}
	if dryRun {
		fmt.Println("Dry run only. No data changed.")
	}
}

func readSupplierCSV(path string) ([]supplierCSVRow, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = ';'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	if _, err := reader.Read(); err != nil {
		return nil, err
	}

	rows := make([]supplierCSVRow, 0, 64)
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(record) < 8 {
			continue
		}

		rows = append(rows, supplierCSVRow{
			ID:      cleanCSVValue(record[0]),
			Name:    cleanCSVValue(record[1]),
			Address: cleanCSVValue(record[2]),
			Phone:   cleanCSVValue(record[3]),
			Fax:     cleanCSVValue(record[4]),
			Date:    cleanCSVValue(record[5]),
			Status:  cleanCSVValue(record[6]),
			RefID:   cleanCSVValue(record[7]),
		})
	}

	return rows, nil
}

func readMedicineCSV(path string) ([]medicineCSVRow, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = ';'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	if _, err := reader.Read(); err != nil {
		return nil, err
	}

	rows := make([]medicineCSVRow, 0, 512)
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(record) < 21 {
			continue
		}

		rows = append(rows, medicineCSVRow{
			ID:               cleanCSVValue(record[0]),
			Name:             cleanCSVValue(record[1]),
			CategoryCode:     cleanCSVValue(record[2]),
			UnitCode:         cleanCSVValue(record[3]),
			BrandCode:        cleanCSVValue(record[4]),
			SupplierID:       cleanCSVValue(record[5]),
			GenericID:        cleanCSVValue(record[6]),
			GenericType:      cleanCSVValue(record[7]),
			Formulary:        cleanCSVValue(record[8]),
			Stock:            cleanCSVValue(record[9]),
			PurchasePrice:    cleanCSVValue(record[10]),
			VAT:              cleanCSVValue(record[11]),
			SellingPrice:     cleanCSVValue(record[12]),
			ExpiryDate:       cleanCSVValue(record[13]),
			UsageType:        cleanCSVValue(record[14]),
			SeparateClaim:    cleanCSVValue(record[15]),
			Date:             cleanCSVValue(record[16]),
			CreatedBy:        cleanCSVValue(record[17]),
			Status:           cleanCSVValue(record[18]),
			PreparationGroup: cleanCSVValue(record[19]),
			PreparationCode:  cleanCSVValue(record[20]),
		})
	}

	return rows, nil
}

func importSuppliers(db *gorm.DB, rows []supplierCSVRow, dryRun bool, supplierNameByID map[string]string) supplierImportStats {
	stats := supplierImportStats{}

	for _, row := range rows {
		name := normalizeWhitespace(row.Name)
		if name == "" {
			stats.Skipped++
			continue
		}

		supplierNameByID[row.ID] = name

		if dryRun {
			var count int64
			if err := db.Unscoped().Model(&models.Supplier{}).
				Where("code = ? OR LOWER(name) = ?", buildSupplierCode(row.ID), strings.ToLower(name)).
				Count(&count).Error; err != nil {
				stats.Skipped++
				log.Printf("failed preview supplier %s: %v", name, err)
				continue
			}
			if count > 0 {
				stats.Updated++
			} else {
				stats.Created++
			}
			continue
		}

		var supplier models.Supplier
		err := db.Unscoped().
			Where("code = ? OR LOWER(name) = ?", buildSupplierCode(row.ID), strings.ToLower(name)).
			First(&supplier).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			stats.Skipped++
			log.Printf("failed loading supplier %s: %v", name, err)
			continue
		}

		createdAt := parseSourceTime(row.Date)
		notes := ""
		if row.Fax != "" {
			notes = "Fax: " + normalizeWhitespace(row.Fax)
		}
		if ref := normalizeWhitespace(row.RefID); ref != "" && ref != "0" {
			if notes != "" {
				notes += " | "
			}
			notes += "Ref sumber: " + ref
		}

		data := models.Supplier{
			Code:      buildSupplierCode(row.ID),
			Name:      name,
			Address:   normalizeWhitespace(row.Address),
			Phone:     normalizeWhitespace(row.Phone),
			Notes:     notes,
			IsActive:  row.Status == "1",
			CreatedAt: createdAt,
			UpdatedAt: createdAt,
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := db.Create(&data).Error; err != nil {
				stats.Skipped++
				log.Printf("failed creating supplier %s: %v", name, err)
				continue
			}
			stats.Created++
			continue
		}

		supplier.Code = data.Code
		supplier.Name = data.Name
		supplier.Address = data.Address
		supplier.Phone = data.Phone
		supplier.Notes = data.Notes
		supplier.IsActive = data.IsActive
		supplier.UpdatedAt = data.UpdatedAt
		if supplier.CreatedAt.IsZero() {
			supplier.CreatedAt = data.CreatedAt
		}
		supplier.DeletedAt = gorm.DeletedAt{}

		if err := db.Unscoped().Save(&supplier).Error; err != nil {
			stats.Skipped++
			log.Printf("failed updating supplier %s: %v", name, err)
			continue
		}
		stats.Updated++
	}

	return stats
}

func importMedicines(db *gorm.DB, rows []medicineCSVRow, dryRun bool, stockRoom *models.Room, supplierNameByID map[string]string) medicineImportStats {
	stats := medicineImportStats{}

	for _, row := range rows {
		if !isMedicineRow(row) {
			stats.SkippedNonMedicine++
			continue
		}

		name := prettifyName(row.Name)
		if name == "" {
			stats.Skipped++
			continue
		}

		code := buildMedicineCode(row.PreparationCode, row.ID)
		form := deriveMedicineForm(name)
		unit := deriveUnit(name, form)
		category := deriveMedicineCategory(row.GenericType, name)
		medicineType := deriveMedicineType(name)
		requireRecipe := medicineType == models.MedicineTypeHard || medicineType == models.MedicineTypeNarcotic || medicineType == models.MedicineTypePsychotrope
		strength := deriveStrength(name)
		genericName := deriveGenericName(name)
		purchasePrice := parseDecimal(row.PurchasePrice)
		sellingPrice := parseDecimal(row.SellingPrice)
		stock := parseInt(row.Stock)
		createdAt := parseSourceTime(row.Date)
		notes := buildMedicineNotes(row, supplierNameByID)
		isActive := row.Status == "1"

		if dryRun {
			var count int64
			if err := db.Model(&models.Medicine{}).Where("code = ?", code).Count(&count).Error; err != nil {
				stats.Skipped++
				log.Printf("failed preview medicine %s: %v", name, err)
				continue
			}
			if count > 0 {
				stats.Updated++
			} else {
				stats.Created++
			}
			if stockRoom != nil && stock > 0 {
				stats.RoomStocksUpserted++
			}
			continue
		}

		var medicine models.Medicine
		err := db.Where("code = ?", code).First(&medicine).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			stats.Skipped++
			log.Printf("failed loading medicine %s: %v", name, err)
			continue
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			medicine = models.Medicine{
				Code:               code,
				Name:               name,
				GenericName:        genericName,
				Category:           category,
				Type:               medicineType,
				Form:               form,
				Strength:           strength,
				Unit:               unit,
				UnitLarge:          "",
				LargeToSmallFactor: 1,
				Manufacturer:       "",
				MinStock:           0,
				MaxStock:           0,
				PurchasePrice:      purchasePrice,
				SellingPrice:       sellingPrice,
				Notes:              notes,
				IsActive:           isActive,
				RequireRecipe:      requireRecipe,
				CreatedAt:          createdAt,
				UpdatedAt:          createdAt,
			}
			if err := db.Create(&medicine).Error; err != nil {
				stats.Skipped++
				log.Printf("failed creating medicine %s: %v", name, err)
				continue
			}
			stats.Created++
		} else {
			medicine.Name = name
			medicine.GenericName = genericName
			medicine.Category = category
			medicine.Type = medicineType
			medicine.Form = form
			medicine.Strength = strength
			medicine.Unit = unit
			medicine.UnitLarge = ""
			medicine.LargeToSmallFactor = 1
			medicine.Manufacturer = ""
			medicine.PurchasePrice = purchasePrice
			medicine.SellingPrice = sellingPrice
			medicine.Notes = notes
			medicine.IsActive = isActive
			medicine.RequireRecipe = requireRecipe
			medicine.UpdatedAt = createdAt

			if err := db.Save(&medicine).Error; err != nil {
				stats.Skipped++
				log.Printf("failed updating medicine %s: %v", name, err)
				continue
			}
			stats.Updated++
		}

		if stockRoom != nil {
			if err := upsertRoomMedicineStock(db, stockRoom.ID, medicine.ID, stock); err != nil {
				log.Printf("failed upserting stock for %s: %v", name, err)
			} else {
				stats.RoomStocksUpserted++
			}
		}
	}

	return stats
}

func upsertRoomMedicineStock(db *gorm.DB, roomID uint, medicineID uint, quantity int) error {
	var roomMedicine models.RoomMedicine
	err := db.Where("room_id = ? AND medicine_id = ?", roomID, medicineID).First(&roomMedicine).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return db.Create(&models.RoomMedicine{
			RoomID:      roomID,
			MedicineID:  medicineID,
			Quantity:    quantity,
			MinQuantity: 0,
			Notes:       "Import dari data_obat.csv",
		}).Error
	}
	if err != nil {
		return err
	}

	roomMedicine.Quantity = quantity
	roomMedicine.MinQuantity = 0
	if strings.TrimSpace(roomMedicine.Notes) == "" {
		roomMedicine.Notes = "Import dari data_obat.csv"
	}
	return db.Save(&roomMedicine).Error
}

func findMedicineImportRoom(db *gorm.DB) (*models.Room, error) {
	var room models.Room
	err := db.
		Where("is_active = ? AND service_type = ?", true, "farmasi").
		Order("CASE WHEN room_type = 'depo_farmasi' THEN 0 WHEN room_type = 'gudang_farmasi' THEN 1 ELSE 2 END").
		Order("id ASC").
		First(&room).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

func isMedicineRow(row medicineCSVRow) bool {
	category := strings.TrimSpace(row.CategoryCode)
	if strings.HasPrefix(category, "101") {
		return true
	}

	name := strings.ToLower(normalizeWhitespace(row.Name))
	if strings.Contains(name, "sirup") || strings.Contains(name, "tablet") || strings.Contains(name, "kapsul") ||
		strings.Contains(name, "injeksi") || strings.Contains(name, "salep") || strings.Contains(name, "drop") ||
		strings.Contains(name, "supp") || strings.Contains(name, "infus") || strings.Contains(name, "gel") {
		return true
	}

	return false
}

func deriveMedicineCategory(genericType string, name string) models.MedicineCategory {
	lowerName := strings.ToLower(name)
	if strings.Contains(lowerName, "herbal") {
		return models.MedicineCategoryHerbal
	}
	if strings.Contains(lowerName, "jamu") {
		return models.MedicineCategoryTraditional
	}
	if genericType == "1" {
		return models.MedicineCategoryGeneric
	}
	return models.MedicineCategoryPatent
}

func deriveMedicineType(name string) models.MedicineType {
	lowerName := strings.ToLower(name)
	if strings.Contains(lowerName, "morphin") || strings.Contains(lowerName, "fentanyl") || strings.Contains(lowerName, "petidin") {
		return models.MedicineTypeNarcotic
	}
	if strings.Contains(lowerName, "diazepam") || strings.Contains(lowerName, "alprazolam") || strings.Contains(lowerName, "clobazam") {
		return models.MedicineTypePsychotrope
	}
	return models.MedicineTypeHard
}

func deriveMedicineForm(name string) models.MedicineForm {
	lowerName := strings.ToLower(name)

	switch {
	case strings.Contains(lowerName, "tablet"), strings.Contains(lowerName, " tab "):
		return models.MedicineFormTablet
	case strings.Contains(lowerName, "kapsul"), strings.Contains(lowerName, "capsule"), strings.Contains(lowerName, "capsul"):
		return models.MedicineFormCapsule
	case strings.Contains(lowerName, "sirup"), strings.Contains(lowerName, "syrup"):
		return models.MedicineFormSyrup
	case strings.Contains(lowerName, "injeksi"), strings.Contains(lowerName, "inj"), strings.Contains(lowerName, "amp"), strings.Contains(lowerName, "vial"), strings.Contains(lowerName, "nebul"):
		return models.MedicineFormInjection
	case strings.Contains(lowerName, "salep"):
		return models.MedicineFormOintment
	case strings.Contains(lowerName, "krim"), strings.Contains(lowerName, "cream"), strings.Contains(lowerName, "gel"):
		return models.MedicineFormCream
	case strings.Contains(lowerName, "drop"), strings.Contains(lowerName, "tetes"):
		return models.MedicineFormDrops
	case strings.Contains(lowerName, "serbuk"), strings.Contains(lowerName, "powder"), strings.Contains(lowerName, "sachet"):
		return models.MedicineFormPowder
	case strings.Contains(lowerName, "infus"), strings.Contains(lowerName, "flas"), strings.Contains(lowerName, "baxter"):
		return models.MedicineFormInfusion
	case strings.Contains(lowerName, "supp"):
		return models.MedicineFormSuppository
	case strings.Contains(lowerName, "spray"), strings.Contains(lowerName, "inhaler"):
		return models.MedicineFormInhaler
	case strings.Contains(lowerName, "patch"):
		return models.MedicineFormPatch
	default:
		return models.MedicineFormTablet
	}
}

func deriveUnit(name string, form models.MedicineForm) string {
	lowerName := strings.ToLower(name)
	switch form {
	case models.MedicineFormTablet:
		return "tablet"
	case models.MedicineFormCapsule:
		return "kapsul"
	case models.MedicineFormSyrup:
		return "botol"
	case models.MedicineFormInjection:
		if strings.Contains(lowerName, "amp") {
			return "ampul"
		}
		return "vial"
	case models.MedicineFormOintment, models.MedicineFormCream:
		return "tube"
	case models.MedicineFormDrops:
		return "botol"
	case models.MedicineFormPowder:
		return "sachet"
	case models.MedicineFormInfusion:
		return "botol"
	case models.MedicineFormSuppository:
		return "supp"
	case models.MedicineFormInhaler:
		return "inhaler"
	case models.MedicineFormPatch:
		return "patch"
	default:
		return "unit"
	}
}

func deriveStrength(name string) string {
	match := strengthPattern.FindStringSubmatch(name)
	if len(match) > 1 {
		return normalizeWhitespace(match[1])
	}
	return ""
}

func deriveGenericName(name string) string {
	cleaned := normalizeWhitespace(name)
	replacements := []string{
		"Injeksi", "Sirup", "Salep", "Gel", "Drop", "Drops", "Nebul", "Tablet", "Kapsul",
	}
	for _, replacement := range replacements {
		cleaned = strings.ReplaceAll(cleaned, replacement, "")
	}

	cleaned = strengthPattern.ReplaceAllString(cleaned, "")
	cleaned = normalizeWhitespace(cleaned)
	if cleaned == "" {
		return name
	}
	return cleaned
}

func buildMedicineNotes(row medicineCSVRow, supplierNameByID map[string]string) string {
	parts := make([]string, 0, 3)
	if supplierName := normalizeWhitespace(supplierNameByID[row.SupplierID]); supplierName != "" {
		parts = append(parts, "Supplier: "+supplierName)
	}
	if row.CategoryCode != "" {
		parts = append(parts, "Kategori sumber: "+row.CategoryCode)
	}
	if row.UnitCode != "" {
		parts = append(parts, "Satuan sumber: "+row.UnitCode)
	}
	return strings.Join(parts, " | ")
}

func buildSupplierCode(sourceID string) string {
	id := digitsOnly(sourceID)
	if id == "" {
		id = "0"
	}
	return "SUPCSV" + id
}

func buildMedicineCode(preparationCode string, sourceID string) string {
	code := digitsOnly(preparationCode)
	if code == "" || code == "0" {
		code = digitsOnly(sourceID)
	}
	if code == "" {
		code = "0"
	}
	return "OBT" + code
}

func parseSourceTime(value string) time.Time {
	parsed, err := time.ParseInLocation(sourceTimeLayout, value, time.Local)
	if err != nil {
		return time.Now()
	}
	return parsed
}

func parseDecimal(value string) float64 {
	cleaned := cleanCSVValue(value)
	if cleaned == "" {
		return 0
	}
	cleaned = strings.ReplaceAll(cleaned, ".", "")
	cleaned = strings.ReplaceAll(cleaned, ",", ".")
	number, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0
	}
	return number
}

func parseInt(value string) int {
	cleaned := cleanCSVValue(value)
	if cleaned == "" {
		return 0
	}
	number, err := strconv.Atoi(cleaned)
	if err != nil {
		return 0
	}
	return number
}

func cleanCSVValue(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == `\N` {
		return ""
	}
	return strings.TrimSpace(trimmed)
}

func normalizeWhitespace(value string) string {
	if value == "" {
		return ""
	}
	return strings.Join(strings.Fields(strings.ReplaceAll(value, "\u00a0", " ")), " ")
}

func digitsOnly(value string) string {
	var builder strings.Builder
	for _, r := range value {
		if unicode.IsDigit(r) {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func prettifyName(value string) string {
	value = normalizeWhitespace(value)
	if value == "" {
		return ""
	}

	tokens := strings.Fields(value)
	for i, token := range tokens {
		tokens[i] = prettifyToken(token)
	}
	return strings.Join(tokens, " ")
}

func prettifyToken(token string) string {
	if token == "" {
		return token
	}

	if hasDigit(token) || isAllUpperShort(token) {
		return token
	}

	lower := strings.ToLower(token)
	runes := []rune(lower)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

func hasDigit(value string) bool {
	for _, r := range value {
		if unicode.IsDigit(r) {
			return true
		}
	}
	return false
}

func isAllUpperShort(value string) bool {
	runes := []rune(value)
	if len(runes) > 4 {
		return false
	}
	for _, r := range runes {
		if unicode.IsLetter(r) && !unicode.IsUpper(r) {
			return false
		}
	}
	return true
}
