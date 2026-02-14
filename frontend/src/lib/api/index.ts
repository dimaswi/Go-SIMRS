// Re-export everything from individual modules
export { api } from './client';

// Types
export type { Permission, Role, User } from './types';

// Auth
export { authApi } from './auth';
export type { LoginRequest, LoginResponse } from './auth';

// Users
export { usersApi } from './users';

// Roles
export { rolesApi } from './roles';

// Permissions
export { permissionsApi } from './permissions';

// Employees
export { employeesApi } from './employees';
export type { Employee, EmployeeRequest } from './employees';

// Regions
export { regionsApi } from './regions';
export type { Province, Regency, District, Village, RegionStats } from './regions';

// Settings
export { settingsApi } from './settings';

// Digital Signature & Audit Logs
export { signatureApi, DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from './signature';
export type {
  SetupPINRequest,
  ChangePINRequest,
  VerifyPINRequest,
  SignDocumentRequest,
  SignatureLog,
  MedicalRecordEditLog,
  DocumentSignatureStatus,
  VerifySignatureResponse,
} from './signature';

// BPJS (Legacy - use integrationsApi for new code)
export { bpjsApi } from './bpjs';
export type { 
  BPJSConfigValue, 
  BPJSConfigMap, 
  BPJSConnectionTestResult,
  BPJSSyncLog,
  BPJSSyncStats,
  BPJSPoliMapping,
  CreatePoliMappingRequest,
  UpdatePoliMappingRequest
} from './bpjs';

// Integrations (General - BPJS, SatuSehat, etc)
export { integrationsApi, bpjsBridgingApi, BPJS_SERVICE_TYPES, isBPJSType, getBPJSServiceName } from './integrations';
export type {
  IntegrationType,
  IntegrationConfigValue,
  IntegrationConfigMap,
  IntegrationConnectionTestResult,
  IntegrationSyncLog,
  IntegrationSyncStats,
  IntegrationInfo
} from './integrations';

// Master Data
export { masterDataApi } from './master-data';
export type { MasterData, MasterDataRequest, MasterDataCategory } from './master-data';

// Counters
export { counterApi } from './counters';
export type { Counter, CreateCounterInput, UpdateCounterInput } from './counters';

// Rooms
export { roomsApi, schedulesApi, getDayName, getDayShortName } from './rooms';
export type { 
  Room, RoomUnit, Bed, RoomStaff, RoomTariff,
  Schedule, DoctorSchedule, ScheduleException,
  RoomRequest, RoomUnitRequest, BedRequest, RoomStaffRequest, RoomTariffRequest, BulkRoomTariffRequest,
  ScheduleRequest, DoctorScheduleRequest, ScheduleExceptionRequest,
  RoomListResponse 
} from './rooms';

// Buildings & Floor Plan
export { buildingsApi, floorPlanApi, bedsideApi } from './buildings';
export type {
  Building, FloorPlanBed, FloorPlanUnit, FloorPlanRoom, FloorPlanBuilding,
  LayoutItem, SaveLayoutPayload, BedsideSummary,
  BedsidePatientAllergy, BedsideDiagnosis, BedsideCPPT, BedsideVitalSign,
  BedsideMedicineOrder, BedsideMedicineOrderItem, BedsideProcedureOrder,
  BedsideProcedureOrderItem, BedsideProcedureResult, BedsideVisit,
} from './buildings';

// Procedures
export { 
  proceduresApi, 
  roomProceduresApi, 
  PATIENT_CLASSES, 
  TARIFF_COMPONENTS,
  formatCurrency,
  getPatientClassLabel,
  calculateTotalTariff,
  getTariffByClass,
  initializeEmptyTariffs,
  tariffsToRequest,
  getProcedureGroupLabel,
  getSpecialtyLabel,
  getAnesthesiaTypeLabel,
  getServiceTypeLabel
} from './procedures';
export type { 
  Procedure, 
  ProcedureTariff, 
  TariffRequest, 
  RoomProcedure, 
  ProcedureCategory, 
  PatientClass,
  PatientClassOption,
  CreateProcedureRequest,
  CreateRoomProcedureRequest,
  ProcedureFilters
} from './procedures';

// Patients
export { patientsApi } from './patients';
export type { 
  Patient, 
  PatientRequest, 
  PatientListParams, 
  PatientStats,
  PatientStatus,
  BloodType,
  RhesusType,
  InsuranceType,
  ReferenceData
} from './patients';

// Inventories
export { 
  inventoriesApi, 
  roomInventoriesApi, 
  inventoryCategoryLabels,
  inventoryConditionLabels,
  inventoryStatusLabels
} from './inventories';
export type { 
  Inventory, 
  InventoryItem, 
  RoomInventory, 
  InventoryTransaction,
  InventoryCategory,
  InventoryCondition,
  InventoryStatus
} from './inventories';

// Medicines
export { 
  medicinesApi, 
  roomMedicinesApi, 
  medicineCategoryLabels,
  medicineTypeLabels,
  medicineFormLabels
} from './medicines';
export type { 
  Medicine, 
  MedicineRequest,
  RoomMedicine,
  RoomMedicineRequest,
  MedicineCategory,
  MedicineType,
  MedicineForm
} from './medicines';

// Queue & Registration
export { 
  queueApi, 
  registrationApi,
  queueStatusLabels,
  queueTypeLabels,
  registrationStatusLabels,
  paymentMethodLabels,
  registrationTypeLabels
} from './queue';
export type {
  Queue,
  QueueSummary,
  CreateQueueInput,
  Registration,
  RegistrationSummary,
  CreateRegistrationInput,
  UpdateRegistrationInput
} from './queue';

// Visits
export { visitsApi } from './visits';
export type {
  Visit,
  CreateVisitRequest
} from './visits';

// Medical Records
export { medicalRecordsApi } from './medical-records';
export type {
  MedicalRecord,
  MedicalRecordSummary,
  Triage,
  Anamnesis,
  PhysicalExam,
  Diagnosis,
  DiagnosisItem,
  AssessmentPlan,
  Disposition
} from './medical-records';

// Room Queues
export { roomQueuesApi } from './room-queues';
export type {
  RoomQueue,
  RoomQueueStats,
  CreateRoomQueueRequest,
  UpdateQueueStatusRequest
} from './room-queues';

// Medicine Orders
export { medicineOrdersApi, getPharmacyRoomMedicines } from './medicine-orders';
export type {
  MedicineOrder,
  MedicineOrderItem,
  CreateMedicineOrderInput,
  PrescriptionReview,
  DispenseInput,
  MedicineReturn,
  CreateMedicineReturnInput
} from './medicine-orders';

// Procedure Orders (Radiology & Laboratory)
export { 
  procedureOrdersApi, 
  PROCEDURE_ORDER_STATUS, 
  PROCEDURE_ORDER_TYPES 
} from './procedure-orders';
export type {
  ProcedureOrder,
  ProcedureOrderItem,
  ProcedureOrderResult,
  ProcedureParameter,
  CreateProcedureOrderInput,
  SubmitResultsInput
} from './procedure-orders';

// Visit Procedures (Tindakan di Ruangan)
export { 
  visitProceduresApi, 
  VISIT_PROCEDURE_STATUS,
  getVisitProcedureStatusLabel,
  getVisitProcedureStatusColor
} from './visit-procedures';
export type {
  RoomProcedureForVisit,
  VisitProcedure,
  VisitProcedureResult,
  CreateVisitProcedureInput,
  SaveVisitProcedureResultsInput,
  UpdateVisitProcedureStatusInput
} from './visit-procedures';

// Inpatient (CPPT, Fluid Balance & Nursing Care)
export {
  cpptApi,
  fluidBalanceApi,
  nursingCareApi,
  CPPT_PROFESSIONS,
  SHIFT_TYPES,
  CONSCIOUSNESS_LEVELS,
  FUNCTIONAL_STATUS,
  PRESSURE_ULCER_RISK,
  OUTCOME_TARGETS,
  PROBLEM_STATUS,
  getCPPTProfessionLabel,
  getShiftTypeLabel,
  getConsciousnessLevelLabel,
  getFunctionalStatusLabel,
  getProblemStatusLabel,
  getProblemStatusColor
} from './inpatient';
export type {
  CPPT,
  CreateCPPTInput,
  UpdateCPPTInput,
  FluidBalance,
  CreateFluidBalanceInput,
  UpdateFluidBalanceInput,
  FluidBalanceSummary,
  NursingCare,
  CreateNursingCareInput,
  UpdateNursingCareInput
} from './inpatient';

// Billing & Payment
export { billingApi, registrationTariffApi } from './billing';
export type {
  Billing,
  BillingItem,
  BillingPayment,
  RegistrationTariff,
  CreatePaymentRequest
} from './billing';

// Admission Request (Permintaan Rawat Inap)
export { admissionRequestApi } from './admission-request';
export type {
  AdmissionRequest,
  CreateAdmissionRequestInput,
  ProcessAdmissionRequestInput,
  RejectAdmissionRequestInput
} from './admission-request';

// Patient Allergy (with SNOMED CT for SatuSehat)
export { 
  patientAllergyApi,
  ALLERGY_CATEGORY_LABELS,
  ALLERGY_CRITICALITY_LABELS,
  ALLERGY_CRITICALITY_COLORS
} from './patient-allergy';
export type {
  PatientAllergy,
  AllergyCategory,
  AllergyCriticality,
  AllergyOptions,
  CreateAllergyInput,
  BulkCreateAllergiesInput
} from './patient-allergy';

// Archives (Medical Record Archive Management)
export { archivesApi, archiveDestructionsApi } from './archives';
export type {
  MedicalRecordArchive,
  ArchiveMovement,
  ArchiveDestruction,
  ArchiveStatistics,
  ArchiveStatus,
  ArchiveLocation
} from './archives';

// Print (PDF generation from backend)
export { printApi } from './print';

// Dashboard
export { dashboardApi } from './dashboard';
export type {
  DashboardStats,
  DashboardTrend,
  DashboardCharts,
  DashboardSummary,
  RoomVisitCount,
  DoctorVisitCount,
  ProcedureCount,
  MedicineCount,
  DiagnosisCount,
  RoomBedStatus,
  BedMonitoringData,
  RecentActivity
} from './dashboard';

// Quality Control & Cost Management (Kendali Mutu & Biaya)
export { qualityCostApi } from './quality-cost';
export type {
  IndicatorStandards,
  HospitalIndicators,
  QualityMetricsResponse,
  CostAnalysisSummary,
  CostCaseDetail,
  TopLossCase,
  CostByCategory,
  ClaimAgeGroup,
  PendingClaimSummary,
  QualityTrendPoint
} from './quality-cost';

// VClaim (BPJS SEP)
export { vclaimApi } from './vclaim';
export type {
  VClaimPeserta,
  VClaimRujukan,
  VClaimSEPRequest,
  VClaimSEP,
  VClaimRefPoli,
  VClaimRefDokter,
  VClaimRefDiagnosa,
  VClaimRefFaskes,
  VClaimRefPropinsi,
  VClaimSEPOptions,
  SEPLocal
} from './vclaim';

// Patient Portal (Public Access for Patients)
export { patientPortalApi, patientPortalAuth } from './patient-portal';
export type {
  PatientLoginRequest,
  PatientProfile,
  PatientLoginResponse,
  VisitHistoryItem,
  VisitHistoryResponse,
  VitalSign,
  Diagnosis as PortalDiagnosis,
  ProcedureItem,
  Medication,
  LabResult,
  VisitDetail,
  MedicalResume,
  PatientAllergy as PortalPatientAllergy,
  AllergiesResponse
} from './patient-portal';

// Reports
export {
  reportVisitsApi,
  reportBpjsApi,
  reportBillingApi,
  reportInpatientApi,
  reportPharmacyApi,
  reportPenunjangApi,
  reportInventoryApi,
  reportHrApi,
  reportKemenkesApi,
} from './reports';