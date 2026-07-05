package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"starter/backend/config"
	"starter/backend/database"
	"starter/backend/models"
	"time"

	"github.com/joho/godotenv"
)

const baseURL = "https://emsifa.github.io/api-wilayah-indonesia/api"

// API Response structures
type ProvinceAPI struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RegencyAPI struct {
	ID         string `json:"id"`
	ProvinceID string `json:"province_id"`
	Name       string `json:"name"`
}

type DistrictAPI struct {
	ID        string `json:"id"`
	RegencyID string `json:"regency_id"`
	Name      string `json:"name"`
}

type VillageAPI struct {
	ID         string `json:"id"`
	DistrictID string `json:"district_id"`
	Name       string `json:"name"`
}

var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

func main() {
	// Parse flags
	syncAll := flag.Bool("all", false, "Sync all regions (provinces, regencies, districts, villages)")
	syncProvinces := flag.Bool("provinces", false, "Sync provinces only")
	syncRegencies := flag.Bool("regencies", false, "Sync regencies for all provinces")
	syncDistricts := flag.Bool("districts", false, "Sync districts for all regencies")
	syncVillages := flag.Bool("villages", false, "Sync villages for all districts")
	provinceID := flag.String("province", "", "Sync regencies for specific province ID")
	regencyID := flag.String("regency", "", "Sync districts for specific regency ID")
	districtID := flag.String("district", "", "Sync villages for specific district ID")
	flag.Parse()

	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using default configuration")
	}

	// Load config
	cfg := config.Load()

	// Connect to database
	fmt.Println("🔌 Connecting to database...")
	if err := database.Connect(cfg.DatabaseDSN, cfg.CasemixDatabaseDSN); err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}
	fmt.Println("✅ Database connected!")

	// Run migrations
	// if err := database.Migrate(); err != nil {
	// 	log.Fatal("❌ Failed to migrate database:", err)
	// }

	// Execute based on flags
	if *syncAll {
		syncAllRegions()
	} else if *syncProvinces {
		syncProvincesOnly()
	} else if *provinceID != "" {
		syncRegenciesByProvince(*provinceID)
	} else if *syncRegencies {
		syncAllRegencies()
	} else if *regencyID != "" {
		syncDistrictsByRegency(*regencyID)
	} else if *syncDistricts {
		syncAllDistricts()
	} else if *districtID != "" {
		syncVillagesByDistrict(*districtID)
	} else if *syncVillages {
		syncAllVillages()
	} else {
		fmt.Println("Region Sync Command")
		fmt.Println("==================")
		fmt.Println("")
		fmt.Println("Usage:")
		fmt.Println("  go run cmd/sync_regions/main.go [flags]")
		fmt.Println("")
		fmt.Println("Flags:")
		fmt.Println("  -all              Sync all regions (takes a long time)")
		fmt.Println("  -provinces        Sync provinces only")
		fmt.Println("  -regencies        Sync regencies for all provinces")
		fmt.Println("  -districts        Sync districts for all regencies")
		fmt.Println("  -villages         Sync villages for all districts")
		fmt.Println("  -province=ID      Sync regencies for specific province")
		fmt.Println("  -regency=ID       Sync districts for specific regency")
		fmt.Println("  -district=ID      Sync villages for specific district")
		fmt.Println("")
		fmt.Println("Examples:")
		fmt.Println("  go run cmd/sync_regions/main.go -provinces")
		fmt.Println("  go run cmd/sync_regions/main.go -province=11")
		fmt.Println("  go run cmd/sync_regions/main.go -regency=1101")
		fmt.Println("  go run cmd/sync_regions/main.go -district=1101010")
		fmt.Println("  go run cmd/sync_regions/main.go -all")
		os.Exit(0)
	}

	// Print final stats
	printStats()
}

func fetchJSON(url string, target interface{}) error {
	resp, err := httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return json.Unmarshal(body, target)
}

func fetchProvinces() ([]ProvinceAPI, error) {
	var provinces []ProvinceAPI
	err := fetchJSON(baseURL+"/provinces.json", &provinces)
	return provinces, err
}

func fetchRegencies(provinceID string) ([]RegencyAPI, error) {
	var regencies []RegencyAPI
	err := fetchJSON(fmt.Sprintf("%s/regencies/%s.json", baseURL, provinceID), &regencies)
	return regencies, err
}

func fetchDistricts(regencyID string) ([]DistrictAPI, error) {
	var districts []DistrictAPI
	err := fetchJSON(fmt.Sprintf("%s/districts/%s.json", baseURL, regencyID), &districts)
	return districts, err
}

