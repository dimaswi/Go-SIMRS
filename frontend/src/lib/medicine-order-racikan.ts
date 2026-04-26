export const MEDICINE_ORDER_ITEM_TYPE_NON_RACIKAN = "non_racikan";
export const MEDICINE_ORDER_ITEM_TYPE_RACIKAN = "racikan";

export const RACIKAN_TYPE_OPTIONS = [
  "R.01 Kapsul",
  "R.02 Pulveres",
  "R.03 Sirup",
  "R.04 Salep",
  "R.05 Krim",
  "R.06 Suspensi",
  "R.07 Lainnya",
];

type MedicineOrderItemWithRacikan = {
  id?: number;
  medicine_id: number;
  quantity: number;
  unit?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  instructions?: string;
  notes?: string;
  item_type?: string;
  racikan_group?: string;
  racikan_name?: string;
  racikan_type?: string;
  racikan_qty?: number;
  racikan_unit?: string;
};

export interface GroupedMedicineOrderItems<T extends MedicineOrderItemWithRacikan> {
  key: string;
  type: "non_racikan" | "racikan";
  items: T[];
  racikanGroup?: string;
  racikanName?: string;
  racikanType?: string;
  racikanQty?: number;
  racikanUnit?: string;
  sharedFields: {
    dosage: string;
    frequency: string;
    route: string;
    duration: string;
    instructions: string;
    notes: string;
  };
}

export const isRacikanItem = (item?: MedicineOrderItemWithRacikan | null) =>
  item?.item_type === MEDICINE_ORDER_ITEM_TYPE_RACIKAN && Boolean(item.racikan_group);

export function groupMedicineOrderItems<T extends MedicineOrderItemWithRacikan>(
  items: T[],
): GroupedMedicineOrderItems<T>[] {
  const groups: GroupedMedicineOrderItems<T>[] = [];
  const racikanIndexByGroup = new Map<string, number>();

  items.forEach((item, index) => {
    if (!isRacikanItem(item)) {
      groups.push({
        key: `item-${item.id ?? index}-${item.medicine_id}`,
        type: "non_racikan",
        items: [item],
        sharedFields: {
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          route: item.route || "",
          duration: item.duration || "",
          instructions: item.instructions || "",
          notes: item.notes || "",
        },
      });
      return;
    }

    const racikanGroup = item.racikan_group || `racikan-${item.id ?? index}`;
    const existingIndex = racikanIndexByGroup.get(racikanGroup);

    if (existingIndex == null) {
      racikanIndexByGroup.set(racikanGroup, groups.length);
      groups.push({
        key: racikanGroup,
        type: "racikan",
        racikanGroup,
        racikanName: item.racikan_name || "Racikan",
        racikanType: item.racikan_type || "",
        racikanQty: item.racikan_qty || 0,
        racikanUnit: item.racikan_unit || "",
        items: [item],
        sharedFields: {
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          route: item.route || "",
          duration: item.duration || "",
          instructions: item.instructions || "",
          notes: item.notes || "",
        },
      });
      return;
    }

    groups[existingIndex].items.push(item);
  });

  return groups;
}

export function derivePrescriptionTypeFromItems<T extends MedicineOrderItemWithRacikan>(items: T[]) {
  return items.some((item) => isRacikanItem(item)) ? "racikan" : "regular";
}