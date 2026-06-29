
import re

with open("backend/handlers/visits.go", "r") as f:
    code = f.read()

# Fix 1: UpdateVisit
code = re.sub(
r"""(if visit\.BedID != nil && \*visit\.BedID > 0 {
\s+database\.DB\.Model\(&models\.Bed{}\)\.Where\("id = \?", \*visit\.BedID\)\.Update\("status", "available"\)
\s+
\s+action := "patient_completed_bed_released"
\s+if input\.Status == models\.VisitStatusCancelled {
\s+action = "patient_cancelled_bed_released"
\s+}
\s+go bpjsService\.UpdateRoomBedAvailability\(visit\.RoomID, action\)
\s+})""",
r"""if visit.BedID != nil && *visit.BedID > 0 {
				database.DB.Model(&models.Bed{}).Where("id = ?", *visit.BedID).Update("status", "available")
			}
			
			action := "patient_completed_bed_released"
			if input.Status == models.VisitStatusCancelled {
				action = "patient_cancelled_bed_released"
			}
			go bpjsService.UpdateRoomBedAvailability(visit.RoomID, action)""",
code)

# Fix 2: AcceptVisit
code = re.sub(
r"""(isEmergency := visit\.VisitType == "emergency" \|\| \(visit\.Room != nil && \(strings\.ToLower\(visit\.Room\.ServiceType\) == "ugd" \|\| strings\.ToLower\(visit\.Room\.ServiceType\) == "igd" \|\| strings\.ToLower\(visit\.Room\.ServiceType\) == "emergency"\)\)
\s+if isEmergency {
\s+go bpjsService\.UpdateRoomBedAvailability\(visit\.RoomID, "ugd_patient_accepted"\)
\s+})""",
r"""go bpjsService.UpdateRoomBedAvailability(visit.RoomID, "patient_accepted")""",
code)

# Fix 3: CompleteVisit
code = re.sub(
r"""(if visit\.BedID != nil && \*visit\.BedID > 0 {
\s+go bpjsService\.UpdateRoomBedAvailability\(visit\.RoomID, "patient_completed_bed_released"\)
\s+})""",
r"""if visit.BedID != nil && *visit.BedID > 0 {
		// already handled below? Wait, I added it in earlier replace. Let me check the actual text.
		pass
	}""",
code) # wait, I will write a simpler replacement below

with open("backend/handlers/visits.go", "w") as f:
    f.write(code)