func fetchVillages(districtID string) ([]VillageAPI, error) {
	var villages []VillageAPI
	err := fetchJSON(fmt.Sprintf("%s/villages/%s.json", baseURL, districtID), &villages)
	return villages, err
}

func syncProvincesOnly() {
	fmt.Println("\n📍 Syncing Provinces...")
	fmt.Println("========================")

	provinces, err := fetchProvinces()
	if err != nil {
		log.Printf("❌ Failed to fetch provinces: %v\n", err)
		return
	}

	fmt.Printf("📥 Found %d provinces\n", len(provinces))

	for i, p := range provinces {
		province := models.Province{ID: p.ID, Name: p.Name}
		database.DB.Where(models.Province{ID: p.ID}).Assign(province).FirstOrCreate(&province)
		fmt.Printf("\r💾 Saving provinces... %d/%d", i+1, len(provinces))
	}

	fmt.Printf("\n✅ Successfully synced %d provinces!\n", len(provinces))
}

func syncRegenciesByProvince(provinceID string) {
	fmt.Printf("\n🏙️  Syncing Regencies for Province %s...\n", provinceID)
	fmt.Println("==========================================")

	// Check if province exists
	var province models.Province
	if err := database.DB.First(&province, "id = ?", provinceID).Error; err != nil {
		log.Printf("❌ Province %s not found. Please sync provinces first.\n", provinceID)
		return
	}

	fmt.Printf("📍 Province: %s\n", province.Name)

	regencies, err := fetchRegencies(provinceID)
	if err != nil {
		log.Printf("❌ Failed to fetch regencies: %v\n", err)
		return
	}

	fmt.Printf("📥 Found %d regencies\n", len(regencies))

	for i, r := range regencies {
		regency := models.Regency{ID: r.ID, ProvinceID: r.ProvinceID, Name: r.Name}
		database.DB.Where(models.Regency{ID: r.ID}).Assign(regency).FirstOrCreate(&regency)
		fmt.Printf("\r💾 Saving regencies... %d/%d", i+1, len(regencies))
	}

	fmt.Printf("\n✅ Successfully synced %d regencies for %s!\n", len(regencies), province.Name)
}

func syncAllRegencies() {
	fmt.Println("\n🏙️  Syncing All Regencies...")
	fmt.Println("============================")

	var provinces []models.Province
	database.DB.Find(&provinces)

	if len(provinces) == 0 {
		log.Println("❌ No provinces found. Please sync provinces first.")
		return
	}

	totalRegencies := 0
	for i, p := range provinces {
		fmt.Printf("\n📍 [%d/%d] %s\n", i+1, len(provinces), p.Name)

		regencies, err := fetchRegencies(p.ID)
		if err != nil {
			log.Printf("❌ Failed to fetch regencies for %s: %v\n", p.Name, err)
			continue
		}

		for _, r := range regencies {
			regency := models.Regency{ID: r.ID, ProvinceID: r.ProvinceID, Name: r.Name}
			database.DB.Where(models.Regency{ID: r.ID}).Assign(regency).FirstOrCreate(&regency)
		}
		totalRegencies += len(regencies)
		fmt.Printf("   ✅ Saved %d regencies\n", len(regencies))
	}

	fmt.Printf("\n✅ Successfully synced %d regencies total!\n", totalRegencies)
}

func syncDistrictsByRegency(regencyID string) {
	fmt.Printf("\n🗺️  Syncing Districts for Regency %s...\n", regencyID)
	fmt.Println("==========================================")

	// Check if regency exists
	var regency models.Regency
	if err := database.DB.Preload("Province").First(&regency, "id = ?", regencyID).Error; err != nil {
		log.Printf("❌ Regency %s not found. Please sync regencies first.\n", regencyID)
		return
	}

	fmt.Printf("🏙️  Regency: %s (%s)\n", regency.Name, regency.Province.Name)

	districts, err := fetchDistricts(regencyID)
	if err != nil {
		log.Printf("❌ Failed to fetch districts: %v\n", err)
		return
	}

	fmt.Printf("📥 Found %d districts\n", len(districts))

	for i, d := range districts {
		district := models.District{ID: d.ID, RegencyID: d.RegencyID, Name: d.Name}
		database.DB.Where(models.District{ID: d.ID}).Assign(district).FirstOrCreate(&district)
		fmt.Printf("\r💾 Saving districts... %d/%d", i+1, len(districts))
	}

	fmt.Printf("\n✅ Successfully synced %d districts for %s!\n", len(districts), regency.Name)
}

