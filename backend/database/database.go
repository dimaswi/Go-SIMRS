package database

import (
	"fmt"
	"log"
	"starter/backend/migrations"
	"starter/backend/models"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB
var CasemixDB *gorm.DB

func Connect(dsn string, casemixDsn string) error {
	var err error
	casemixDsn = strings.TrimSpace(casemixDsn)

	// Configure GORM with performance optimizations
	gormConfig := &gorm.Config{
		SkipDefaultTransaction:                   true,
		PrepareStmt:                              true,
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
	}

	// Main DB
	DB, err = gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to main database: %w", err)
	}
	configurePool(DB)

	if casemixDsn == "" || casemixDsn == dsn {
		CasemixDB = DB
		log.Println("Single database mode enabled: CasemixDB uses main database connection")
		return nil
	}

	// Casemix DB
	CasemixDB, err = gorm.Open(postgres.Open(casemixDsn), gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to casemix database: %w", err)
	}

	// Configure connection pools
	configurePool(CasemixDB)

	log.Println("Databases connected successfully with connection pooling")
	return nil
}

func configurePool(db *gorm.DB) {
	sqlDB, err := db.DB()
	if err != nil {
		return
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
}

// dropAllForeignKeys drops ALL foreign key constraints from all tables in the database.
func dropAllForeignKeys(db *gorm.DB) {
	log.Println("Dropping all foreign key constraints before migration...")

	var constraints []struct {
		TableName      string
		ConstraintName string
	}

	db.Raw(`
		SELECT tc.table_name, tc.constraint_name
		FROM information_schema.table_constraints tc
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema = 'public'
		ORDER BY tc.table_name
	`).Scan(&constraints)

	for _, c := range constraints {
		db.Exec(fmt.Sprintf("ALTER TABLE %q DROP CONSTRAINT IF EXISTS %q", c.TableName, c.ConstraintName))
	}

	log.Printf("Dropped %d foreign key constraints", len(constraints))
}

func Migrate() error {
	var err error
	// ==========================================
	// STEP 1: Drop ALL existing foreign key constraints
	// ==========================================
	dropAllForeignKeys(DB)
	if CasemixDB != nil && CasemixDB != DB {
		dropAllForeignKeys(CasemixDB)
	}

	// ==========================================
	// STEP 2: Handle legacy schema migrations
	// ==========================================

	// Handle room module restructure - drop old tables if they exist with old schema
	// Check if beds table has old room_id column (indicating old schema)
	if DB.Migrator().HasColumn(&models.Bed{}, "room_id") {
		log.Println("Detected old room schema, migrating to new structure...")
		// Nullify FK references in visits before dropping beds
		DB.Exec("UPDATE visits SET bed_id = NULL WHERE bed_id IS NOT NULL")
		DB.Exec("UPDATE bed_transfers SET from_bed_id = NULL, to_bed_id = NULL")
		DB.Exec("UPDATE admission_requests SET approved_bed_id = NULL")
		DB.Exec("UPDATE dispositions SET admission_bed_id = NULL")
		// Drop old tables in correct order
		DB.Exec("DROP TABLE IF EXISTS beds CASCADE")
		DB.Exec("DROP TABLE IF EXISTS room_staff CASCADE")
		DB.Exec("DROP TABLE IF EXISTS room_units CASCADE")
		DB.Exec("DROP TABLE IF EXISTS rooms CASCADE")
		log.Println("Dropped old room tables for schema migration")
	}

	// Handle new service_type column - check if rooms table exists but doesn't have service_type
	if DB.Migrator().HasTable(&models.Room{}) && !DB.Migrator().HasColumn(&models.Room{}, "service_type") {
		log.Println("Adding new columns to rooms table...")
		DB.Exec("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS service_type varchar(50)")
		DB.Exec("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS has_bed boolean DEFAULT false")
		DB.Exec("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS has_schedule boolean DEFAULT false")
		DB.Exec("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS operating_hours varchar(100)")
		DB.Exec(`UPDATE rooms SET service_type = 'rawat_inap', has_bed = true WHERE service_type IS NULL`)
		DB.Exec("ALTER TABLE rooms ALTER COLUMN service_type SET NOT NULL")
		log.Println("Updated rooms table with new columns")
	}

	// Handle removing operating_hours column if it exists (replaced by schedules table)
	if DB.Migrator().HasColumn(&models.Room{}, "operating_hours") {
		DB.Exec("ALTER TABLE rooms DROP COLUMN IF EXISTS operating_hours")
		log.Println("Removed operating_hours column from rooms table (replaced by schedules)")
	}

	// Remove BPJS master-data fields from medicines. This feature was reverted and the stale data must be deleted.
	if DB.Migrator().HasTable(&models.Medicine{}) {
		DB.Exec("ALTER TABLE medicines DROP COLUMN IF EXISTS bpjs_kode_obat")
		DB.Exec("ALTER TABLE medicines DROP COLUMN IF EXISTS bpjs_sync_status")
		DB.Exec("ALTER TABLE medicines DROP COLUMN IF EXISTS bpjs_sync_message")
		DB.Exec("ALTER TABLE medicines DROP COLUMN IF EXISTS bpjs_synced_at")
		log.Println("Removed legacy BPJS medicine master-data columns from medicines table")
	}

	// Handle queue counter migration - migrate from counter (int) to counter_id (FK)
	if DB.Migrator().HasTable(&models.Queue{}) {
		hasOldCounter := DB.Migrator().HasColumn(&models.Queue{}, "counter")
		hasCounterID := DB.Migrator().HasColumn(&models.Queue{}, "counter_id")

		if hasOldCounter || hasCounterID {
			log.Println("Migrating queue counter to counter_id...")

			// First, ensure counters table exists and has seed data
			if !DB.Migrator().HasTable(&models.Counter{}) {
				log.Println("Creating counters table first...")
				DB.AutoMigrate(&models.Counter{})
				// Seed default counters if not exists
				for i := 1; i <= 4; i++ {
					var counter models.Counter
					result := DB.Where("code = ?", fmt.Sprintf("L%d", i)).First(&counter)
					if result.RowsAffected == 0 {
						DB.Create(&models.Counter{
							Name:         fmt.Sprintf("Loket %d", i),
							Code:         fmt.Sprintf("L%d", i),
							Description:  fmt.Sprintf("Loket Pendaftaran %d", i),
							IsActive:     true,
							DisplayOrder: i,
							Location:     "Lantai 1 - Depan",
						})
						log.Printf("Created counter: Loket %d", i)
					}
				}
			}

			// Add counter_id column as nullable first if not exists
			if !hasCounterID {
				log.Println("Adding counter_id column...")
				DB.Exec("ALTER TABLE queues ADD COLUMN counter_id bigint")
			}

			// If old counter column exists, migrate the data
			if hasOldCounter {
				var counters []models.Counter
				DB.Order("display_order").Find(&counters)

				if len(counters) >= 4 {
					log.Println("Migrating queue data from counter to counter_id...")
					for i := 0; i < 4 && i < len(counters); i++ {
						oldCounterValue := i + 1
						result := DB.Exec("UPDATE queues SET counter_id = ? WHERE counter = ? AND counter_id IS NULL", counters[i].ID, oldCounterValue)
						log.Printf("Migrated %d queues from counter=%d to counter_id=%d", result.RowsAffected, oldCounterValue, counters[i].ID)
					}
				}

				if len(counters) > 0 {
					result := DB.Exec("UPDATE queues SET counter_id = ? WHERE counter_id IS NULL", counters[0].ID)
					if result.RowsAffected > 0 {
						log.Printf("Set default counter_id for %d remaining queues", result.RowsAffected)
					}
				}

				DB.Exec("ALTER TABLE queues DROP COLUMN IF EXISTS counter")
				log.Println("Dropped old counter column")
			}

			// Force delete any queues with null counter_id
			var nullCount int64
			DB.Model(&models.Queue{}).Where("counter_id IS NULL").Count(&nullCount)
			if nullCount > 0 {
				log.Printf("Deleting %d old queue records with null counter_id...", nullCount)
				DB.Exec("DELETE FROM queues WHERE counter_id IS NULL")
				log.Println("Old queue records deleted")
			}

			log.Println("Queue counter migration completed")
		}
	}

	// ==========================================
	// STEP 3: Auto-migrate all models with proper order for dependencies
	// ==========================================

	// Clean up orphaned eklaim_rm_order_items/results with NULL FK before NOT NULL migration.
	// They will be re-synced from the visit on next InitRMDuplicate / SyncRMFromVisit.
	{
		// Fix GORM column name mismatches: e_klaim_rm_order_id → eklaim_rm_order_id, etc.
		renameIfExists := func(table, oldCol, newCol string) {
			var exists int64
			DB.Raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", table, oldCol).Scan(&exists)
			if exists > 0 {
				var newExists int64
				DB.Raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", table, newCol).Scan(&newExists)
				if newExists > 0 {
					// Both exist: copy data from old to new where new is null, then drop old
					DB.Exec(fmt.Sprintf("UPDATE %s SET %s = %s WHERE %s IS NULL", table, newCol, oldCol, newCol))
					DB.Exec(fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", table, oldCol))
					log.Printf("Merged %s.%s into %s and dropped old column", table, oldCol, newCol)
				} else {
					DB.Exec(fmt.Sprintf("ALTER TABLE %s RENAME COLUMN %s TO %s", table, oldCol, newCol))
					log.Printf("Renamed %s.%s → %s", table, oldCol, newCol)
				}
			}
		}
		renameIfExists("eklaim_rm_order_items", "e_klaim_rm_order_id", "eklaim_rm_order_id")
		renameIfExists("eklaim_rm_order_results", "e_klaim_rm_order_item_id", "eklaim_rm_order_item_id")

		// Also clean up NULL FK rows
		var tblExists int64
		DB.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eklaim_rm_order_items'").Scan(&tblExists)
		if tblExists > 0 {
			DB.Exec("DELETE FROM eklaim_rm_order_items WHERE eklaim_rm_order_id IS NULL OR eklaim_rm_order_id = 0")
			DB.Exec("DELETE FROM eklaim_rm_order_items WHERE procedure_id IS NULL OR procedure_id = 0")
		}
		DB.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'eklaim_rm_order_results'").Scan(&tblExists)
		if tblExists > 0 {
			DB.Exec("DELETE FROM eklaim_rm_order_results WHERE eklaim_rm_order_item_id IS NULL OR eklaim_rm_order_item_id = 0")
			DB.Exec("DELETE FROM eklaim_rm_order_results WHERE procedure_parameter_id IS NULL OR procedure_parameter_id = 0")
		}
	}

	err = DB.AutoMigrate(
		&models.User{}, &models.Role{}, &models.Permission{},
		&models.Setting{}, &models.MasterData{}, &models.Counter{},
		&models.Employee{}, &models.Province{}, &models.Regency{},
		&models.District{}, &models.Village{},
		&models.Building{}, &models.Room{},
		&models.RoomUnit{}, &models.Bed{}, &models.RoomStaff{},
		&models.Patient{}, &models.PatientAllergy{},
		&models.Registration{}, &models.Visit{}, &models.Queue{},
		&models.RegistrationTariff{}, &models.Billing{}, &models.BillingItem{}, &models.BillingPayment{},
		&models.CashierShift{},
		&models.RoomQueue{}, &models.Schedule{},
		&models.Procedure{}, &models.ProcedureParameter{},
		&models.ICD10{}, &models.ICD9CM{}, &models.ICDOMorphology{},
		&models.LoincMaster{}, &models.SnomedMaster{},
		&models.Medicine{}, &models.MedicineBatch{}, &models.MedicineTransaction{},
		&models.Inventory{}, &models.InventoryItem{}, &models.InventoryTransaction{},
		&models.StockRequest{}, &models.StockRequestItem{},
		&models.StockRequestApproval{}, &models.StockRequestApprovalItem{},
		&models.StockDistribution{}, &models.StockDistributionItem{},
		&models.Purchase{}, &models.PurchaseItem{}, &models.PurchasePayment{},
		&models.StockOpname{}, &models.StockOpnameItem{}, &models.Supplier{},
		&models.RoomMedicine{}, &models.RoomInventory{},
		&models.MedicineOrder{}, &models.MedicineOrderItem{}, &models.PrescriptionReview{}, &models.MedicineReturn{},
		&models.ProcedureOrder{}, &models.ProcedureOrderItem{}, &models.ProcedureOrderResult{},
		&models.Triage{}, &models.Anamnesis{}, &models.PhysicalExamination{},
		&models.Diagnosis{}, &models.DiagnosisSummary{}, &models.AssessmentPlan{},
		&models.Disposition{}, &models.DischargePlanning{}, &models.BodyMarker{}, &models.AdmissionRequest{},
		&models.VitalSign{}, &models.CPPT{}, &models.FluidBalance{},
		&models.NursingCare{}, &models.BedTransfer{},
		&models.MedicineAdministrationTimesheetItem{}, &models.MedicineAdministrationTimesheetEntry{},
		&models.VisitProcedure{}, &models.VisitProcedureResult{},
		&models.MedicalRecordEditLog{},
		&models.FallRiskAssessment{}, // Resiko Jatuh
		&models.BersalinRecord{},     // Bersalin / Partus
		&models.O2UsageRecord{},      // Penggunaan Oksigen
		&models.VisitBHPUsage{},      // Penggunaan BHP per kunjungan
		&models.Notification{}, &models.UserTabPreference{},
		&models.EKlaimLocalLog{}, // E-Klaim Local Communication Logs
		// Digital Signatures & Audit Trail
		&models.SignatureLog{},            // Signature Activity Logs
		&models.DocumentSignature{},       // Document Signature Status
		&models.DocumentSignatureSigner{}, // Signer-level status for multi-signature
		&models.DocumentPDFCache{},        // Cached PDF blobs for cetakan
		// Nutrition/Gizi Management
		&models.NutritionIngredient{},            // Master Bahan Gizi
		&models.NutritionIngredientInvoice{},     // Faktur Bahan Gizi
		&models.NutritionIngredientInvoiceItem{}, // Item Faktur Bahan Gizi
		&models.NutritionMenu{},                  // Master Menu Makanan
		&models.NutritionMenuIngredient{},        // Komposisi bahan per menu
		&models.NutritionPackage{},               // Master Paket Makanan
		&models.NutritionPackageItem{},           // Item Paket Makanan
		&models.NutritionOrder{},                 // Order Gizi Pasien
		&models.NutritionOrderItem{},             // Item Order Gizi
	)

	if err != nil {
		return err
	}

	// ==========================================
	// STEP 4: Auto-migrate Casemix database (Mirrored RM tables)
	// ==========================================
	if CasemixDB == nil {
		return fmt.Errorf("casemix database connection is not initialized")
	}

	if CasemixDB == DB {
		log.Println("Skipping separate Casemix migration: using main database connection")
	} else {
		log.Println("Migrating Casemix database...")
		err = CasemixDB.AutoMigrate(
			&models.Triage{},               // Triage (UGD/IGD only)
			&models.Anamnesis{},            // Anamnesis
			&models.PhysicalExamination{},  // Physical Examination
			&models.Diagnosis{},            // Diagnoses
			&models.DiagnosisSummary{},     // Diagnosis Summary
			&models.AssessmentPlan{},       // Assessment & Plan
			&models.Disposition{},          // Disposition/Discharge
			&models.DischargePlanning{},    // Discharge Planning checklist
			&models.BodyMarker{},           // Body marker images and points
			&models.VitalSign{},            // Vital Signs History
			&models.MedicineOrder{},        // Medicine Orders
			&models.MedicineOrderItem{},    // Medicine Order Items
			&models.PrescriptionReview{},   // Telaah Resep
			&models.MedicineReturn{},       // Return Obat
			&models.ProcedureOrder{},       // Procedure Orders
			&models.ProcedureOrderItem{},   // Procedure Order Items
			&models.ProcedureOrderResult{}, // Procedure Order Results
			&models.VisitProcedure{},       // Visit Procedures
			&models.VisitProcedureResult{}, // Visit Procedure Results
			&models.CPPT{},                 // CPPT
			&models.FluidBalance{},         // Fluid Balance
			&models.NursingCare{},          // Nursing Care
			&models.FallRiskAssessment{},   // Fall Risk
			&models.BersalinRecord{},       // Bersalin
			&models.VisitBHPUsage{},        // Penggunaan BHP
			&models.BedTransfer{},          // Bed Transfer/Mutation
			// Digital Signatures & Audit Trail
			&models.SignatureLog{},            // Signature Activity Logs
			&models.DocumentSignature{},       // Document Signature Status
			&models.DocumentSignatureSigner{}, // Signer-level status for multi-signature
			&models.DocumentPDFCache{},        // Cached PDF blobs for cetakan
			// Nutrition/Gizi Management
			&models.NutritionIngredient{},     // Master Bahan Gizi
			&models.NutritionMenu{},           // Master Menu Makanan
			&models.NutritionMenuIngredient{}, // Komposisi bahan per menu
			&models.NutritionPackage{},        // Master Paket Makanan
			&models.NutritionPackageItem{},    // Item Paket Makanan
			&models.NutritionOrder{},          // Order Gizi Pasien
			&models.NutritionOrderItem{},      // Item Order Gizi
		)

		if err != nil {
			return err
		}
	}

	// Drop old unique index on nutrition_package_items if exists (replaced with regular composite index)
	if DB.Migrator().HasTable(&models.NutritionPackageItem{}) {
		DB.Exec("DROP INDEX IF EXISTS idx_package_menu")
	}

	log.Println("Database migrated successfully")

	// Fix existing SPRI records: set is_bpjs=true for non-LOCAL SPRIs that were created before is_bpjs column existed
	DB.Exec("UPDATE spri SET is_bpjs = true WHERE no_spri NOT LIKE 'LOCAL-%' AND is_bpjs = false AND deleted_at IS NULL")

	// Create partial unique indexes for soft delete support
	// These indexes only apply to non-deleted records (WHERE deleted_at IS NULL)
	createPartialUniqueIndexes()

	// Create additional performance indexes
	createPerformanceIndexes()

	// Seed default data (with optimized checks)
	if err := SeedData(); err != nil {
		return err
	}

	// Check if seed data already exists to skip unnecessary seeding
	var permCount, masterDataCount int64
	DB.Model(&models.Permission{}).Count(&permCount)
	DB.Model(&models.MasterData{}).Count(&masterDataCount)

	// Only seed if tables are empty (first run)
	if masterDataCount == 0 {
		log.Println("Seeding master data (first run)...")
		if err := migrations.SeedMasterData(DB); err != nil {
			return err
		}
	} else {
		log.Println("Skipping master data seed - data already exists")
	}

	// Add general_condition master data (untuk update tanpa drop table)
	if err := migrations.AddGeneralConditionData(DB); err != nil {
		log.Printf("Error adding general_condition data: %v", err)
	}

	// Check inventory/medicine/supplier data
	var supplierCount int64
	DB.Model(&models.Supplier{}).Count(&supplierCount)
	if supplierCount == 0 {
		log.Println("Seeding inventory/medicine/supplier data (first run)...")
		if err := migrations.SeedInventoryMedicineSupplier(DB); err != nil {
			return err
		}
	} else {
		log.Println("Skipping inventory/medicine/supplier seed - data already exists")
	}

	// Check procedures data
	var procedureCount int64
	DB.Model(&models.Procedure{}).Count(&procedureCount)
	if procedureCount == 0 {
		log.Println("Seeding procedures data (first run)...")
		if err := migrations.SeedProcedures(DB); err != nil {
			return err
		}
	} else {
		log.Println("Skipping procedures seed - data already exists")
	}

	// Check billing data
	var tariffCount int64
	DB.Model(&models.RegistrationTariff{}).Count(&tariffCount)
	if tariffCount == 0 {
		log.Println("Seeding billing data (first run)...")
		if err := migrations.SeedBillingData(DB); err != nil {
			return err
		}
	} else {
		log.Println("Skipping billing seed - data already exists")
	}

	// Note: LOINC & SNOMED master data diimport manual oleh user
	// Gunakan file SQL yang sudah disiapkan untuk mengisi tabel loinc_terminologi dan snomed_masters
	var loincCount int64
	DB.Model(&models.LoincMaster{}).Count(&loincCount)
	log.Printf("LOINC master data: %d rows", loincCount)

	var snomedCount int64
	DB.Model(&models.SnomedMaster{}).Count(&snomedCount)
	log.Printf("SNOMED master data: %d rows", snomedCount)

	if err := ensureBPJSApotekDefaults(); err != nil {
		return err
	}

	return nil
}

func ensureBPJSApotekDefaults() error {
	configKeys := models.GetIntegrationConfigKeys(models.IntegrationTypeBPJSApotek)
	for _, cfg := range configKeys {
		var existing models.IntegrationConfig
		err := DB.Where("integration = ? AND key = ?", cfg.Integration, cfg.Key).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := DB.Create(&models.IntegrationConfig{
				Integration: cfg.Integration,
				Key:         cfg.Key,
				Value:       cfg.Default,
				Description: cfg.Description,
				IsEncrypted: cfg.IsEncrypted,
				IsSecret:    cfg.IsSecret,
			}).Error; err != nil {
				return err
			}
			continue
		}

		if err != nil {
			return err
		}

		updates := map[string]interface{}{
			"description":  cfg.Description,
			"is_encrypted": cfg.IsEncrypted,
			"is_secret":    cfg.IsSecret,
		}

		if strings.TrimSpace(existing.Value) == "" && cfg.Default != "" {
			updates["value"] = cfg.Default
		}

		if err := DB.Model(&models.IntegrationConfig{}).
			Where("id = ?", existing.ID).
			Updates(updates).Error; err != nil {
			return err
		}
	}

	log.Println("Ensured BPJS Apotek defaults are configured")
	return nil
}

// createPerformanceIndexes creates indexes for frequently queried columns
func createPerformanceIndexes() {
	// Visits table - frequently filtered by status, room, and date
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_visits_room_id ON visits(room_id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_visits_check_in_time ON visits(check_in_time)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_visits_registration_id ON visits(registration_id)")

	// Registrations table
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_registrations_patient_id ON registrations(patient_id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_registrations_date ON registrations(registration_date)")

	// Queues table
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_queues_counter_id ON queues(counter_id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_queues_created_at ON queues(created_at)")

	// Room Queue table
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_room_queues_status ON room_queues(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_room_queues_room_id ON room_queues(room_id)")

	// Notifications table
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)")

	// Medicine Orders
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_medicine_orders_status ON medicine_orders(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_medicine_orders_source_visit_id ON medicine_orders(source_visit_id)")

	// Procedure Orders
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_procedure_orders_status ON procedure_orders(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_procedure_orders_source_visit_id ON procedure_orders(source_visit_id)")

	// Surgery Bookings - only create indexes if table exists
	if DB.Migrator().HasTable("surgery_bookings") {
		DB.Exec("CREATE INDEX IF NOT EXISTS idx_surgery_bookings_status ON surgery_bookings(status)")
		DB.Exec("CREATE INDEX IF NOT EXISTS idx_surgery_bookings_scheduled_date ON surgery_bookings(scheduled_date)")
		DB.Exec("CREATE INDEX IF NOT EXISTS idx_surgery_bookings_surgeon_id ON surgery_bookings(surgeon_id)")
		DB.Exec("CREATE INDEX IF NOT EXISTS idx_surgery_bookings_operating_room_id ON surgery_bookings(operating_room_id)")
		DB.Exec("CREATE INDEX IF NOT EXISTS idx_surgery_bookings_priority ON surgery_bookings(priority)")
	}

	log.Println("Performance indexes created")
}

// createPartialUniqueIndexes creates partial unique indexes for soft delete support
func createPartialUniqueIndexes() {
	// Drop old unique indexes and create partial ones

	// Users table
	DB.Exec("DROP INDEX IF EXISTS idx_users_email")
	DB.Exec("DROP INDEX IF EXISTS idx_users_username")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE deleted_at IS NULL")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE deleted_at IS NULL")

	// Roles table
	DB.Exec("DROP INDEX IF EXISTS idx_roles_name")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_unique ON roles(name) WHERE deleted_at IS NULL")

	// Permissions table
	DB.Exec("DROP INDEX IF EXISTS idx_permissions_name")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_name_unique ON permissions(name) WHERE deleted_at IS NULL")

	// Employees table - drop all old indexes first (including typos like n_ip)
	DB.Exec("DROP INDEX IF EXISTS idx_employees_nik")
	DB.Exec("DROP INDEX IF EXISTS idx_employees_nip")
	DB.Exec("DROP INDEX IF EXISTS idx_employees_n_ip") // typo fix
	DB.Exec("DROP INDEX IF EXISTS uni_employees_nik")
	DB.Exec("DROP INDEX IF EXISTS uni_employees_nip")
	// Only create unique indexes if columns exist
	if DB.Migrator().HasColumn(&models.Employee{}, "nik") {
		DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_nik_unique ON employees(nik) WHERE deleted_at IS NULL AND nik IS NOT NULL AND nik != ''")
	}
	if DB.Migrator().HasColumn(&models.Employee{}, "nip") {
		DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_nip_unique ON employees(nip) WHERE deleted_at IS NULL AND nip IS NOT NULL AND nip != ''")
	}

	// Rooms table
	DB.Exec("DROP INDEX IF EXISTS idx_rooms_code")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_code_unique ON rooms(code) WHERE deleted_at IS NULL")

	// Room Units table - unique code within a room
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_room_units_code_unique ON room_units(room_id, code) WHERE deleted_at IS NULL")

	// Beds table - unique bed number within a unit
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_beds_number_unique ON beds(room_unit_id, bed_number) WHERE deleted_at IS NULL")

	// Master Data table
	DB.Exec("DROP INDEX IF EXISTS idx_master_category_code")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_master_data_unique ON master_data(category, code) WHERE deleted_at IS NULL")

	// Patients table
	DB.Exec("DROP INDEX IF EXISTS idx_patients_no_rm")
	DB.Exec("DROP INDEX IF EXISTS idx_patients_nik")
	DB.Exec("DROP INDEX IF EXISTS idx_patients_no_bpjs")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_no_rm_unique ON patients(no_rm) WHERE deleted_at IS NULL")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_nik_unique ON patients(nik) WHERE deleted_at IS NULL AND nik IS NOT NULL AND nik != ''")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_no_bpjs_unique ON patients(no_bpjs) WHERE deleted_at IS NULL AND no_bpjs IS NOT NULL AND no_bpjs != ''")

	// Counters table
	DB.Exec("DROP INDEX IF EXISTS idx_counters_code")
	DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_counters_code_unique ON counters(code) WHERE deleted_at IS NULL")

	createMedicalRecordCasemixIndexes()

	log.Println("Partial unique indexes created for soft delete support")
}

func createMedicalRecordCasemixIndexes() {
	// Older deployments created unique indexes on visit_id for one-to-one RM
	// tables. Casemix records intentionally share the same visit_id as the
	// original RM, so uniqueness must be scoped by source.
	tables := []string{
		"triages",
		"anamneses",
		"physical_examinations",
		"assessment_plans",
		"dispositions",
		"discharge_plannings",
		"body_markers",
		"diagnosis_summaries",
		"bersalin_records",
	}

	for _, table := range tables {
		oldIndex := fmt.Sprintf("idx_%s_visit_id", table)
		DB.Exec(fmt.Sprintf("ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s", table, oldIndex))
		DB.Exec(fmt.Sprintf("DROP INDEX IF EXISTS %s", oldIndex))
		DB.Exec(fmt.Sprintf("CREATE INDEX IF NOT EXISTS %s ON %s(visit_id)", oldIndex, table))
		DB.Exec(fmt.Sprintf("CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_original_visit_unique ON %s(visit_id) WHERE deleted_at IS NULL AND is_casemix = false", table, table))
		DB.Exec(fmt.Sprintf("CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_casemix_visit_unique ON %s(visit_id, casemix_eklaim_id) WHERE deleted_at IS NULL AND is_casemix = true", table, table))
	}

	log.Println("Medical record casemix indexes normalized")
}

// CleanMigrate drops all tables and recreates them for fresh database structure
func CleanMigrate() error {
	// Drop tables in reverse order to handle foreign key constraints
	DB.Exec("DROP TABLE IF EXISTS role_permissions CASCADE")
	DB.Exec("DROP TABLE IF EXISTS user_tab_preferences CASCADE")
	DB.Exec("DROP TABLE IF EXISTS users CASCADE")
	DB.Exec("DROP TABLE IF EXISTS permissions CASCADE")
	DB.Exec("DROP TABLE IF EXISTS roles CASCADE")
	DB.Exec("DROP TABLE IF EXISTS settings CASCADE")
	DB.Exec("DROP TABLE IF EXISTS master_data CASCADE")

	log.Println("Dropped existing tables for clean migration")

	// Now run normal migration
	return Migrate()
}

func SeedData() error {
	// Always ensure all permissions exist (use upsert logic)
	log.Println("Ensuring all permissions exist...")

	// Seed granular permissions that match frontend permission checks
	permissions := []models.Permission{
		// Users Management
		{Name: "users.view", Module: "User Management", Category: "Users", Description: "View users list and details", Actions: `["read"]`},
		{Name: "users.create", Module: "User Management", Category: "Users", Description: "Create new users", Actions: `["create"]`},
		{Name: "users.update", Module: "User Management", Category: "Users", Description: "Update existing users", Actions: `["update"]`},
		{Name: "users.delete", Module: "User Management", Category: "Users", Description: "Delete users", Actions: `["delete"]`},

		// Roles Management
		{Name: "roles.view", Module: "Role Management", Category: "Roles", Description: "View roles list and details", Actions: `["read"]`},
		{Name: "roles.create", Module: "Role Management", Category: "Roles", Description: "Create new roles", Actions: `["create"]`},
		{Name: "roles.update", Module: "Role Management", Category: "Roles", Description: "Update existing roles", Actions: `["update"]`},
		{Name: "roles.delete", Module: "Role Management", Category: "Roles", Description: "Delete roles", Actions: `["delete"]`},
		{Name: "roles.assign_permissions", Module: "Role Management", Category: "Roles", Description: "Assign permissions to roles", Actions: `["assign"]`},

		// Permissions Management
		{Name: "permissions.view", Module: "Permission Management", Category: "Permissions", Description: "View permissions list and details", Actions: `["read"]`},
		{Name: "permissions.create", Module: "Permission Management", Category: "Permissions", Description: "Create new permissions", Actions: `["create"]`},
		{Name: "permissions.update", Module: "Permission Management", Category: "Permissions", Description: "Update existing permissions", Actions: `["update"]`},
		{Name: "permissions.delete", Module: "Permission Management", Category: "Permissions", Description: "Delete permissions", Actions: `["delete"]`},
		{Name: "document_signature_settings.manage", Module: "Document Signature Settings", Category: "Signatures", Description: "Manage per-document signature rules", Actions: `["read","update"]`},

		// Employees Management
		{Name: "employees.view", Module: "Employee Management", Category: "Employees", Description: "View employees list and details", Actions: `["read"]`},
		{Name: "employees.create", Module: "Employee Management", Category: "Employees", Description: "Create new employees", Actions: `["create"]`},
		{Name: "employees.update", Module: "Employee Management", Category: "Employees", Description: "Update existing employees", Actions: `["update"]`},
		{Name: "employees.delete", Module: "Employee Management", Category: "Employees", Description: "Delete employees", Actions: `["delete"]`},

		// Regions Management
		{Name: "regions.view", Module: "Region Management", Category: "Regions", Description: "View regions data (provinces, regencies, districts, villages)", Actions: `["read"]`},
		{Name: "regions.create", Module: "Region Management", Category: "Regions", Description: "Create new regions data", Actions: `["create"]`},
		{Name: "regions.update", Module: "Region Management", Category: "Regions", Description: "Update existing regions data", Actions: `["update"]`},
		{Name: "regions.sync", Module: "Region Management", Category: "Regions", Description: "Sync regions data from external API", Actions: `["sync"]`},

		// Master Data Management
		{Name: "master_data.view", Module: "Master Data Management", Category: "Master Data", Description: "View master data", Actions: `["read"]`},
		{Name: "master_data.create", Module: "Master Data Management", Category: "Master Data", Description: "Create master data", Actions: `["create"]`},
		{Name: "master_data.update", Module: "Master Data Management", Category: "Master Data", Description: "Update master data", Actions: `["update"]`},
		{Name: "master_data.delete", Module: "Master Data Management", Category: "Master Data", Description: "Delete master data", Actions: `["delete"]`},

		// Building Management
		{Name: "buildings.view", Module: "Building Management", Category: "Buildings", Description: "View buildings and floor plans", Actions: `["read"]`},
		{Name: "buildings.create", Module: "Building Management", Category: "Buildings", Description: "Create new buildings", Actions: `["create"]`},
		{Name: "buildings.update", Module: "Building Management", Category: "Buildings", Description: "Update existing buildings and floor plans", Actions: `["update"]`},
		{Name: "buildings.delete", Module: "Building Management", Category: "Buildings", Description: "Delete buildings", Actions: `["delete"]`},

		// Room Management
		{Name: "rooms.view", Module: "Room Management", Category: "Rooms", Description: "View rooms list and details", Actions: `["read"]`},
		{Name: "rooms.create", Module: "Room Management", Category: "Rooms", Description: "Create new rooms", Actions: `["create"]`},
		{Name: "rooms.update", Module: "Room Management", Category: "Rooms", Description: "Update existing rooms, beds, and staff", Actions: `["update"]`},
		{Name: "rooms.delete", Module: "Room Management", Category: "Rooms", Description: "Delete rooms", Actions: `["delete"]`},

		// Procedure Management (Tindakan)
		{Name: "procedures.view", Module: "Procedure Management", Category: "Procedures", Description: "View procedures list and details", Actions: `["read"]`},
		{Name: "procedures.create", Module: "Procedure Management", Category: "Procedures", Description: "Create new procedures", Actions: `["create"]`},
		{Name: "procedures.update", Module: "Procedure Management", Category: "Procedures", Description: "Update existing procedures", Actions: `["update"]`},
		{Name: "procedures.delete", Module: "Procedure Management", Category: "Procedures", Description: "Delete procedures", Actions: `["delete"]`},

		// ICD Code Management (Kode ICD)
		{Name: "icd.view", Module: "ICD Management", Category: "ICD", Description: "View ICD-10, ICD-9-CM, and ICD-O codes", Actions: `["read"]`},
		{Name: "icd.create", Module: "ICD Management", Category: "ICD", Description: "Create new ICD codes", Actions: `["create"]`},
		{Name: "icd.update", Module: "ICD Management", Category: "ICD", Description: "Update existing ICD codes", Actions: `["update"]`},
		{Name: "icd.delete", Module: "ICD Management", Category: "ICD", Description: "Delete ICD codes", Actions: `["delete"]`},

		// Patient Management (Pasien)
		{Name: "patients.view", Module: "Patient Management", Category: "Patients", Description: "View patients list and details", Actions: `["read"]`},
		{Name: "patients.create", Module: "Patient Management", Category: "Patients", Description: "Register new patients", Actions: `["create"]`},
		{Name: "patients.update", Module: "Patient Management", Category: "Patients", Description: "Update patient data", Actions: `["update"]`},
		{Name: "patients.delete", Module: "Patient Management", Category: "Patients", Description: "Delete patient records", Actions: `["delete"]`},

		// Cashier Shift Management (Shift Kasir)
		{Name: "cashier_shifts.view", Module: "Cashier Shift Management", Category: "Kasir", Description: "View active cashier shift status", Actions: `["read"]`},
		{Name: "cashier_shifts.open", Module: "Cashier Shift Management", Category: "Kasir", Description: "Open a new cashier shift", Actions: `["create"]`},
		{Name: "cashier_shifts.close", Module: "Cashier Shift Management", Category: "Kasir", Description: "Close an active cashier shift", Actions: `["update"]`},

		// Inventory Management (Inventaris)
		{Name: "inventories.view", Module: "Inventory Management", Category: "Inventories", Description: "View inventories list and details", Actions: `["read"]`},
		{Name: "inventories.create", Module: "Inventory Management", Category: "Inventories", Description: "Create new inventory items", Actions: `["create"]`},
		{Name: "inventories.update", Module: "Inventory Management", Category: "Inventories", Description: "Update inventory data and stock", Actions: `["update"]`},
		{Name: "inventories.delete", Module: "Inventory Management", Category: "Inventories", Description: "Delete inventory records", Actions: `["delete"]`},

		// Medicine/Pharmacy Management (Obat/Farmasi)
		{Name: "medicines.view", Module: "Medicine Management", Category: "Medicines", Description: "View medicines list and details", Actions: `["read"]`},
		{Name: "medicines.create", Module: "Medicine Management", Category: "Medicines", Description: "Create new medicine items", Actions: `["create"]`},
		{Name: "medicines.update", Module: "Medicine Management", Category: "Medicines", Description: "Update medicine data and stock", Actions: `["update"]`},
		{Name: "medicines.delete", Module: "Medicine Management", Category: "Medicines", Description: "Delete medicine records", Actions: `["delete"]`},

		// Stock Request Management (Permintaan Stok)
		{Name: "stock_requests.view", Module: "Stock Request Management", Category: "Stock Requests", Description: "View stock requests list and details", Actions: `["read"]`},
		{Name: "stock_requests.create", Module: "Stock Request Management", Category: "Stock Requests", Description: "Create new stock requests", Actions: `["create"]`},
		{Name: "stock_requests.update", Module: "Stock Request Management", Category: "Stock Requests", Description: "Update stock request data", Actions: `["update"]`},
		{Name: "stock_requests.delete", Module: "Stock Request Management", Category: "Stock Requests", Description: "Delete/cancel stock requests", Actions: `["delete"]`},
		{Name: "stock_requests.approve", Module: "Stock Request Management", Category: "Stock Requests", Description: "Approve or reject stock requests", Actions: `["approve"]`},

		// Distribution Management (Distribusi Stok)
		{Name: "distributions.view", Module: "Distribution Management", Category: "Distributions", Description: "View distributions list and details", Actions: `["read"]`},
		{Name: "distributions.create", Module: "Distribution Management", Category: "Distributions", Description: "Create new distributions from approved requests", Actions: `["create"]`},
		{Name: "distributions.receive", Module: "Distribution Management", Category: "Distributions", Description: "Receive and confirm distributions", Actions: `["receive"]`},

		// Supplier Management (Supplier)
		{Name: "suppliers.view", Module: "Supplier Management", Category: "Suppliers", Description: "View suppliers list and details", Actions: `["read"]`},
		{Name: "suppliers.create", Module: "Supplier Management", Category: "Suppliers", Description: "Create new suppliers", Actions: `["create"]`},
		{Name: "suppliers.update", Module: "Supplier Management", Category: "Suppliers", Description: "Update supplier data", Actions: `["update"]`},
		{Name: "suppliers.delete", Module: "Supplier Management", Category: "Suppliers", Description: "Delete supplier records", Actions: `["delete"]`},

		// Purchase Management (Pembelian)
		{Name: "purchases.view", Module: "Purchase Management", Category: "Purchases", Description: "View purchases list and details", Actions: `["read"]`},
		{Name: "purchases.create", Module: "Purchase Management", Category: "Purchases", Description: "Create new purchase orders", Actions: `["create"]`},
		{Name: "purchases.update", Module: "Purchase Management", Category: "Purchases", Description: "Update purchase data", Actions: `["update"]`},
		{Name: "purchases.delete", Module: "Purchase Management", Category: "Purchases", Description: "Delete purchase records", Actions: `["delete"]`},
		{Name: "purchases.approve", Module: "Purchase Management", Category: "Purchases", Description: "Approve purchase orders", Actions: `["approve"]`},
		{Name: "purchases.receive", Module: "Purchase Management", Category: "Purchases", Description: "Receive purchased items", Actions: `["receive"]`},

		// Stock Opname Management (Stock Opname)
		{Name: "stock_opname.view", Module: "Stock Opname Management", Category: "Stock Opname", Description: "View stock opname records", Actions: `["read"]`},
		{Name: "stock_opname.create", Module: "Stock Opname Management", Category: "Stock Opname", Description: "Create new stock opname", Actions: `["create"]`},
		{Name: "stock_opname.update", Module: "Stock Opname Management", Category: "Stock Opname", Description: "Update stock opname data", Actions: `["update"]`},
		{Name: "stock_opname.delete", Module: "Stock Opname Management", Category: "Stock Opname", Description: "Delete stock opname", Actions: `["delete"]`},
		{Name: "stock_opname.complete", Module: "Stock Opname Management", Category: "Stock Opname", Description: "Complete stock opname counting", Actions: `["complete"]`},
		{Name: "stock_opname.approve", Module: "Stock Opname Management", Category: "Stock Opname", Description: "Approve stock opname adjustments", Actions: `["approve"]`},

		// Room Medicine Stock (Stok Obat per Ruangan)
		{Name: "room-medicines.view", Module: "Room Medicine Stock", Category: "Room Stock", Description: "View room medicine stock", Actions: `["read"]`},
		{Name: "room-medicines.create", Module: "Room Medicine Stock", Category: "Room Stock", Description: "Assign medicine to room", Actions: `["create"]`},
		{Name: "room-medicines.update", Module: "Room Medicine Stock", Category: "Room Stock", Description: "Update room medicine stock", Actions: `["update"]`},
		{Name: "room-medicines.delete", Module: "Room Medicine Stock", Category: "Room Stock", Description: "Remove medicine from room", Actions: `["delete"]`},

		// Room Inventory Stock (Stok Inventaris per Ruangan)
		{Name: "room-inventories.view", Module: "Room Inventory Stock", Category: "Room Stock", Description: "View room inventory stock", Actions: `["read"]`},
		{Name: "room-inventories.create", Module: "Room Inventory Stock", Category: "Room Stock", Description: "Assign inventory to room", Actions: `["create"]`},
		{Name: "room-inventories.update", Module: "Room Inventory Stock", Category: "Room Stock", Description: "Update room inventory stock", Actions: `["update"]`},
		{Name: "room-inventories.delete", Module: "Room Inventory Stock", Category: "Room Stock", Description: "Remove inventory from room", Actions: `["delete"]`},

		// Queue Management (Antrean)
		{Name: "queues.view", Module: "Queue Management", Category: "Front Office", Description: "View queue list and details", Actions: `["read"]`},
		{Name: "queues.create", Module: "Queue Management", Category: "Front Office", Description: "Create/take queue number", Actions: `["create"]`},
		{Name: "queues.call", Module: "Queue Management", Category: "Front Office", Description: "Call and manage queues", Actions: `["call"]`},
		{Name: "queues.delete", Module: "Queue Management", Category: "Front Office", Description: "Cancel/skip queues", Actions: `["delete"]`},

		// Counter Management (Loket)
		{Name: "counters.view", Module: "Counter Management", Category: "Master Data", Description: "View counter/loket list and details", Actions: `["read"]`},
		{Name: "counters.create", Module: "Counter Management", Category: "Master Data", Description: "Create new counter/loket", Actions: `["create"]`},
		{Name: "counters.update", Module: "Counter Management", Category: "Master Data", Description: "Update counter/loket data", Actions: `["update"]`},
		{Name: "counters.delete", Module: "Counter Management", Category: "Master Data", Description: "Delete counter/loket", Actions: `["delete"]`},

		// Registration Management (Pendaftaran)
		{Name: "registrations.view", Module: "Registration Management", Category: "Front Office", Description: "View registration records", Actions: `["read"]`},
		{Name: "registrations.create", Module: "Registration Management", Category: "Front Office", Description: "Register patient from queue", Actions: `["create"]`},
		{Name: "registrations.update", Module: "Registration Management", Category: "Front Office", Description: "Update registration data", Actions: `["update"]`},
		{Name: "registrations.delete", Module: "Registration Management", Category: "Front Office", Description: "Cancel registrations", Actions: `["delete"]`},
		{Name: "registrations.checkin", Module: "Registration Management", Category: "Front Office", Description: "Check-in scheduled patients (scan QR/manual)", Actions: `["checkin"]`},

		// Room Queue Management (Antrian Ruangan)
		{Name: "room_queues.view", Module: "Room Queue Management", Category: "Front Office", Description: "View room queue list and details", Actions: `["read"]`},
		{Name: "room_queues.create", Module: "Room Queue Management", Category: "Front Office", Description: "Create room queue", Actions: `["create"]`},
		{Name: "room_queues.call", Module: "Room Queue Management", Category: "Front Office", Description: "Call room queue", Actions: `["call"]`},
		{Name: "room_queues.manage", Module: "Room Queue Management", Category: "Front Office", Description: "Manage room queue (serve, skip, cancel)", Actions: `["update", "delete"]`},
		{Name: "room_queues.stats", Module: "Room Queue Management", Category: "Front Office", Description: "View room queue statistics", Actions: `["read"]`},

		// Nutrition Management (Gizi)
		{Name: "nutrition.view", Module: "Nutrition Management", Category: "Gizi", Description: "View nutrition menus, ingredients, and invoices", Actions: `["read"]`},
		{Name: "nutrition.manage", Module: "Nutrition Management", Category: "Gizi", Description: "Manage nutrition data and meal packages", Actions: `["create", "update", "delete"]`},

		// Visit Management (Kunjungan)
		{Name: "visits.view", Module: "Visit Management", Category: "Medical", Description: "View patient visits", Actions: `["read"]`},
		{Name: "visits.create", Module: "Visit Management", Category: "Medical", Description: "Create patient visit", Actions: `["create"]`},
		{Name: "visits.update", Module: "Visit Management", Category: "Medical", Description: "Update visit data", Actions: `["update"]`},
		{Name: "visits.delete", Module: "Visit Management", Category: "Medical", Description: "Cancel visits", Actions: `["delete"]`},
		{Name: "visits.stats", Module: "Visit Management", Category: "Medical", Description: "View visit statistics", Actions: `["read"]`},

		// Medical Record Management (Rekam Medis)
		{Name: "medical_records.view", Module: "Medical Record Management", Category: "Medical", Description: "View medical records", Actions: `["read"]`},
		{Name: "medical_records.triage", Module: "Medical Record Management", Category: "Medical", Description: "Perform and update triage (UGD)", Actions: `["create", "update"]`},
		{Name: "medical_records.anamnesis", Module: "Medical Record Management", Category: "Medical", Description: "Create and update anamnesis", Actions: `["create", "update"]`},
		{Name: "medical_records.physical_exam", Module: "Medical Record Management", Category: "Medical", Description: "Create and update physical examination", Actions: `["create", "update"]`},
		{Name: "medical_records.diagnosis", Module: "Medical Record Management", Category: "Medical", Description: "Create and update diagnosis", Actions: `["create", "update"]`},
		{Name: "medical_records.assessment_plan", Module: "Medical Record Management", Category: "Medical", Description: "Create and update assessment & plan", Actions: `["create", "update"]`},
		{Name: "medical_records.disposition", Module: "Medical Record Management", Category: "Medical", Description: "Create and update disposition", Actions: `["create", "update"]`},
		{Name: "medical_records.sick_letter", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage sick letters (surat keterangan sakit)", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.death_certificate", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage death certificates (surat kematian)", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.procedure", Module: "Medical Record Management", Category: "Medical", Description: "Perform and record procedures during visit", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.inpatient", Module: "Medical Record Management", Category: "Medical", Description: "Manage inpatient records (CPPT, Fluid Balance)", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.cppt", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage CPPT records", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.nursing_care", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage nursing care (asuhan keperawatan) records", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.fall_risk", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage fall risk assessment records", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.fluid_balance", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage fluid balance records", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.bed_transfer", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage bed transfer (mutasi pasien) records", Actions: `["create", "update", "delete"]`},
		{Name: "medical_records.nutrition_order", Module: "Medical Record Management", Category: "Medical", Description: "Create and manage nutrition orders for inpatient", Actions: `["create", "read", "delete"]`},
		{Name: "medical_records.medicine_order", Module: "Medical Record Management", Category: "Medical", Description: "Create and view medicine orders from medical record", Actions: `["create", "read"]`},
		{Name: "medical_records.radiology_order", Module: "Medical Record Management", Category: "Medical", Description: "Create and view radiology orders from medical record", Actions: `["create", "read"]`},
		{Name: "medical_records.laboratory_order", Module: "Medical Record Management", Category: "Medical", Description: "Create and view laboratory orders from medical record", Actions: `["create", "read"]`},
		{Name: "medical_records.consultation_order", Module: "Medical Record Management", Category: "Medical", Description: "Create and view consultation orders from medical record", Actions: `["create", "read"]`},
		{Name: "medical_records.surgery_order", Module: "Medical Record Management", Category: "Medical", Description: "Create and view surgery orders from medical record", Actions: `["create", "read"]`},

		// Medicine Orders (Order Obat)
		{Name: "medicine_orders.view", Module: "Medicine Order Management", Category: "Pharmacy", Description: "View medicine orders", Actions: `["read"]`},
		{Name: "medicine_orders.create", Module: "Medicine Order Management", Category: "Pharmacy", Description: "Create medicine orders (prescriptions)", Actions: `["create"]`},
		{Name: "medicine_orders.update", Module: "Medicine Order Management", Category: "Pharmacy", Description: "Update pending medicine orders", Actions: `["update"]`},
		{Name: "medicine_orders.cancel", Module: "Medicine Order Management", Category: "Pharmacy", Description: "Cancel medicine orders", Actions: `["delete"]`},

		// Procedure Orders (Order Radiologi & Laboratorium)
		{Name: "procedure_orders.view", Module: "Procedure Order Management", Category: "Penunjang", Description: "View procedure orders", Actions: `["read"]`},
		{Name: "procedure_orders.create", Module: "Procedure Order Management", Category: "Penunjang", Description: "Create procedure orders", Actions: `["create"]`},
		{Name: "procedure_orders.edit", Module: "Procedure Order Management", Category: "Penunjang", Description: "Edit procedure order items (add/update/delete procedures)", Actions: `["create", "update", "delete"]`},
		{Name: "procedure_orders.perform", Module: "Procedure Order Management", Category: "Penunjang", Description: "Perform and input procedure results", Actions: `["update"]`},
		{Name: "procedure_orders.validate", Module: "Procedure Order Management", Category: "Penunjang", Description: "Validate procedure results", Actions: `["update"]`},

		// Pharmacy (Farmasi)
		{Name: "pharmacy.view", Module: "Pharmacy Management", Category: "Pharmacy", Description: "View pharmacy orders and queue", Actions: `["read"]`},
		{Name: "pharmacy.edit", Module: "Pharmacy Management", Category: "Pharmacy", Description: "Edit prescription items (add/update/delete medicines)", Actions: `["create", "update", "delete"]`},
		{Name: "pharmacy.review", Module: "Pharmacy Management", Category: "Pharmacy", Description: "Review prescriptions (telaah resep)", Actions: `["create", "update"]`},
		{Name: "pharmacy.dispense", Module: "Pharmacy Management", Category: "Pharmacy", Description: "Dispense medicines to patients", Actions: `["create", "update"]`},
		{Name: "pharmacy.return", Module: "Pharmacy Management", Category: "Pharmacy", Description: "Process medicine returns", Actions: `["create"]`},
		{Name: "pharmacy.final", Module: "Pharmacy Management", Category: "Pharmacy", Description: "Finalize pharmacy visit", Actions: `["create", "update"]`},

		// Procedure Orders (Radiologi & Laboratorium)
		{Name: "procedure_orders.final", Module: "Procedure Orders", Category: "Medical Services", Description: "Finalize radiology/laboratory visit", Actions: `["create", "update"]`},

		// Billing Management (Kasir & Tagihan)
		{Name: "billing.view", Module: "Billing Management", Category: "Front Office", Description: "View billing list and details", Actions: `["read"]`},
		{Name: "billing.create", Module: "Billing Management", Category: "Front Office", Description: "Generate billing from completed visits", Actions: `["create"]`},
		{Name: "billing.update", Module: "Billing Management", Category: "Front Office", Description: "Update billing (discount, adjustment)", Actions: `["update"]`},
		{Name: "billing.delete", Module: "Billing Management", Category: "Front Office", Description: "Cancel billing", Actions: `["delete"]`},
		{Name: "billing.payment", Module: "Billing Management", Category: "Front Office", Description: "Process payments for billing", Actions: `["create", "update"]`},
		{Name: "billing.void_payment", Module: "Billing Management", Category: "Front Office", Description: "Void/cancel payments", Actions: `["delete"]`},
		{Name: "billing.finalize", Module: "Billing Management", Category: "Front Office", Description: "Finalize billing after full payment", Actions: `["update"]`},

		// System & Dashboard
		{Name: "dashboard.view", Module: "Dashboard", Category: "Analytics", Description: "Access dashboard and reports", Actions: `["read"]`},
		{Name: "reports.view", Module: "Dashboard", Category: "Analytics", Description: "View analytics reports", Actions: `["read"]`},
		{Name: "settings.view", Module: "System Settings", Category: "Settings", Description: "View system settings", Actions: `["read"]`},
		{Name: "settings.update", Module: "System Settings", Category: "Settings", Description: "Update system settings", Actions: `["update"]`},
		{Name: "profile.view", Module: "Profile Management", Category: "Account", Description: "View own profile", Actions: `["read"]`},
		{Name: "profile.update", Module: "Profile Management", Category: "Account", Description: "Update own profile", Actions: `["update"]`},

		// System Integrations
		{Name: "integrations.view", Module: "System Integrations", Category: "Integrations", Description: "View system integrations configuration", Actions: `["read"]`},
		{Name: "integrations.manage", Module: "System Integrations", Category: "Integrations", Description: "Manage system integrations (BPJS, SatuSehat, etc)", Actions: `["read", "create", "update", "delete"]`},
		{Name: "integrations.sync", Module: "System Integrations", Category: "Integrations", Description: "Sync data with external systems", Actions: `["sync"]`},

		// Medical Record Archives (Arsip Rekam Medis)
		{Name: "archives.view", Module: "Archive Management", Category: "Archives", Description: "View medical record archives", Actions: `["read"]`},
		{Name: "archives.manage", Module: "Archive Management", Category: "Archives", Description: "Manage archive locations and status", Actions: `["create", "update"]`},
		{Name: "archives.borrow", Module: "Archive Management", Category: "Archives", Description: "Borrow and return medical record archives", Actions: `["create", "update"]`},
		{Name: "archives.destruction", Module: "Archive Management", Category: "Archives", Description: "Propose archive destruction", Actions: `["create"]`},
		{Name: "archives.destruction.approve", Module: "Archive Management", Category: "Archives", Description: "Approve archive destruction proposals", Actions: `["update"]`},
		{Name: "archives.destruction.execute", Module: "Archive Management", Category: "Archives", Description: "Execute archive destruction", Actions: `["delete"]`},

		// E-Klaim Management (iDRG & INACBG per 25 Kriteria KEMENKES)
		{Name: "eklaim.view", Module: "E-Klaim Management", Category: "Billing", Description: "View E-Klaim list and details", Actions: `["read"]`},
		{Name: "eklaim.create", Module: "E-Klaim Management", Category: "Billing", Description: "Create E-Klaim from visit", Actions: `["create"]`},
		{Name: "eklaim.edit", Module: "E-Klaim Management", Category: "Billing", Description: "Edit E-Klaim data and diagnoses/procedures", Actions: `["update"]`},
		{Name: "eklaim.grouping", Module: "E-Klaim Management", Category: "Billing", Description: "Perform iDRG and INACBG grouping", Actions: `["update"]`},
		{Name: "eklaim.final", Module: "E-Klaim Management", Category: "Billing", Description: "Finalize iDRG, INACBG, and Claim", Actions: `["update"]`},
		{Name: "eklaim.send", Module: "E-Klaim Management", Category: "Billing", Description: "Send claim to BPJS", Actions: `["create"]`},
		{Name: "eklaim.delete", Module: "E-Klaim Management", Category: "Billing", Description: "Delete E-Klaim records", Actions: `["delete"]`},
	}

	// Batch insert permissions using CreateInBatches for better performance
	// Use Clauses to handle conflicts (skip if already exists)
	if err := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "name"}},
		DoNothing: true,
	}).CreateInBatches(permissions, 50).Error; err != nil {
		log.Printf("Warning: batch permission insert had issues: %v", err)
		// Fallback to individual inserts if batch fails
		for _, perm := range permissions {
			DB.Where(models.Permission{Name: perm.Name}).FirstOrCreate(&perm)
		}
	}

	log.Println("Permissions seeded successfully")
	return seedRolesAndAdmin()
}

// seedRolesAndAdmin creates default roles and admin user
func seedRolesAndAdmin() error {
	assignPermissionsToRoles := func(roleNames []string, permissions []models.Permission, replace bool) {
		if len(roleNames) == 0 || len(permissions) == 0 {
			return
		}

		var roles []models.Role
		if err := DB.Where("name IN ?", roleNames).Find(&roles).Error; err != nil {
			log.Printf("Failed loading roles for permission seed (%v): %v", roleNames, err)
			return
		}
		if len(roles) == 0 {
			return
		}

		for _, role := range roles {
			assoc := DB.Model(&role).Association("Permissions")
			if replace {
				if err := assoc.Replace(permissions); err != nil {
					log.Printf("Failed replacing permissions for role %s: %v", role.Name, err)
				}
				continue
			}

			if err := assoc.Append(permissions); err != nil {
				log.Printf("Failed appending permissions for role %s: %v", role.Name, err)
			}
		}
	}

	loadPermissionsByNames := func(permissionNames []string) []models.Permission {
		if len(permissionNames) == 0 {
			return nil
		}
		var permissions []models.Permission
		if err := DB.Where("name IN ?", permissionNames).Find(&permissions).Error; err != nil {
			log.Printf("Failed loading permissions for seed (%v): %v", permissionNames, err)
			return nil
		}
		return permissions
	}

	// Create default roles
	var adminRole models.Role
	DB.Where(models.Role{Name: "admin"}).FirstOrCreate(&adminRole, models.Role{
		Name:        "admin",
		Description: "Administrator with full access",
	})

	var userRole models.Role
	DB.Where(models.Role{Name: "user"}).FirstOrCreate(&userRole, models.Role{
		Name:        "user",
		Description: "Regular user with limited access",
	})

	// Assign all permissions to admin role
	var allPermissions []models.Permission
	DB.Find(&allPermissions)
	if len(allPermissions) > 0 {
		assignPermissionsToRoles([]string{"admin", "Admin", "Super Admin"}, allPermissions, true)
	}

	// Assign limited permissions to user role
	var limitedPermissions []models.Permission
	DB.Where("name IN ?", []string{"profile.view", "profile.update", "dashboard.view", "reports.view"}).Find(&limitedPermissions)
	if len(limitedPermissions) > 0 {
		DB.Model(&userRole).Association("Permissions").Replace(limitedPermissions)
	}

	// Seed default permissions for casemix workflow on Rekam Medis role.
	// Append only (non-destructive) so custom role configs are preserved.
	rekamMedisDefaultPermissions := loadPermissionsByNames([]string{
		"eklaim.view",
		"eklaim.create",
		"eklaim.edit",
		"eklaim.grouping",
		"pharmacy.view",
		"pharmacy.edit",
		"medical_records.laboratory_order",
		"medical_records.radiology_order",
		"procedure_orders.view",
		"procedure_orders.create",
		"procedure_orders.edit",
		"procedure_orders.perform",
	})
	assignPermissionsToRoles([]string{"Rekam Medis"}, rekamMedisDefaultPermissions, false)

	kasirDefaultPermissions := loadPermissionsByNames([]string{
		"billing.view",
		"billing.create",
		"billing.update",
		"billing.payment",
		"billing.finalize",
		"cashier_shifts.view",
		"cashier_shifts.open",
		"cashier_shifts.close",
	})
	assignPermissionsToRoles([]string{"Kasir"}, kasirDefaultPermissions, false)

	// Create default admin user
	var adminUser models.User
	result := DB.Where(models.User{Email: "admin@simrs.com"}).FirstOrCreate(&adminUser, models.User{
		Email:    "admin@simrs.com",
		Username: "admin",
		FullName: "System Administrator",
		IsActive: true,
		RoleID:   adminRole.ID,
	})

	if result.RowsAffected > 0 {
		adminUser.HashPassword("admin123")
		DB.Save(&adminUser)
		log.Println("Default admin user created: admin@simrs.com / admin123")
	}

	// Create default settings - only if key doesn't exist
	// Uses Unscoped to also check soft-deleted records
	defaultSettings := []models.Setting{
		{Key: "app_name", Value: "SIMRS"},
		{Key: "app_subtitle", Value: "Hospital System"},
		// Hospital / Facility info (untuk kop cetakan)
		{Key: "hospital_name", Value: "RS Contoh Sejahtera"},
		{Key: "hospital_type", Value: "RSU Tipe C"},
		{Key: "hospital_address", Value: "Jl. Kesehatan No. 123"},
		{Key: "hospital_city", Value: "Kota Contoh, Jawa Tengah 12345"},
		{Key: "hospital_phone", Value: "(021) 1234567"},
		{Key: "hospital_fax", Value: "(021) 1234568"},
		{Key: "hospital_email", Value: "info@rscontoh.co.id"},
		{Key: "hospital_website", Value: "www.rscontoh.co.id"},
		// Digital Signature Settings
		{Key: "signature_pin_required", Value: "true"}, // true = PIN diperlukan untuk tanda tangan, false = tidak perlu PIN
	}

	for _, setting := range defaultSettings {
		var existing models.Setting
		// Check if setting exists (including soft-deleted)
		result := DB.Unscoped().Where("key = ?", setting.Key).First(&existing)
		if result.RowsAffected == 0 {
			// Only create if truly doesn't exist
			DB.Create(&setting)
			log.Printf("Created default setting: %s", setting.Key)
		}
		// If exists, don't touch it - preserve user's value
	}

	return nil
}

// SeedCounters creates default counters for queue management
func SeedCounters() error {
	counters := []models.Counter{
		{
			Name:         "Loket 1",
			Code:         "L1",
			Description:  "Loket Pendaftaran 1",
			IsActive:     true,
			DisplayOrder: 1,
			Location:     "Lantai 1 - Depan",
		},
		{
			Name:         "Loket 2",
			Code:         "L2",
			Description:  "Loket Pendaftaran 2",
			IsActive:     true,
			DisplayOrder: 2,
			Location:     "Lantai 1 - Depan",
		},
		{
			Name:         "Loket 3",
			Code:         "L3",
			Description:  "Loket Pendaftaran 3",
			IsActive:     true,
			DisplayOrder: 3,
			Location:     "Lantai 1 - Depan",
		},
		{
			Name:         "Loket 4",
			Code:         "L4",
			Description:  "Loket Pendaftaran 4",
			IsActive:     true,
			DisplayOrder: 4,
			Location:     "Lantai 1 - Depan",
		},
	}

	for _, counter := range counters {
		var existingCounter models.Counter
		result := DB.Where("code = ?", counter.Code).First(&existingCounter)
		if result.RowsAffected == 0 {
			DB.Create(&counter)
			log.Printf("Created counter: %s (%s)", counter.Name, counter.Code)
		}
	}

	log.Println("Counter seeding completed")
	return nil
}

// MigrateEKlaimLocal creates/updates only E-Klaim Local tables.
// Called from main.go since the full Migrate() is disabled.
func MigrateEKlaimLocal() error {
	// Fix column names: GORM may have derived EKlaimRMOrderID / RMDuplicateID
	// with wrong snake_case. Also, a previous failed migration may have created
	// the new column (empty) alongside the old one (with data).
	fixColumnName := func(table, newCol, likePattern, notLikePattern string) {
		// Check if old column exists (different from newCol, matching pattern)
		var oldCol string
		q := `SELECT column_name FROM information_schema.columns
			WHERE table_name = $1 AND column_name != $2
			AND column_name LIKE $3 AND column_name != 'id'`
		args := []interface{}{table, newCol, likePattern}
		if notLikePattern != "" {
			q += ` AND column_name NOT LIKE $4`
			args = append(args, notLikePattern)
		}
		q += ` LIMIT 1`
		DB.Raw(q, args...).Scan(&oldCol)
		if oldCol == "" || oldCol == newCol {
			return
		}
		log.Printf("Fixing column %s: %s -> %s", table, oldCol, newCol)

		// Check if new column already exists (from failed previous migration)
		var newExists int64
		DB.Raw(`SELECT COUNT(*) FROM information_schema.columns
			WHERE table_name = $1 AND column_name = $2`, table, newCol).Scan(&newExists)

		if newExists > 0 {
			// Both exist: copy data from old to new, then drop old
			DB.Exec(fmt.Sprintf("UPDATE %s SET %s = %s WHERE %s IS NULL", table, newCol, oldCol, newCol))
			DB.Exec(fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", table, oldCol))
		} else {
			// Only old exists: rename
			DB.Exec(fmt.Sprintf("ALTER TABLE %s RENAME COLUMN %s TO %s", table, oldCol, newCol))
		}
	}

	// RMDuplicateID — could be r_m_duplicate_id or similar
	for _, t := range []string{"eklaim_rm_diagnoses", "eklaim_rm_procedures", "eklaim_rm_orders",
		"eklaim_rm_medicine_items", "eklaim_rm_cppt", "eklaim_rm_fluid_balances"} {
		fixColumnName(t, "rm_duplicate_id", "%duplicate_id%", "")
	}
	// EKlaimRMOrderID
	fixColumnName("eklaim_rm_order_items", "eklaim_rm_order_id", "%order_id%", "%item%")
	// EKlaimRMOrderItemID
	fixColumnName("eklaim_rm_order_results", "eklaim_rm_order_item_id", "%order_item_id%", "")

	return DB.AutoMigrate(
		&models.EKlaimLocal{},
		&models.EKlaimRMDuplicate{},
		&models.EKlaimRMDiagnosis{},
		&models.EKlaimRMProcedure{},
		&models.EKlaimRMOrder{},
		&models.EKlaimRMOrderItem{},
		&models.EKlaimRMOrderResult{},
		&models.EKlaimRMMedicineItem{},
		&models.EKlaimRMCPPT{},
		&models.EKlaimRMNursingCare{},
		&models.EKlaimRMFluidBalance{},
		&models.EKlaimRMBilling{},
		&models.EKlaimRMBillingItem{},
		&models.EKlaimLocalLog{},
	)
}
