export const MEDICAL_RECORD_TAB_INDICATOR_EVENT = "medical-record-tab-indicator";
export const MEDICAL_RECORD_TAB_SAVED_EVENT = "medical-record-tab-saved";

interface TabIndicatorPayload {
  tabId: string;
  value: string;
}

interface TabSavedPayload {
  tabId: string;
  saved: boolean;
}

export function emitMedicalRecordTabIndicator(tabId: string, value: string) {
  window.dispatchEvent(
    new CustomEvent<TabIndicatorPayload>(MEDICAL_RECORD_TAB_INDICATOR_EVENT, {
      detail: { tabId, value },
    })
  );
}

export function emitMedicalRecordTabSaved(tabId: string, saved: boolean) {
  window.dispatchEvent(
    new CustomEvent<TabSavedPayload>(MEDICAL_RECORD_TAB_SAVED_EVENT, {
      detail: { tabId, saved },
    })
  );
}

export function emitMedicalRecordTabsSaved(tabIds: string[], saved: boolean) {
  window.dispatchEvent(
    new CustomEvent<{ tabIds: string[], saved: boolean }>("medical-record-tabs-saved", {
      detail: { tabIds, saved },
    })
  );
}
