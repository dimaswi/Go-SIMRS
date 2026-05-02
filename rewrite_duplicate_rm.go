package main

import (
		"fmt"
	"io/ioutil"
	"regexp"
)

func main() {
	content, err := ioutil.ReadFile("e:/Golang/Go-SIMRS/backend/handlers/eklaim_local.go")
	if err != nil {
		fmt.Println("Error reading file:", err)
		return
	}
	str := string(content)

	// Replace DuplicateRM
	duplicateRMPattern := regexp.MustCompile(`(?s)func DuplicateRM\(c \*gin\.Context\) \{.*?\n\}`)
	newDuplicateRM := `func DuplicateRM(c *gin.Context) {
	sepID, err := strconv.ParseUint(c.Param("sepId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid SEP ID"})
		return
	}

	var sep models.SEP
	if err := database.DB.First(&sep, sepID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "SEP tidak ditemukan"})
		return
	}

	if sep.VisitID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SEP belum terhubung dengan visit"})
		return
	}

	// Ensure EKlaimLocal exists
	var eklaimLocal models.EKlaimLocal
	err = database.DB.Where("no_sep = ?", sep.NoSEP).First(&eklaimLocal).Error
	if err != nil {
		eklaimLocal = models.EKlaimLocal{
			SEPID:      sep.ID,
			VisitID:    *sep.VisitID,
			NoSEP:      sep.NoSEP,
			NoKartu:    sep.NoKartu,
			NamaPasien: sep.NamaPasien,
			Status:     "draft",
		}
		userID := getUserIDValue(c)
		if userID > 0 {
			eklaimLocal.CreatedByID = &userID
		}
		if err := database.DB.Create(&eklaimLocal).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat eklaim local"})
			return
		}
	}

	// Call service to duplicate RM
	if err := duplicateRMLogic(*sep.VisitID, eklaimLocal.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal duplikasi RM ke Casemix: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Duplikasi RM ke Casemix berhasil",
		"eklaim_local": eklaimLocal,
	})
}

// duplicateRMLogic copies original RM data to Casemix marked records
func duplicateRMLogic(visitID uint, eklaimLocalID uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Delete old Casemix records
		tables := []string{
			"triages", "anamneses", "physical_examinations", "diagnoses",
			"assessment_plans", "dispositions", "cppts", "fluid_balances",
			"nursing_cares", "visit_procedures", "procedure_orders",
			"medicine_orders",
		}
		for _, t := range tables {
			if t == "procedure_orders" || t == "medicine_orders" {
				tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE source_visit_id = ? AND is_casemix = ?", t), visitID, true)
			} else {
				tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE visit_id = ? AND is_casemix = ?", t), visitID, true)
			}
		}

		// 2. Helper to duplicate
		duplicateRecords := func(model interface{}, dest interface{}, visitColumn string) error {
			if err := tx.Where(visitColumn+" = ? AND is_casemix = ?", visitID, false).Find(model).Error; err != nil {
				return err
			}
			
			// Marshal and unmarshal to deep copy
			data, _ := json.Marshal(model)
			json.Unmarshal(data, dest)
			
			return nil
		}

		// Diagnoses
		var diags, newDiags []models.Diagnosis
		duplicateRecords(&diags, &newDiags, "visit_id")
		for i := range newDiags {
			newDiags[i].ID = 0
			newDiags[i].IsCasemix = true
			newDiags[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newDiags[i])
		}

		// Anamnesis
		var anm, newAnm []models.Anamnesis
		duplicateRecords(&anm, &newAnm, "visit_id")
		for i := range newAnm {
			newAnm[i].ID = 0
			newAnm[i].IsCasemix = true
			newAnm[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newAnm[i])
		}
		
		// Triage
		var trg, newTrg []models.Triage
		duplicateRecords(&trg, &newTrg, "visit_id")
		for i := range newTrg {
			newTrg[i].ID = 0
			newTrg[i].IsCasemix = true
			newTrg[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newTrg[i])
		}

		// Physical Examination
		var pe, newPe []models.PhysicalExamination
		duplicateRecords(&pe, &newPe, "visit_id")
		for i := range newPe {
			newPe[i].ID = 0
			newPe[i].IsCasemix = true
			newPe[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newPe[i])
		}

		// Assessment Plan
		var ap, newAp []models.AssessmentPlan
		duplicateRecords(&ap, &newAp, "visit_id")
		for i := range newAp {
			newAp[i].ID = 0
			newAp[i].IsCasemix = true
			newAp[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newAp[i])
		}

		// Disposition
		var disp, newDisp []models.Disposition
		duplicateRecords(&disp, &newDisp, "visit_id")
		for i := range newDisp {
			newDisp[i].ID = 0
			newDisp[i].IsCasemix = true
			newDisp[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newDisp[i])
		}

		// Visit Procedures
		var vp, newVp []models.VisitProcedure
		duplicateRecords(&vp, &newVp, "visit_id")
		for i := range newVp {
			newVp[i].ID = 0
			newVp[i].IsCasemix = true
			newVp[i].CasemixEklaimID = &eklaimLocalID
			tx.Create(&newVp[i])
		}

		// Medicine Orders
		var mo []models.MedicineOrder
		tx.Where("source_visit_id = ? AND is_casemix = ?", visitID, false).Preload("Items").Find(&mo)
		for _, order := range mo {
			newOrder := order
			newOrder.ID = 0
			newOrder.IsCasemix = true
			newOrder.CasemixEklaimID = &eklaimLocalID
			newOrder.Items = nil
			tx.Create(&newOrder)

			for _, item := range order.Items {
				newItem := item
				newItem.ID = 0
				newItem.MedicineOrderID = newOrder.ID
				tx.Create(&newItem)
			}
		}

		// Procedure Orders
		var po []models.ProcedureOrder
		tx.Where("source_visit_id = ? AND is_casemix = ?", visitID, false).Preload("Items").Find(&po)
		for _, order := range po {
			newOrder := order
			newOrder.ID = 0
			newOrder.IsCasemix = true
			newOrder.CasemixEklaimID = &eklaimLocalID
			newOrder.Items = nil
			tx.Create(&newOrder)

			for _, item := range order.Items {
				newItem := item
				newItem.ID = 0
				newItem.ProcedureOrderID = newOrder.ID
				tx.Create(&newItem)
			}
		}

		return nil
	})
}`
	str = duplicateRMPattern.ReplaceAllString(str, newDuplicateRM)

	createClaimPattern := regexp.MustCompile(`(?s)// Step 2: Create RMDuplicate if not exists.*?// Step 3: Build new_claim data`)
	newCreateClaim := `// Step 2: Duplicate RM to Casemix
	duplicateRMLogic(*sep.VisitID, eklaimLocal.ID)

	// Step 3: Build new_claim data`
	str = createClaimPattern.ReplaceAllString(str, newCreateClaim)

	err = ioutil.WriteFile("e:/Golang/Go-SIMRS/backend/handlers/eklaim_local.go", []byte(str), 0644)
	if err != nil {
		fmt.Println("Error writing:", err)
		return
	}
	fmt.Println("Rewrite success")
}