func syncAllDistricts() {
	fmt.Println("\n🗺️  Syncing All Districts...")
	fmt.Println("============================")

	var regencies []models.Regency
	database.DB.Preload("Province").Find(&regencies)

	if len(regencies) == 0 {
		log.Println("❌ No regencies found. Please sync regencies first.")
		return
	}

	totalDistricts := 0
	for i, r := range regencies {
		fmt.Printf("\r🏙️  [%d/%d] Fetching districts for %s...", i+1, len(regencies), r.Name)

		districts, err := fetchDistricts(r.ID)
		if err != nil {
			log.Printf("\n❌ Failed to fetch districts for %s: %v\n", r.Name, err)
			continue
		}

		for _, d := range districts {
			district := models.District{ID: d.ID, RegencyID: d.RegencyID, Name: d.Name}
			database.DB.Where(models.District{ID: d.ID}).Assign(district).FirstOrCreate(&district)
		}
		totalDistricts += len(districts)
	}

	fmt.Printf("\n✅ Successfully synced %d districts total!\n", totalDistricts)
}

func syncVillagesByDistrict(districtID string) {
	fmt.Printf("\n🏘️  Syncing Villages for District %s...\n", districtID)
	fmt.Println("==========================================")

	// Check if district exists
	var district models.District
	if err := database.DB.Preload("Regency.Province").First(&district, "id = ?", districtID).Error; err != nil {
		log.Printf("❌ District %s not found. Please sync districts first.\n", districtID)
		return
	}

	fmt.Printf("🗺️  District: %s (%s, %s)\n", district.Name, district.Regency.Name, district.Regency.Province.Name)

	villages, err := fetchVillages(districtID)
	if err != nil {
		log.Printf("❌ Failed to fetch villages: %v\n", err)
		return
	}

	fmt.Printf("📥 Found %d villages\n", len(villages))

	for i, v := range villages {
		village := models.Village{ID: v.ID, DistrictID: v.DistrictID, Name: v.Name}
		database.DB.Where(models.Village{ID: v.ID}).Assign(village).FirstOrCreate(&village)
		fmt.Printf("\r💾 Saving villages... %d/%d", i+1, len(villages))
	}

	fmt.Printf("\n✅ Successfully synced %d villages for %s!\n", len(villages), district.Name)
}

func syncAllVillages() {
	fmt.Println("\n🏘️  Syncing All Villages...")
	fmt.Println("============================")

	var districts []models.District
	database.DB.Preload("Regency.Province").Find(&districts)

	if len(districts) == 0 {
		log.Println("❌ No districts found. Please sync districts first.")
		return
	}

	totalVillages := 0
	for i, d := range districts {
		fmt.Printf("\r🗺️  [%d/%d] Fetching villages for %s...", i+1, len(districts), d.Name)

		villages, err := fetchVillages(d.ID)
		if err != nil {
			log.Printf("\n❌ Failed to fetch villages for %s: %v\n", d.Name, err)
			continue
		}

		for _, v := range villages {
			village := models.Village{ID: v.ID, DistrictID: v.DistrictID, Name: v.Name}
			database.DB.Where(models.Village{ID: v.ID}).Assign(village).FirstOrCreate(&village)
		}
		totalVillages += len(villages)

		if (i+1)%100 == 0 {
			fmt.Printf("\n   📊 Progress: %d districts, %d villages\n", i+1, totalVillages)
		}
	}

	fmt.Printf("\n✅ Successfully synced %d villages total!\n", totalVillages)
}

func syncAllRegions() {
	fmt.Println("\n🌏 Syncing All Regions...")
	fmt.Println("=========================")
	fmt.Println("⚠️  This will take a long time. Please be patient.")
	fmt.Println("")

	startTime := time.Now()

	// Step 1: Provinces
	syncProvincesOnly()

	// Step 2: Regencies
	syncAllRegencies()

	// Step 3: Districts
	syncAllDistricts()

	// Step 4: Villages
	syncAllVillages()

	elapsed := time.Since(startTime)
	fmt.Printf("\n🎉 All regions synced in %s!\n", elapsed.Round(time.Second))
}

func printStats() {
	fmt.Println("\n📊 Current Database Stats")
	fmt.Println("=========================")

	var provinceCount, regencyCount, districtCount, villageCount int64
	database.DB.Model(&models.Province{}).Count(&provinceCount)
	database.DB.Model(&models.Regency{}).Count(&regencyCount)
	database.DB.Model(&models.District{}).Count(&districtCount)
	database.DB.Model(&models.Village{}).Count(&villageCount)

	fmt.Printf("📍 Provinces:  %d\n", provinceCount)
	fmt.Printf("🏙️  Regencies:  %d\n", regencyCount)
	fmt.Printf("🗺️  Districts:  %d\n", districtCount)
	fmt.Printf("🏘️  Villages:   %d\n", villageCount)
}
