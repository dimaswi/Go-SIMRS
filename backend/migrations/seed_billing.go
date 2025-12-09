package migrations

import (
	"log"
	"starter/backend/models"

	"gorm.io/gorm"
)

// SeedBillingData seeds initial billing-related data
func SeedBillingData(db *gorm.DB) error {
	// Seed Registration Tariffs
	tariffs := []models.RegistrationTariff{
		// Rawat Jalan
		{ServiceType: "rawat_jalan", PaymentMethod: "cash", TariffAmount: 25000, Description: "Biaya pendaftaran rawat jalan umum", IsActive: true},
		{ServiceType: "rawat_jalan", PaymentMethod: "bpjs", TariffAmount: 0, Description: "Biaya pendaftaran rawat jalan BPJS (ditanggung)", IsActive: true},
		{ServiceType: "rawat_jalan", PaymentMethod: "insurance", TariffAmount: 25000, Description: "Biaya pendaftaran rawat jalan asuransi", IsActive: true},

		// Rawat Inap
		{ServiceType: "rawat_inap", PaymentMethod: "cash", TariffAmount: 50000, Description: "Biaya pendaftaran rawat inap umum", IsActive: true},
		{ServiceType: "rawat_inap", PaymentMethod: "bpjs", TariffAmount: 0, Description: "Biaya pendaftaran rawat inap BPJS (ditanggung)", IsActive: true},
		{ServiceType: "rawat_inap", PaymentMethod: "insurance", TariffAmount: 50000, Description: "Biaya pendaftaran rawat inap asuransi", IsActive: true},

		// Gawat Darurat (UGD)
		{ServiceType: "gawat_darurat", PaymentMethod: "cash", TariffAmount: 75000, Description: "Biaya pendaftaran UGD umum", IsActive: true},
		{ServiceType: "gawat_darurat", PaymentMethod: "bpjs", TariffAmount: 0, Description: "Biaya pendaftaran UGD BPJS (ditanggung)", IsActive: true},
		{ServiceType: "gawat_darurat", PaymentMethod: "insurance", TariffAmount: 75000, Description: "Biaya pendaftaran UGD asuransi", IsActive: true},
	}

	for _, tariff := range tariffs {
		var existing models.RegistrationTariff
		result := db.Where("service_type = ? AND payment_method = ?", tariff.ServiceType, tariff.PaymentMethod).First(&existing)
		if result.RowsAffected == 0 {
			if err := db.Create(&tariff).Error; err != nil {
				log.Printf("Failed to create registration tariff %s-%s: %v", tariff.ServiceType, tariff.PaymentMethod, err)
			} else {
				log.Printf("Created registration tariff: %s - %s", tariff.ServiceType, tariff.PaymentMethod)
			}
		}
	}

	log.Println("Billing data seeding completed")
	return nil
}
