package handlers

import (
	"bytes"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"net/http"
	"sort"
	"starter/backend/database"
	"starter/backend/models"
	"strconv"
	"strings"
	"time"
)

func printOutpatientResumeImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	rmDuplicateID := c.Query("rm_duplicate_id")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupResume, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF("outpatient_resume", uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit with all relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient

	// Data structures (will be populated from RM Duplicate or Visit)
	type AnamnesisData struct {
		ID                      uint
		ChiefComplaint          string
		HistoryOfPresentIllness string
		PastMedicalHistory      string
		Allergies               string
	}
	type PhysicalExamData struct {
		ID                uint
		GeneralCondition  string
		Consciousness     string
		BloodPressure     string
		HeartRate         string
		RespiratoryRate   string
		Temperature       string
		OxygenSaturation  string
		Weight            string
		Height            string
		UpperArmCircum    string
		HeadCircum        string
		Waist             string
		Head              string
		Eyes              string
		Ears              string
		Nose              string
		Throat            string
		ENT               string
		Neck              string
		Chest             string
		Thorax            string
		Heart             string
		Cardiac           string
		Lungs             string
		Pulmonary         string
		Abdomen           string
		Extremities       string
		Skin              string
		Neurological      string
		Musculoskel       string
		Genitourinary     string
		OtherFindings     string
		ECGPerformed      bool
		ECGResult         string
		ECGInterpretation string
		ECGNotes          string
		PainMethod        string
		PainScale         int
		PainLocation      string
	}
	type DiagnosisData struct {
		Type      string
		ICD10Code string
		ICD10Name string
	}
	type AssessmentPlanData struct {
		ID               uint
		TreatmentPlan    string
		MedicationPlan   string
		DietPlan         string
		ActivityPlan     string
		EducationPlan    string
		ProcedurePlan    string
		ConsultationPlan string
		Prognosis        string
	}
	type DispositionData struct {
		ID                   uint
		DispositionType      string
		DischargeCondition   string
		DischargeStatus      string
		AdmissionWard        string
		AdmissionReason      string
		ReferralFacility     string
		ReferralReason       string
		DischargeInstruction string
		DischargeMedication  string
		FollowUpDate         *time.Time
		FollowUpInstruction  string
	}
	type MedicineItemData struct {
		Name         string
		Dosage       string
		Frequency    string
		Route        string
		Quantity     int
		Unit         string
		Instructions string
	}

	var anamnesis AnamnesisData
	var physicalExam PhysicalExamData
	var diagnoses []DiagnosisData
	var assessmentPlan AssessmentPlanData
	var disposition DispositionData
	var medicineItems []MedicineItemData

	// Load from clinicalDB (either Main DB or Casemix DB)
	var anamnesisModel models.Anamnesis
	clinicalVisitQuery(c, visitID).First(&anamnesisModel)
	anamnesis = AnamnesisData{
		ID:                      anamnesisModel.ID,
		ChiefComplaint:          anamnesisModel.ChiefComplaint,
		HistoryOfPresentIllness: anamnesisModel.HistoryOfPresentIllness,
		PastMedicalHistory:      anamnesisModel.PastMedicalHistory,
		Allergies:               anamnesisModel.Allergies,
	}

	var physicalExamModel models.PhysicalExamination
	clinicalVisitQuery(c, visitID).First(&physicalExamModel)
	physicalExam = PhysicalExamData{
		ID:                physicalExamModel.ID,
		GeneralCondition:  physicalExamModel.GeneralCondition,
		Consciousness:     physicalExamModel.Consciousness,
		BloodPressure:     physicalExamModel.BloodPressure,
		HeartRate:         physicalExamModel.HeartRate,
		RespiratoryRate:   physicalExamModel.RespiratoryRate,
		Temperature:       physicalExamModel.Temperature,
		OxygenSaturation:  physicalExamModel.OxygenSaturation,
		Weight:            physicalExamModel.Weight,
		Height:            physicalExamModel.Height,
		UpperArmCircum:    physicalExamModel.UpperArmCircum,
		HeadCircum:        physicalExamModel.HeadCircum,
		Waist:             physicalExamModel.Waist,
		Head:              physicalExamModel.Head,
		Eyes:              physicalExamModel.Eyes,
		Ears:              physicalExamModel.Ears,
		Nose:              physicalExamModel.Nose,
		Throat:            physicalExamModel.Throat,
		ENT:               physicalExamModel.ENT,
		Neck:              physicalExamModel.Neck,
		Chest:             physicalExamModel.Chest,
		Thorax:            physicalExamModel.Thorax,
		Heart:             physicalExamModel.Heart,
		Cardiac:           physicalExamModel.Cardiac,
		Lungs:             physicalExamModel.Lungs,
		Pulmonary:         physicalExamModel.Pulmonary,
		Abdomen:           physicalExamModel.Abdomen,
		Extremities:       physicalExamModel.Extremities,
		Skin:              physicalExamModel.Skin,
		Neurological:      physicalExamModel.Neurological,
		Musculoskel:       physicalExamModel.Musculoskel,
		Genitourinary:     physicalExamModel.Genitourinary,
		OtherFindings:     physicalExamModel.OtherFindings,
		ECGPerformed:      physicalExamModel.ECGPerformed,
		ECGResult:         physicalExamModel.ECGResult,
		ECGInterpretation: physicalExamModel.ECGInterpretation,
		ECGNotes:          physicalExamModel.ECGNotes,
		PainMethod:        physicalExamModel.PainMethod,
		PainScale:         physicalExamModel.PainScale,
		PainLocation:      physicalExamModel.PainLocation,
	}

	var diagnosesList []models.Diagnosis
	clinicalVisitQuery(c, visitID).Order("type ASC, sequence ASC").Find(&diagnosesList)
	for _, d := range diagnosesList {
		diagnoses = append(diagnoses, DiagnosisData{
			Type:      d.Type,
			ICD10Code: d.ICD10Code,
			ICD10Name: d.ICD10Name,
		})
	}

	var assessmentPlanModel models.AssessmentPlan
	clinicalVisitQuery(c, visitID).First(&assessmentPlanModel)
	assessmentPlan = AssessmentPlanData{
		ID:               assessmentPlanModel.ID,
		TreatmentPlan:    assessmentPlanModel.TreatmentPlan,
		MedicationPlan:   assessmentPlanModel.MedicationPlan,
		DietPlan:         assessmentPlanModel.DietPlan,
		ActivityPlan:     assessmentPlanModel.ActivityPlan,
		EducationPlan:    assessmentPlanModel.EducationPlan,
		ProcedurePlan:    assessmentPlanModel.ProcedurePlan,
		ConsultationPlan: assessmentPlanModel.ConsultationPlan,
		Prognosis:        assessmentPlanModel.Prognosis,
	}

	var dispositionModel models.Disposition
	clinicalVisitQuery(c, visitID).First(&dispositionModel)
	disposition = DispositionData{
		ID:                   dispositionModel.ID,
		DispositionType:      dispositionModel.DispositionType,
		DischargeCondition:   dispositionModel.DischargeCondition,
		DischargeStatus:      dispositionModel.DischargeStatus,
		AdmissionWard:        dispositionModel.AdmissionWard,
		AdmissionReason:      dispositionModel.AdmissionReason,
		ReferralFacility:     dispositionModel.ReferralFacility,
		ReferralReason:       dispositionModel.ReferralReason,
		DischargeInstruction: dispositionModel.DischargeInstruction,
		DischargeMedication:  dispositionModel.DischargeMedication,
		FollowUpDate:         dispositionModel.FollowUpDate,
		FollowUpInstruction:  dispositionModel.FollowUpInstruction,
	}

	var medicineOrders []models.MedicineOrder
	clinicalSourceVisitQuery(c, visitID).Where("status <> ?", models.OrderStatusCancelled).
		Preload("Items.Medicine").
		Find(&medicineOrders)
	for _, order := range medicineOrders {
		for _, item := range order.Items {
			medName := ""
			if item.Medicine != nil {
				medName = item.Medicine.Name
			}
			medicineItems = append(medicineItems, MedicineItemData{
				Name:         medName,
				Dosage:       item.Dosage,
				Frequency:    item.Frequency,
				Route:        item.Route,
				Quantity:     item.Quantity,
				Unit:         item.Unit,
				Instructions: item.Instructions,
			})
		}
	}

	// Keep diagnosis order consistent and clinically meaningful.
	sort.Slice(diagnoses, func(i, j int) bool {
		ri := diagnosisTypeRank(diagnoses[i].Type)
		rj := diagnosisTypeRank(diagnoses[j].Type)
		if ri != rj {
			return ri < rj
		}
		if diagnoses[i].ICD10Code != diagnoses[j].ICD10Code {
			return diagnoses[i].ICD10Code < diagnoses[j].ICD10Code
		}
		return diagnoses[i].ICD10Name < diagnoses[j].ICD10Name
	})

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Determine title based on visit type
	resumeTitle := "Resume Medis Rawat Jalan"
	// Check visit type first
	if visit.VisitType == "UGD" {
		resumeTitle = "Resume Medis UGD"
	} else if visit.VisitType == "Rawat Inap" {
		resumeTitle = "Resume Medis Rawat Inap"
	} else if visit.Room != nil {
		// Fallback to room type
		roomType := visit.Room.RoomType
		if roomType == "igd" || roomType == "ugd" || roomType == "emergency" {
			resumeTitle = "Resume Medis UGD"
		} else if roomType == "inpatient" || roomType == "rawat_inap" {
			resumeTitle = "Resume Medis Rawat Inap"
		}
	}

	// Header
	addHeader(pdf, hospitalInfo, resumeTitle, visit.VisitNumber)

	// Patient info table
	addPatientInfoTable(pdf, patient, &visit)

	// Clinical Snapshot - concise high-value summary for faster reading.
	primaryDx := "-"
	for _, d := range diagnoses {
		if d.Type == "primary" {
			if d.ICD10Code != "" && d.ICD10Name != "" {
				primaryDx = fmt.Sprintf("%s - %s", d.ICD10Code, d.ICD10Name)
			} else {
				primaryDx = safeString(d.ICD10Name)
			}
			break
		}
	}
	if primaryDx == "-" && len(diagnoses) > 0 {
		d := diagnoses[0]
		if d.ICD10Code != "" && d.ICD10Name != "" {
			primaryDx = fmt.Sprintf("%s - %s", d.ICD10Code, d.ICD10Name)
		} else {
			primaryDx = safeString(d.ICD10Name)
		}
	}

	vitals := []string{}
	if physicalExam.BloodPressure != "" {
		vitals = append(vitals, "TD "+physicalExam.BloodPressure)
	}
	if physicalExam.HeartRate != "" {
		vitals = append(vitals, "N "+physicalExam.HeartRate)
	}
	if physicalExam.RespiratoryRate != "" {
		vitals = append(vitals, "RR "+physicalExam.RespiratoryRate)
	}
	if physicalExam.Temperature != "" {
		vitals = append(vitals, "S "+physicalExam.Temperature)
	}
	if physicalExam.OxygenSaturation != "" {
		vitals = append(vitals, "SpO2 "+physicalExam.OxygenSaturation+"%")
	}
	vitalSummary := "-"
	if len(vitals) > 0 {
		vitalSummary = strings.Join(vitals, " | ")
	}
	spo2Val := parseLeadingInt(physicalExam.OxygenSaturation)
	oxygenAlert := spo2Val > 0 && spo2Val < 94
	if oxygenAlert {
		vitalSummary += " | SpO2 Rendah"
	}

	painSummary := "Tidak Nyeri"
	if physicalExam.PainScale > 0 {
		painSummary = painScaleWithSeverity(physicalExam.PainScale)
	}
	painAlert := physicalExam.PainScale >= 4
	if physicalExam.PainLocation != "" {
		painSummary += " - " + formatEnumDisplay(physicalExam.PainLocation)
	}

	allergyStatus := "Tidak Ada"
	if strings.TrimSpace(anamnesis.Allergies) != "" && strings.TrimSpace(anamnesis.Allergies) != "-" {
		allergyStatus = "Ada"
	}
	allergyR, allergyG, allergyB := 22, 101, 52
	if allergyStatus == "Ada" {
		allergyR, allergyG, allergyB = 185, 28, 28
	}

	complexityScore := 0
	if len(diagnoses) >= 3 {
		complexityScore += 2
	} else if len(diagnoses) >= 1 {
		complexityScore += 1
	}
	if oxygenAlert {
		complexityScore += 1
	}
	if painAlert {
		complexityScore += 1
	}
	if allergyStatus == "Ada" {
		complexityScore += 1
	}

	complexityLabel := "Ringan"
	complexityR, complexityG, complexityB := 22, 101, 52
	if complexityScore >= 4 {
		complexityLabel = "Tinggi"
		complexityR, complexityG, complexityB = 185, 28, 28
	} else if complexityScore >= 2 {
		complexityLabel = "Sedang"
		complexityR, complexityG, complexityB = 180, 83, 9
	}
	complexityDisplay := fmt.Sprintf("%s (%d)", complexityLabel, complexityScore)

	alertItems := []string{}
	if allergyStatus == "Ada" {
		alertItems = append(alertItems, "Alergi")
	}
	if oxygenAlert {
		alertItems = append(alertItems, "SpO2 Rendah")
	}
	if painAlert {
		alertItems = append(alertItems, "Nyeri Sedang/Berat")
	}
	alertSummary := "Tidak ada alert utama"
	if len(alertItems) > 0 {
		alertSummary = strings.Join(alertItems, " + ")
	}

	addTableHeader(pdf, "CLINICAL SNAPSHOT")
	if len(alertItems) > 0 {
		addHighlightedTableRow(pdf, "Alert Utama", alertSummary, 40, 242, 242, 242, 185, 28, 28)
	} else {
		addHighlightedTableRow(pdf, "Alert Utama", alertSummary, 40, 242, 242, 242, 0, 0, 0)
	}
	addTableRow(pdf, "Diagnosis Utama", primaryDx, 40)
	if oxygenAlert {
		pdf.SetTextColor(180, 83, 9)
		addTableRow(pdf, "Tanda Vital Inti", vitalSummary, 40)
		pdf.SetTextColor(0, 0, 0)
	} else {
		addTableRow(pdf, "Tanda Vital Inti", vitalSummary, 40)
	}
	if painAlert {
		pdf.SetTextColor(185, 28, 28)
		addTableRow(pdf, "Ringkasan Nyeri", painSummary, 40)
		pdf.SetTextColor(0, 0, 0)
	} else {
		addTableRow(pdf, "Ringkasan Nyeri", painSummary, 40)
	}
	pdf.SetTextColor(allergyR, allergyG, allergyB)
	addTableRow(pdf, "Alergi", allergyStatus, 40)
	pdf.SetTextColor(0, 0, 0)
	addHighlightedTableRow(pdf, "Kompleksitas Kasus", complexityDisplay, 40, 242, 242, 242, complexityR, complexityG, complexityB)
	addTableRow(pdf, "Legend Skor", "0-1 Ringan | 2-3 Sedang | >=4 Tinggi", 40)
	addTableRow(pdf, "Disposisi", formatEnumDisplay(disposition.DispositionType), 40)
	addTableEnd(pdf)

	// Anamnesis Section
	addTableHeader(pdf, "ANAMNESIS")
	addTableRow(pdf, "Keluhan Utama", safeString(anamnesis.ChiefComplaint), 40)
	addTableRow(pdf, "Riwayat Penyakit Sekarang", safeString(anamnesis.HistoryOfPresentIllness), 40)
	addTableRow(pdf, "Riwayat Penyakit Dahulu", safeString(anamnesis.PastMedicalHistory), 40)
	
	if anamnesis.Allergies != "" && anamnesis.Allergies != "Tidak Ada" && anamnesis.Allergies != "-" {
		pdf.SetFont("Arial", "B", 9)
		pdf.SetTextColor(220, 53, 69)
		pdf.SetDrawColor(180, 180, 180)
		pdf.CellFormat(40, rowHeight, " Alergi", "LB", 0, "L", false, 0, "")
		pdf.CellFormat(contentWidth-40, rowHeight, anamnesis.Allergies, "RB", 1, "L", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}
	addTableEnd(pdf)

	// Physical Examination Section
	addTableHeader(pdf, "PEMERIKSAAN FISIK")
	addTableRow(pdf, "Keadaan Umum", safeString(physicalExam.GeneralCondition), 40)
	addTableRow(pdf, "Kesadaran", safeString(physicalExam.Consciousness), 40)

	// Vital Signs
	bp := safeString(physicalExam.BloodPressure)
	if bp != "-" { bp += " mmHg" }
	addTableRow(pdf, "Tekanan Darah", bp, 40)

	hr := safeString(physicalExam.HeartRate)
	if hr != "-" { hr += " x/menit" }
	addTableRow(pdf, "Nadi", hr, 40)

	rr := safeString(physicalExam.RespiratoryRate)
	if rr != "-" { rr += " x/menit" }
	addTableRow(pdf, "Frekuensi Napas", rr, 40)

	temp := safeString(physicalExam.Temperature)
	if temp != "-" { temp += " °C" }
	addTableRow(pdf, "Suhu", temp, 40)

	spo2 := safeString(physicalExam.OxygenSaturation)
	if spo2 != "-" { spo2 += " %" }
	addTableRow(pdf, "SpO2", spo2, 40)

	if physicalExam.Weight != "" {
		addTableRow(pdf, "Berat Badan", physicalExam.Weight+" kg", 40)
	}
	if physicalExam.Height != "" {
		addTableRow(pdf, "Tinggi Badan", physicalExam.Height+" cm", 40)
	}
		if physicalExam.UpperArmCircum != "" {
			addTableRow(pdf, "Lingkar Lengan Atas", physicalExam.UpperArmCircum+" cm", 40)
		}
		if physicalExam.HeadCircum != "" {
			addTableRow(pdf, "Lingkar Kepala", physicalExam.HeadCircum+" cm", 40)
		}
		if physicalExam.Waist != "" {
			addTableRow(pdf, "Lingkar Perut", physicalExam.Waist+" cm", 40)
		}
		// Pemeriksaan Fisik per Sistem Organ
		if physicalExam.Head != "" {
			addTableRow(pdf, "Kepala", physicalExam.Head, 40)
		}
		if physicalExam.Eyes != "" {
			addTableRow(pdf, "Mata", physicalExam.Eyes, 40)
		}
		if physicalExam.Ears != "" {
			addTableRow(pdf, "Telinga", physicalExam.Ears, 40)
		}
		if physicalExam.Nose != "" {
			addTableRow(pdf, "Hidung", physicalExam.Nose, 40)
		}
		if physicalExam.Throat != "" {
			addTableRow(pdf, "Tenggorokan", physicalExam.Throat, 40)
		}
		if physicalExam.ENT != "" {
			addTableRow(pdf, "THT", physicalExam.ENT, 40)
		}
		if physicalExam.Neck != "" {
			addTableRow(pdf, "Leher", physicalExam.Neck, 40)
		}
		if physicalExam.Chest != "" {
			addTableRow(pdf, "Dada", physicalExam.Chest, 40)
		}
		if physicalExam.Thorax != "" {
			addTableRow(pdf, "Thorax", physicalExam.Thorax, 40)
		}
		if physicalExam.Heart != "" {
			addTableRow(pdf, "Jantung", physicalExam.Heart, 40)
		}
		if physicalExam.Cardiac != "" {
			addTableRow(pdf, "Kardiak", physicalExam.Cardiac, 40)
		}
		if physicalExam.Lungs != "" {
			addTableRow(pdf, "Paru", physicalExam.Lungs, 40)
		}
		if physicalExam.Pulmonary != "" {
			addTableRow(pdf, "Pulmoner", physicalExam.Pulmonary, 40)
		}
		if physicalExam.Abdomen != "" {
			addTableRow(pdf, "Abdomen", physicalExam.Abdomen, 40)
		}
		if physicalExam.Extremities != "" {
			addTableRow(pdf, "Ekstremitas", physicalExam.Extremities, 40)
		}
		if physicalExam.Skin != "" {
			addTableRow(pdf, "Kulit", physicalExam.Skin, 40)
		}
		if physicalExam.Neurological != "" {
			addTableRow(pdf, "Neurologis", physicalExam.Neurological, 40)
		}
		if physicalExam.Musculoskel != "" {
			addTableRow(pdf, "Muskuloskeletal", physicalExam.Musculoskel, 40)
		}
		if physicalExam.Genitourinary != "" {
			addTableRow(pdf, "Genitourinari", physicalExam.Genitourinary, 40)
		}
		if physicalExam.OtherFindings != "" {
			addTableRow(pdf, "Temuan Lain", physicalExam.OtherFindings, 40)
		}
		// ECG
		if physicalExam.ECGPerformed {
			if physicalExam.ECGResult != "" {
				addTableRow(pdf, "Hasil EKG", physicalExam.ECGResult, 40)
			}
			if physicalExam.ECGInterpretation != "" {
				addTableRow(pdf, "Interpretasi EKG", physicalExam.ECGInterpretation, 40)
			}
			if physicalExam.ECGNotes != "" {
				addTableRow(pdf, "Catatan EKG", physicalExam.ECGNotes, 40)
			}
		}
		if physicalExam.PainMethod != "" {
			addTableRow(pdf, "Metode Nyeri", formatPainMethodDisplay(physicalExam.PainMethod), 40)
		}
		if physicalExam.PainScale > 0 {
			addTableRow(pdf, "Skala Nyeri", painScaleWithSeverity(physicalExam.PainScale), 40)
		}
		if physicalExam.PainLocation != "" {
			addTableRow(pdf, "Lokasi Nyeri", formatEnumDisplay(physicalExam.PainLocation), 40)
		}
	addTableEnd(pdf)

	// Diagnosis Section
	addTableHeader(pdf, "DIAGNOSIS")
	if len(diagnoses) > 0 {
		for _, diag := range diagnoses {
			diagType := ""
			if diag.Type == "primary" {
				diagType = "[Utama] "
			}
			addTableFullRow(pdf, fmt.Sprintf("%s%s - %s", diagType, diag.ICD10Code, diag.ICD10Name), false)
		}
	} else {
		addTableFullRow(pdf, "-", false)
	}
	addTableEnd(pdf)

	// Medications Section
	addTableHeader(pdf, "TERAPI / RESEP")
	// Column widths: No(8) + Nama Obat(70) + Aturan Pakai(38) + Jumlah(25) + Instruksi(39) = 180
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(240, 240, 240)
	pdf.SetDrawColor(180, 180, 180)
	pdf.CellFormat(8, rowHeight, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(70, rowHeight, "Nama Obat", "1", 0, "C", true, 0, "")
	pdf.CellFormat(38, rowHeight, "Aturan Pakai", "1", 0, "C", true, 0, "")
	pdf.CellFormat(25, rowHeight, "Jumlah", "1", 0, "C", true, 0, "")
	pdf.CellFormat(39, rowHeight, "Instruksi", "1", 1, "C", true, 0, "")
	pdf.SetFont("Arial", "", 8)

	if len(medicineItems) > 0 {
		for i, item := range medicineItems {
			aturan := item.Frequency
			if item.Route != "" {
				if aturan != "" {
					aturan += " / " + item.Route
				} else {
					aturan = item.Route
				}
			}
			qtyStr := ""
			if item.Quantity > 0 {
				qtyStr = fmt.Sprintf("%d %s", item.Quantity, item.Unit)
			} else if item.Unit != "" {
				qtyStr = item.Unit
			}
			instrText := item.Instructions
			if instrText == "" {
				instrText = "-"
			}
			checkPageBreak(pdf, rowHeight)
			pdf.CellFormat(8, rowHeight, fmt.Sprintf("%d", i+1), "1", 0, "C", false, 0, "")
			pdf.SetFont("Arial", "B", 8)
			pdf.CellFormat(70, rowHeight, truncateText(item.Name, 42), "1", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 8)
			pdf.CellFormat(38, rowHeight, aturan, "1", 0, "C", false, 0, "")
			pdf.CellFormat(25, rowHeight, qtyStr, "1", 0, "C", false, 0, "")
			pdf.CellFormat(39, rowHeight, truncateText(instrText, 24), "1", 1, "L", false, 0, "")
		}
	} else {
		// Just print an empty row for medication
		pdf.CellFormat(8, rowHeight, "-", "1", 0, "C", false, 0, "")
		pdf.CellFormat(70, rowHeight, "-", "1", 0, "L", false, 0, "")
		pdf.CellFormat(38, rowHeight, "-", "1", 0, "C", false, 0, "")
		pdf.CellFormat(25, rowHeight, "-", "1", 0, "C", false, 0, "")
		pdf.CellFormat(39, rowHeight, "-", "1", 1, "C", false, 0, "")
	}
	addTableEnd(pdf)

	// Assessment Plan Section
	addTableHeader(pdf, "RENCANA")
	
	rencanaTindakan := safeString(assessmentPlan.TreatmentPlan)
	if rencanaTindakan == "-" && assessmentPlan.ProcedurePlan != "" {
		rencanaTindakan = assessmentPlan.ProcedurePlan
	}
	addTableMultiRow(pdf, "Rencana Tindakan", rencanaTindakan, 40)
	addTableMultiRow(pdf, "Edukasi", safeString(assessmentPlan.EducationPlan), 40)

	if assessmentPlan.MedicationPlan != "" {
		addTableMultiRow(pdf, "Rencana Obat", assessmentPlan.MedicationPlan, 40)
	}
	if assessmentPlan.DietPlan != "" {
		addTableMultiRow(pdf, "Rencana Diet", assessmentPlan.DietPlan, 40)
	}
	if assessmentPlan.ActivityPlan != "" {
		addTableMultiRow(pdf, "Rencana Aktivitas", assessmentPlan.ActivityPlan, 40)
	}
	if assessmentPlan.ConsultationPlan != "" {
		addTableMultiRow(pdf, "Rencana Konsultasi", assessmentPlan.ConsultationPlan, 40)
	}
	if assessmentPlan.Prognosis != "" {
		addTableRow(pdf, "Prognosis", assessmentPlan.Prognosis, 40)
	}
	addTableEnd(pdf)

	// Disposition Section
	addTableHeader(pdf, "DISPOSISI")
	
	// Format disposition type to readable text
	dispType := safeString(disposition.DispositionType)
	dispTypeDisplay := map[string]string{
		"pulang":     "Pulang",
		"rawat_inap": "Rawat Inap",
		"rujuk":      "Rujuk",
		"meninggal":  "Meninggal",
		"aps":        "APS (Atas Permintaan Sendiri)",
		"dod":        "DOA (Death on Arrival)",
	}
	if text, ok := dispTypeDisplay[dispType]; ok {
		dispType = text
	}
	addTableRow(pdf, "Status Pulang", dispType, 40)

	// Format discharge status
	status := safeString(disposition.DischargeCondition)
	if disposition.DischargeStatus != "" {
		statusDisplay := map[string]string{
			"sembuh":       "Sembuh",
			"membaik":      "Membaik",
			"belum_sembuh": "Belum Sembuh",
			"pulang_paksa": "Pulang Paksa",
		}
		status = disposition.DischargeStatus
		if text, ok := statusDisplay[status]; ok {
			status = text
		}
	}
	addTableRow(pdf, "Kondisi Pulang", status, 40)

	// Show admission info if rawat inap
	if disposition.DispositionType == "rawat_inap" {
		if disposition.AdmissionWard != "" {
			addTableRow(pdf, "Ruang Rawat Inap", disposition.AdmissionWard, 40)
		}
		if disposition.AdmissionReason != "" {
			addTableMultiRow(pdf, "Alasan Rawat Inap", disposition.AdmissionReason, 40)
		}
	}

	// Show referral info if rujuk
	if disposition.DispositionType == "rujuk" {
		if disposition.ReferralFacility != "" {
			addTableRow(pdf, "Tujuan Rujuk", disposition.ReferralFacility, 40)
		}
		if disposition.ReferralReason != "" {
			addTableMultiRow(pdf, "Alasan Rujuk", disposition.ReferralReason, 40)
		}
	}

	// Instructions
	addTableMultiRow(pdf, "Instruksi Pulang", safeString(disposition.DischargeInstruction), 40)
	
	if disposition.DischargeMedication != "" {
		addTableMultiRow(pdf, "Obat Pulang", disposition.DischargeMedication, 40)
	}

	// Follow up
	if disposition.FollowUpDate != nil {
		addTableRow(pdf, "Jadwal Kontrol", formatDateIndonesian(*disposition.FollowUpDate), 40)
	}
	if disposition.FollowUpInstruction != "" {
		addTableMultiRow(pdf, "Instruksi Kontrol", disposition.FollowUpInstruction, 40)
	}
	
	addTableEnd(pdf)

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, doctorName, models.DocTypeVisitResume, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupResume))

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resume_Medis_%s_%s.pdf", patient.NoRM, visit.VisitNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupResume, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupResume, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeVisitResume, visit.ID}); isSigned {
			go storeCachedPDF("outpatient_resume", visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintPatientLabel generates PDF for patient labels
// Kertas: 80mm x 20mm, 2 kolom (2 label per halaman)
func printInpatientResumeImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	rmDuplicateID := c.Query("rm_duplicate_id")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupInpatientResume, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF("inpatient_resume", uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit not found"})
		return
	}

	if visit.Registration == nil || visit.Registration.Patient == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Patient data not found"})
		return
	}

	patient := visit.Registration.Patient

	// Data structures
	var anamnesisChiefComplaint, anamnesisHistory, anamnesisPastHistory, anamnesisAllergies string
	var physicalExam struct {
		ID                                                                                                                                                                              uint
		GeneralCondition, Consciousness, BloodPressure, HeartRate, RespiratoryRate, Temperature, OxygenSaturation, Weight, Height, UpperArmCircum, HeadCircum, Waist                    string
		Head, Eyes, Ears, Nose, Throat, ENT, Neck, Chest, Thorax, Heart, Cardiac, Lungs, Pulmonary, Abdomen, Extremities, Skin, Neurological, Musculoskel, Genitourinary, OtherFindings string
		PainMethod                                                                                                                                                                      string
		PainScale                                                                                                                                                                       int
		PainLocation                                                                                                                                                                    string
	}
	type DiagData struct{ Type, ICD10Code, ICD10Name string }
	var diagnosesList []DiagData
	var dispType, dispStatus, dispInstruction, dispMedication string
	var dispFollowUpDate *time.Time
	type MedItemData struct {
		Name, Dosage, Frequency, Route, Unit, Instructions string
		Quantity                                           int
	}
	var dischargeMeds []MedItemData

	// Load from clinicalDB (either Main DB or Casemix DB)
	var anamnesisModel models.Anamnesis
	clinicalVisitQuery(c, visitID).First(&anamnesisModel)
	anamnesisChiefComplaint = anamnesisModel.ChiefComplaint
	anamnesisHistory = anamnesisModel.HistoryOfPresentIllness
	anamnesisPastHistory = anamnesisModel.PastMedicalHistory
	anamnesisAllergies = anamnesisModel.Allergies

	var physExamModel models.PhysicalExamination
	clinicalVisitQuery(c, visitID).First(&physExamModel)
	physicalExam.ID = physExamModel.ID
	physicalExam.GeneralCondition = physExamModel.GeneralCondition
	physicalExam.Consciousness = physExamModel.Consciousness
	physicalExam.BloodPressure = physExamModel.BloodPressure
	physicalExam.HeartRate = physExamModel.HeartRate
	physicalExam.RespiratoryRate = physExamModel.RespiratoryRate
	physicalExam.Temperature = physExamModel.Temperature
	physicalExam.OxygenSaturation = physExamModel.OxygenSaturation
	physicalExam.Weight = physExamModel.Weight
	physicalExam.Height = physExamModel.Height
	physicalExam.UpperArmCircum = physExamModel.UpperArmCircum
	physicalExam.HeadCircum = physExamModel.HeadCircum
	physicalExam.Waist = physExamModel.Waist
	physicalExam.Head = physExamModel.Head
	physicalExam.Eyes = physExamModel.Eyes
	physicalExam.Ears = physExamModel.Ears
	physicalExam.Nose = physExamModel.Nose
	physicalExam.Throat = physExamModel.Throat
	physicalExam.ENT = physExamModel.ENT
	physicalExam.Neck = physExamModel.Neck
	physicalExam.Chest = physExamModel.Chest
	physicalExam.Thorax = physExamModel.Thorax
	physicalExam.Heart = physExamModel.Heart
	physicalExam.Cardiac = physExamModel.Cardiac
	physicalExam.Lungs = physExamModel.Lungs
	physicalExam.Pulmonary = physExamModel.Pulmonary
	physicalExam.Abdomen = physExamModel.Abdomen
	physicalExam.Extremities = physExamModel.Extremities
	physicalExam.Skin = physExamModel.Skin
	physicalExam.Neurological = physExamModel.Neurological
	physicalExam.Musculoskel = physExamModel.Musculoskel
	physicalExam.Genitourinary = physExamModel.Genitourinary
	physicalExam.OtherFindings = physExamModel.OtherFindings
	physicalExam.PainMethod = physExamModel.PainMethod
	physicalExam.PainScale = physExamModel.PainScale
	physicalExam.PainLocation = physExamModel.PainLocation

	var dList []models.Diagnosis
	clinicalVisitQuery(c, visitID).Order("type ASC, sequence ASC").Find(&dList)
	for _, d := range dList {
		diagnosesList = append(diagnosesList, DiagData{Type: d.Type, ICD10Code: d.ICD10Code, ICD10Name: d.ICD10Name})
	}

	var dispModel models.Disposition
	clinicalVisitQuery(c, visitID).First(&dispModel)
	dispType = dispModel.DispositionType
	dispStatus = dispModel.DischargeStatus
	dispInstruction = dispModel.DischargeInstruction
	dispMedication = dispModel.DischargeMedication
	dispFollowUpDate = dispModel.FollowUpDate

	var medicineOrders []models.MedicineOrder
	clinicalSourceVisitQuery(c, visitID).Where("status <> ?", models.OrderStatusCancelled).
		Where("(fulfillment_type = ?) OR (COALESCE(fulfillment_type, '') = '' AND prescription_type = ?)", models.FulfillmentTypeTakeHome, "discharge").
		Preload("Items.Medicine").Find(&medicineOrders)
	for _, order := range medicineOrders {
		for _, item := range order.Items {
			medName := ""
			if item.Medicine != nil {
				medName = item.Medicine.Name
			}
			dischargeMeds = append(dischargeMeds, MedItemData{Name: medName, Dosage: item.Dosage, Frequency: item.Frequency, Route: item.Route, Quantity: item.Quantity, Unit: item.Unit, Instructions: item.Instructions})
		}
	}

	// Keep diagnosis order consistent and clinically meaningful.
	sort.Slice(diagnosesList, func(i, j int) bool {
		ri := diagnosisTypeRank(diagnosesList[i].Type)
		rj := diagnosisTypeRank(diagnosesList[j].Type)
		if ri != rj {
			return ri < rj
		}
		if diagnosesList[i].ICD10Code != diagnosesList[j].ICD10Code {
			return diagnosesList[i].ICD10Code < diagnosesList[j].ICD10Code
		}
		return diagnosesList[i].ICD10Name < diagnosesList[j].ICD10Name
	})

	// Get hospital info
	hospitalInfo := getHospitalInfo()

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "Resume Medis Rawat Inap", visit.VisitNumber)

	// Patient info
	addPatientInfoTable(pdf, patient, &visit)

	// Admission & Discharge info
	addTableHeader(pdf, "INFORMASI RAWAT INAP")
	admitDate := "-"
	if visit.StartTime != nil {
		admitDate = formatDateIndonesian(*visit.StartTime) + ", " + visit.StartTime.Format("15:04")
	}
	addTableRow(pdf, "Tanggal Masuk", admitDate, 40)

	dischargeDate := "-"
	if visit.EndTime != nil {
		dischargeDate = formatDateIndonesian(*visit.EndTime) + ", " + visit.EndTime.Format("15:04")
	}
	addTableRow(pdf, "Tanggal Keluar", dischargeDate, 40)

	// Calculate LOS
	los := 0
	if visit.StartTime != nil && visit.EndTime != nil {
		duration := visit.EndTime.Sub(*visit.StartTime)
		los = int(duration.Hours() / 24)
		if los < 1 {
			los = 1
		}
	}
	addTableRow(pdf, "Lama Rawat", fmt.Sprintf("%d hari", los), 40)
	addTableEnd(pdf)

	// Clinical Snapshot - concise high-value summary for faster reading.
	primaryDx := "-"
	for _, d := range diagnosesList {
		if d.Type == "primary" {
			if d.ICD10Code != "" && d.ICD10Name != "" {
				primaryDx = fmt.Sprintf("%s - %s", d.ICD10Code, d.ICD10Name)
			} else {
				primaryDx = safeString(d.ICD10Name)
			}
			break
		}
	}
	if primaryDx == "-" && len(diagnosesList) > 0 {
		d := diagnosesList[0]
		if d.ICD10Code != "" && d.ICD10Name != "" {
			primaryDx = fmt.Sprintf("%s - %s", d.ICD10Code, d.ICD10Name)
		} else {
			primaryDx = safeString(d.ICD10Name)
		}
	}

	vitals := []string{}
	if physicalExam.BloodPressure != "" {
		vitals = append(vitals, "TD "+physicalExam.BloodPressure)
	}
	if physicalExam.HeartRate != "" {
		vitals = append(vitals, "N "+physicalExam.HeartRate)
	}
	if physicalExam.RespiratoryRate != "" {
		vitals = append(vitals, "RR "+physicalExam.RespiratoryRate)
	}
	if physicalExam.Temperature != "" {
		vitals = append(vitals, "S "+physicalExam.Temperature)
	}
	if physicalExam.OxygenSaturation != "" {
		vitals = append(vitals, "SpO2 "+physicalExam.OxygenSaturation+"%")
	}
	vitalSummary := "-"
	if len(vitals) > 0 {
		vitalSummary = strings.Join(vitals, " | ")
	}
	spo2Val := parseLeadingInt(physicalExam.OxygenSaturation)
	oxygenAlert := spo2Val > 0 && spo2Val < 94
	if oxygenAlert {
		vitalSummary += " | SpO2 Rendah"
	}

	painSummary := "Tidak Nyeri"
	if physicalExam.PainScale > 0 {
		painSummary = painScaleWithSeverity(physicalExam.PainScale)
	}
	painAlert := physicalExam.PainScale >= 4
	if physicalExam.PainLocation != "" {
		painSummary += " - " + formatEnumDisplay(physicalExam.PainLocation)
	}

	allergyStatus := "Tidak Ada"
	if strings.TrimSpace(anamnesisAllergies) != "" && strings.TrimSpace(anamnesisAllergies) != "-" {
		allergyStatus = "Ada"
	}
	allergyR, allergyG, allergyB := 22, 101, 52
	if allergyStatus == "Ada" {
		allergyR, allergyG, allergyB = 185, 28, 28
	}

	complexityScore := 0
	if len(diagnosesList) >= 3 {
		complexityScore += 2
	} else if len(diagnosesList) >= 1 {
		complexityScore += 1
	}
	if oxygenAlert {
		complexityScore += 1
	}
	if painAlert {
		complexityScore += 1
	}
	if allergyStatus == "Ada" {
		complexityScore += 1
	}

	complexityLabel := "Ringan"
	complexityR, complexityG, complexityB := 22, 101, 52
	if complexityScore >= 4 {
		complexityLabel = "Tinggi"
		complexityR, complexityG, complexityB = 185, 28, 28
	} else if complexityScore >= 2 {
		complexityLabel = "Sedang"
		complexityR, complexityG, complexityB = 180, 83, 9
	}
	complexityDisplay := fmt.Sprintf("%s (%d)", complexityLabel, complexityScore)

	alertItems := []string{}
	if allergyStatus == "Ada" {
		alertItems = append(alertItems, "Alergi")
	}
	if oxygenAlert {
		alertItems = append(alertItems, "SpO2 Rendah")
	}
	if painAlert {
		alertItems = append(alertItems, "Nyeri Sedang/Berat")
	}
	alertSummary := "Tidak ada alert utama"
	if len(alertItems) > 0 {
		alertSummary = strings.Join(alertItems, " + ")
	}

	addTableHeader(pdf, "CLINICAL SNAPSHOT")
	if len(alertItems) > 0 {
		addHighlightedTableRow(pdf, "Alert Utama", alertSummary, 40, 242, 242, 242, 185, 28, 28)
	} else {
		addHighlightedTableRow(pdf, "Alert Utama", alertSummary, 40, 242, 242, 242, 0, 0, 0)
	}
	addTableRow(pdf, "Diagnosis Utama", primaryDx, 40)
	if oxygenAlert {
		pdf.SetTextColor(180, 83, 9)
		addTableRow(pdf, "Tanda Vital Inti", vitalSummary, 40)
		pdf.SetTextColor(0, 0, 0)
	} else {
		addTableRow(pdf, "Tanda Vital Inti", vitalSummary, 40)
	}
	if painAlert {
		pdf.SetTextColor(185, 28, 28)
		addTableRow(pdf, "Ringkasan Nyeri", painSummary, 40)
		pdf.SetTextColor(0, 0, 0)
	} else {
		addTableRow(pdf, "Ringkasan Nyeri", painSummary, 40)
	}
	pdf.SetTextColor(allergyR, allergyG, allergyB)
	addTableRow(pdf, "Alergi", allergyStatus, 40)
	pdf.SetTextColor(0, 0, 0)
	addHighlightedTableRow(pdf, "Kompleksitas Kasus", complexityDisplay, 40, 242, 242, 242, complexityR, complexityG, complexityB)
	addTableRow(pdf, "Legend Skor", "0-1 Ringan | 2-3 Sedang | >=4 Tinggi", 40)
	addTableRow(pdf, "Disposisi", formatEnumDisplay(dispType), 40)
	addTableEnd(pdf)

	// Anamnesis Section
	addTableHeader(pdf, "ANAMNESIS")
	addTableRow(pdf, "Keluhan Utama", safeString(anamnesisChiefComplaint), 40)
	addTableRow(pdf, "Riwayat Penyakit Sekarang", safeString(anamnesisHistory), 40)
	addTableRow(pdf, "Riwayat Penyakit Dahulu", safeString(anamnesisPastHistory), 40)
	
	if anamnesisAllergies != "" && anamnesisAllergies != "Tidak Ada" && anamnesisAllergies != "-" {
		pdf.SetFont("Arial", "B", 9)
		pdf.SetTextColor(220, 53, 69)
		pdf.SetDrawColor(100, 100, 100)
		pdf.CellFormat(40, rowHeight, " Alergi", "LB", 0, "L", false, 0, "")
		pdf.CellFormat(contentWidth-40, rowHeight, anamnesisAllergies, "RB", 1, "L", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	}
	addTableEnd(pdf)

	// Physical Examination Section
	addTableHeader(pdf, "PEMERIKSAAN FISIK")
	addTableRow(pdf, "Keadaan Umum", safeString(physicalExam.GeneralCondition), 40)
	addTableRow(pdf, "Kesadaran", safeString(physicalExam.Consciousness), 40)

	bp := safeString(physicalExam.BloodPressure)
	if bp != "-" { bp += " mmHg" }
	addTableRow(pdf, "Tekanan Darah", bp, 40)

	hr := safeString(physicalExam.HeartRate)
	if hr != "-" { hr += " x/menit" }
	addTableRow(pdf, "Nadi", hr, 40)

	rr := safeString(physicalExam.RespiratoryRate)
	if rr != "-" { rr += " x/menit" }
	addTableRow(pdf, "Frekuensi Napas", rr, 40)

	temp := safeString(physicalExam.Temperature)
	if temp != "-" { temp += " °C" }
	addTableRow(pdf, "Suhu", temp, 40)

	spo2 := safeString(physicalExam.OxygenSaturation)
	if spo2 != "-" { spo2 += " %" }
	addTableRow(pdf, "SpO2", spo2, 40)

	if physicalExam.Weight != "" {
		addTableRow(pdf, "Berat Badan", physicalExam.Weight+" kg", 40)
	}
	if physicalExam.Height != "" {
		addTableRow(pdf, "Tinggi Badan", physicalExam.Height+" cm", 40)
	}
		if physicalExam.UpperArmCircum != "" {
			addTableRow(pdf, "Lingkar Lengan Atas", physicalExam.UpperArmCircum+" cm", 40)
		}
		if physicalExam.HeadCircum != "" {
			addTableRow(pdf, "Lingkar Kepala", physicalExam.HeadCircum+" cm", 40)
		}
		if physicalExam.Waist != "" {
			addTableRow(pdf, "Lingkar Perut", physicalExam.Waist+" cm", 40)
		}
		if physicalExam.Head != "" {
			addTableRow(pdf, "Kepala", physicalExam.Head, 40)
		}
		if physicalExam.Eyes != "" {
			addTableRow(pdf, "Mata", physicalExam.Eyes, 40)
		}
		if physicalExam.Ears != "" {
			addTableRow(pdf, "Telinga", physicalExam.Ears, 40)
		}
		if physicalExam.Nose != "" {
			addTableRow(pdf, "Hidung", physicalExam.Nose, 40)
		}
		if physicalExam.Throat != "" {
			addTableRow(pdf, "Tenggorokan", physicalExam.Throat, 40)
		}
		if physicalExam.ENT != "" {
			addTableRow(pdf, "THT", physicalExam.ENT, 40)
		}
		if physicalExam.Neck != "" {
			addTableRow(pdf, "Leher", physicalExam.Neck, 40)
		}
		if physicalExam.Chest != "" {
			addTableRow(pdf, "Dada", physicalExam.Chest, 40)
		}
		if physicalExam.Thorax != "" {
			addTableRow(pdf, "Thorax", physicalExam.Thorax, 40)
		}
		if physicalExam.Heart != "" {
			addTableRow(pdf, "Jantung", physicalExam.Heart, 40)
		}
		if physicalExam.Cardiac != "" {
			addTableRow(pdf, "Kardiak", physicalExam.Cardiac, 40)
		}
		if physicalExam.Lungs != "" {
			addTableRow(pdf, "Paru", physicalExam.Lungs, 40)
		}
		if physicalExam.Pulmonary != "" {
			addTableRow(pdf, "Pulmoner", physicalExam.Pulmonary, 40)
		}
		if physicalExam.Abdomen != "" {
			addTableRow(pdf, "Abdomen", physicalExam.Abdomen, 40)
		}
		if physicalExam.Extremities != "" {
			addTableRow(pdf, "Ekstremitas", physicalExam.Extremities, 40)
		}
		if physicalExam.Skin != "" {
			addTableRow(pdf, "Kulit", physicalExam.Skin, 40)
		}
		if physicalExam.Neurological != "" {
			addTableRow(pdf, "Neurologis", physicalExam.Neurological, 40)
		}
		if physicalExam.Musculoskel != "" {
			addTableRow(pdf, "Muskuloskeletal", physicalExam.Musculoskel, 40)
		}
		if physicalExam.Genitourinary != "" {
			addTableRow(pdf, "Genitourinari", physicalExam.Genitourinary, 40)
		}
		if physicalExam.OtherFindings != "" {
			addTableRow(pdf, "Temuan Lain", physicalExam.OtherFindings, 40)
		}
		if physicalExam.PainMethod != "" {
			addTableRow(pdf, "Metode Nyeri", formatPainMethodDisplay(physicalExam.PainMethod), 45)
		}
		if physicalExam.PainScale > 0 {
			addTableRow(pdf, "Skala Nyeri", painScaleWithSeverity(physicalExam.PainScale), 45)
		}
		if physicalExam.PainLocation != "" {
			addTableRow(pdf, "Lokasi Nyeri", formatEnumDisplay(physicalExam.PainLocation), 45)
		}
	addTableEnd(pdf)

	// Final Diagnosis
	addTableHeader(pdf, "DIAGNOSIS AKHIR")
	if len(diagnosesList) > 0 {
		for _, diag := range diagnosesList {
			diagType := ""
			if diag.Type == "primary" {
				diagType = "[Utama] "
			}
			addTableFullRow(pdf, fmt.Sprintf("%s%s - %s", diagType, diag.ICD10Code, diag.ICD10Name), false)
		}
	} else {
		addTableFullRow(pdf, "Tidak ada diagnosis", false)
	}
	addTableEnd(pdf)

	// Discharge Status
	addTableHeader(pdf, "STATUS KELUAR")
	if dispType != "" {
		addTableRow(pdf, "Disposisi", safeString(dispType), 40)
		addTableRow(pdf, "Kondisi Keluar", safeString(dispStatus), 40)
	} else {
		addTableFullRow(pdf, "-", false)
	}
	addTableEnd(pdf)

	// Discharge Medications
	addTableHeader(pdf, "OBAT PULANG")
	if len(dischargeMeds) > 0 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(240, 240, 240)
		pdf.SetDrawColor(180, 180, 180)
		pdf.CellFormat(8, rowHeight, "No", "1", 0, "C", true, 0, "")
		pdf.CellFormat(70, rowHeight, "Nama Obat", "1", 0, "C", true, 0, "")
		pdf.CellFormat(38, rowHeight, "Aturan Pakai", "1", 0, "C", true, 0, "")
		pdf.CellFormat(25, rowHeight, "Jumlah", "1", 0, "C", true, 0, "")
		pdf.CellFormat(39, rowHeight, "Instruksi", "1", 1, "C", true, 0, "")
		pdf.SetFont("Arial", "", 8)
		for i, item := range dischargeMeds {
			aturan2 := item.Frequency
			if item.Route != "" {
				if aturan2 != "" {
					aturan2 += " / " + item.Route
				} else {
					aturan2 = item.Route
				}
			}
			qtyStr2 := ""
			if item.Quantity > 0 {
				qtyStr2 = fmt.Sprintf("%d %s", item.Quantity, item.Unit)
			} else if item.Unit != "" {
				qtyStr2 = item.Unit
			}
			instrText2 := item.Instructions
			if instrText2 == "" {
				instrText2 = "-"
			}
			checkPageBreak(pdf, rowHeight)
			pdf.CellFormat(8, rowHeight, fmt.Sprintf("%d", i+1), "1", 0, "C", false, 0, "")
			pdf.SetFont("Arial", "B", 8)
			pdf.CellFormat(70, rowHeight, truncateText(item.Name, 42), "1", 0, "L", false, 0, "")
			pdf.SetFont("Arial", "", 8)
			pdf.CellFormat(38, rowHeight, aturan2, "1", 0, "C", false, 0, "")
			pdf.CellFormat(25, rowHeight, qtyStr2, "1", 0, "C", false, 0, "")
			pdf.CellFormat(39, rowHeight, truncateText(instrText2, 24), "1", 1, "L", false, 0, "")
		}
	} else {
		addTableFullRow(pdf, "Tidak ada obat pulang", false)
	}
	addTableEnd(pdf)

	// Discharge Instructions
	addTableHeader(pdf, "INSTRUKSI PULANG")
	if dispMedication != "" {
		addTableMultiRow(pdf, "Obat Pulang", dispMedication, 40)
	}
	if dispInstruction != "" {
		addTableFullRow(pdf, dispInstruction, false)
	} else {
		addTableFullRow(pdf, "-", false)
	}
	if dispFollowUpDate != nil {
		addTableRow(pdf, "Jadwal Kontrol", formatDateIndonesian(*dispFollowUpDate), 40)
	}
	addTableEnd(pdf)

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, doctorName, models.DocTypeVisitResume, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupInpatientResume))

	// Output PDF
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Resume_Ranap_%s_%s.pdf", patient.NoRM, visit.VisitNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupInpatientResume, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupInpatientResume, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeVisitResume, visit.ID}); isSigned {
			go storeCachedPDF("inpatient_resume", visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// PrintSickLetter generates PDF for sick letter
func printEmergencySummaryImpl(c *gin.Context) {
	visitID := c.Param("visitId")
	rmDuplicateID := c.Query("rm_duplicate_id")
	if visitUint, err := strconv.ParseUint(visitID, 10, 32); err == nil {
		prepareCasemixPrintData(c, uint(visitUint))
	}

	// Cache check
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeRMDupEmergency, uint(rmDupID)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	} else {
		vid, _ := strconv.ParseUint(visitID, 10, 32)
		if pdfData, fileName, found := getCachedPDF(models.DocTypeEmergencySummary, uint(vid)); found {
			c.Header("Content-Type", "application/pdf")
			c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
			c.Data(http.StatusOK, "application/pdf", pdfData)
			return
		}
	}

	// Load visit with relations
	var visit models.Visit
	if err := database.DB.
		Preload("Registration.Patient").
		Preload("Room").
		Preload("Doctor").
		First(&visit, visitID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visit tidak ditemukan"})
		return
	}

	patient := visit.Registration.Patient
	hospitalInfo := getHospitalInfo()

	clinicalDB := getClinicalDB(c)

	// Load clinical data from clinicalDB (either Main DB or Casemix DB)
	var triage models.Triage
	visitIDUint, _ := strconv.ParseUint(visitID, 10, 64)
	if triagePtr, ok := findTriageForVisit(uint(visitIDUint)); ok {
		// findTriageForVisit uses Main DB, so if we are in Casemix mode, we should try Casemix DB first
		if clinicalDB == database.CasemixDB {
			var tx models.Triage
			if clinicalVisitQuery(c, uint(visitIDUint)).First(&tx).Error == nil {
				triage = tx
			} else {
				triage = *triagePtr
			}
		} else {
			triage = *triagePtr
		}
	}

	var anamnesis models.Anamnesis
	clinicalVisitQuery(c, visitID).First(&anamnesis)

	var physicalExam models.PhysicalExamination
	clinicalVisitQuery(c, visitID).First(&physicalExam)

	var diagnoses []models.Diagnosis
	clinicalVisitQuery(c, visitID).Order("type ASC, sequence ASC").Find(&diagnoses)

	var disposition models.Disposition
	clinicalVisitQuery(c, visitID).First(&disposition)

	var medicineOrders []models.MedicineOrder
	applyCasemixEklaimScope(c, getClinicalDB(c).Preload("Items.Medicine").Where("(source_visit_id = ? OR visit_id = ?) AND is_casemix = ?", visitID, visitID, useCasemixClinicalData(c))).Find(&medicineOrders)

	var procedureOrders []models.ProcedureOrder
	applyCasemixEklaimScope(c, getClinicalDB(c).Where("(source_visit_id = ? OR visit_id = ?) AND is_casemix = ?", visitID, visitID, useCasemixClinicalData(c))).Find(&procedureOrders)

	var visitProcedures []models.VisitProcedure
	clinicalVisitQuery(c, visitID).Preload("Procedure").Find(&visitProcedures)

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(marginLeft, marginTop, marginRight)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// Header
	addHeader(pdf, hospitalInfo, "RINGKASAN PELAYANAN UGD", "")

	// Patient Info
	addPatientInfoTable(pdf, patient, &visit)

	// Triage Summary
	if triage.ID > 0 {
		addTableHeader(pdf, "A. TRIAGE")
		am := triage.ArrivalMode
		tc := triage.TriageComplaint
		tl := triage.TriageLevel
		bp := triage.BloodPressure
		hr := triage.HeartRate
		temp := triage.Temperature
		spo2 := triage.OxygenSaturation
		gcse := triage.GCSE
		gcsv := triage.GCSV
		gcsm := triage.GCSM

		addTableRow(pdf, "Cara Datang", safeString(am), 45)
		addTableRow(pdf, "Keluhan", safeString(tc), 45)
		if tl != "" {
			addTableRow(pdf, "Level Triage", "Level "+tl, 45)
		}
		gcsStr := fmt.Sprintf("E%d V%d M%d = %d", gcse, gcsv, gcsm, gcse+gcsv+gcsm)
		addTableRow(pdf, "GCS", gcsStr, 45)
		vitalStr := fmt.Sprintf("TD: %s, N: %s, S: %s, SpO2: %s", safeString(bp), safeString(hr), safeString(temp), safeString(spo2))
		addTableRow(pdf, "Tanda Vital", vitalStr, 45)
		addTableEnd(pdf)
	}

	// Anamnesis
	if anamnesis.ChiefComplaint != "" || anamnesis.HistoryOfPresentIllness != "" {
		addTableHeader(pdf, "B. ANAMNESIS")
		addTableMultiRow(pdf, "Keluhan Utama", safeString(anamnesis.ChiefComplaint), 45)
		addTableMultiRow(pdf, "Riwayat Penyakit Sekarang", safeString(anamnesis.HistoryOfPresentIllness), 45)
		if anamnesis.PastMedicalHistory != "" {
			addTableMultiRow(pdf, "Riwayat Penyakit Dahulu", anamnesis.PastMedicalHistory, 45)
		}
		if anamnesis.Allergies != "" {
			addTableRow(pdf, "Alergi", anamnesis.Allergies, 45)
		}
		addTableEnd(pdf)
	}

	// Physical Examination
	if physicalExam.GeneralCondition != "" || physicalExam.BloodPressure != "" {
		addTableHeader(pdf, "C. PEMERIKSAAN FISIK")
		addTableRow(pdf, "Keadaan Umum", safeString(physicalExam.GeneralCondition), 45)
		addTableRow(pdf, "Kesadaran", safeString(physicalExam.Consciousness), 45)
		vitalStr := fmt.Sprintf("TD: %s, N: %s, RR: %s, S: %s, SpO2: %s",
			safeString(physicalExam.BloodPressure), safeString(physicalExam.HeartRate), safeString(physicalExam.RespiratoryRate), safeString(physicalExam.Temperature), safeString(physicalExam.OxygenSaturation))
		addTableRow(pdf, "Tanda Vital", vitalStr, 45)
		addTableEnd(pdf)
	}

	// Diagnosis
	if len(diagnoses) > 0 {
		addTableHeader(pdf, "D. DIAGNOSIS")
		for i, dx := range diagnoses {
			dxType := "Sekunder"
			if dx.Type == "primary" {
				dxType = "Primer"
			}
			dxStr := fmt.Sprintf("%d. %s - %s (%s)", i+1, dx.ICD10Code, dx.ICD10Name, dxType)
			addTableFullRow(pdf, dxStr, false)
		}
		addTableEnd(pdf)
	}

	// Procedures
	if len(visitProcedures) > 0 {
		addTableHeader(pdf, "E. TINDAKAN YANG DILAKUKAN")
		for _, vp := range visitProcedures {
			procName := "-"
			if vp.Procedure != nil {
				procName = vp.Procedure.Name
			}
			addTableFullRow(pdf, "• "+procName, false)
		}
		addTableEnd(pdf)
	}

	// Medications
	if len(medicineOrders) > 0 {
		addTableHeader(pdf, "F. TERAPI / OBAT")
		for _, mo := range medicineOrders {
			for _, item := range mo.Items {
				medName := "-"
				if item.Medicine != nil {
					medName = item.Medicine.Name
				}
				medStr := fmt.Sprintf("• %s - %s %s x %d", medName, item.Dosage, item.Frequency, item.Quantity)
				addTableFullRow(pdf, medStr, false)
			}
		}
		addTableEnd(pdf)
	}

	// Disposition
	if disposition.ID > 0 {
		addTableHeader(pdf, "G. DISPOSISI")
		dispType := disposition.DispositionType
		switch dispType {
		case "pulang":
			dispType = "Pulang"
		case "rawat_inap":
			dispType = "Rawat Inap"
		case "rujuk":
			dispType = "Rujuk"
		case "meninggal":
			dispType = "Meninggal"
		case "aps":
			dispType = "APS (Atas Permintaan Sendiri)"
		}
		addTableRow(pdf, "Keputusan", dispType, 45)
		if disposition.DischargeStatus != "" {
			addTableRow(pdf, "Status Pulang", disposition.DischargeStatus, 45)
		}
		if disposition.DischargeInstruction != "" {
			addTableMultiRow(pdf, "Instruksi", disposition.DischargeInstruction, 45)
		}
		if disposition.FollowUpDate != nil {
			addTableRow(pdf, "Kontrol Ulang", formatDateIndonesian(*disposition.FollowUpDate), 45)
		}
		if disposition.ReferralFacility != "" {
			addTableRow(pdf, "Tujuan Rujuk", disposition.ReferralFacility, 45)
		}
		addTableEnd(pdf)
	}

	// Signature
	doctorName := "-"
	if visit.Doctor != nil {
		doctorName = resolveAssignedUserNameFromEmployee(visit.Doctor, doctorName)
	}
	addDualSignature(pdf, hospitalInfo.City, doctorName, models.DocTypeEmergencySummary, visit.ID,
		rmDupSignatureLookup(c, models.DocTypeRMDupEmergency))

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}

	filename := fmt.Sprintf("Ringkasan_UGD_%s.pdf", visit.VisitNumber)
	if rmDuplicateID != "" {
		rmDupID, _ := strconv.ParseUint(rmDuplicateID, 10, 32)
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeRMDupEmergency, uint(rmDupID)}); isSigned {
			go storeCachedPDF(models.DocTypeRMDupEmergency, uint(rmDupID), buf.Bytes(), filename)
		}
	} else {
		if _, isSigned := findSignatureLog(signatureLookup{models.DocTypeEmergencySummary, visit.ID}); isSigned {
			go storeCachedPDF(models.DocTypeEmergencySummary, visit.ID, buf.Bytes(), filename)
		}
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", buf.Bytes())
}

// ===========================================================================
// D. CETAKAN RAWAT INAP
// ===========================================================================

// PrintCPPT prints the integrated patient progress notes (D1)
// GET /api/print/cppt/:visitId
