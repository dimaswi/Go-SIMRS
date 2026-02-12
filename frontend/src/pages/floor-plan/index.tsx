import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import {
  floorPlanApi,
  buildingsApi,
  roomsApi,
  type FloorPlanBuilding,
  type FloorPlanRoom,
  type FloorPlanUnit,
  type FloorPlanBed,
  type SaveLayoutPayload,
  type Room,
} from "@/lib/api";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Save,
  Pencil,
  Eye,
  Building2,
  BedDouble,
  Loader2,
  Move,
  User,
  ChevronRight,
  X,
  Plus,
  DoorOpen,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BedDetailModal from "./bed-detail-modal";

// ===========================================================================
// CONSTANTS
// ===========================================================================

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;
const GRID_SIZE = 10;

type ViewLevel = "buildings" | "rooms" | "beds";

// Colors for bed status
const BED_STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string; label: string }> = {
  available: { fill: "#dcfce7", stroke: "#16a34a", text: "#166534", label: "Tersedia" },
  occupied: { fill: "#dbeafe", stroke: "#2563eb", text: "#1e40af", label: "Terisi" },
  maintenance: { fill: "#f3f4f6", stroke: "#6b7280", text: "#374151", label: "Maintenance" },
  reserved: { fill: "#fef9c3", stroke: "#ca8a04", text: "#854d0e", label: "Reserved" },
  cleaning: { fill: "#fce7f3", stroke: "#db2777", text: "#9d174d", label: "Cleaning" },
};

const DEFAULT_BED_COLOR = { fill: "#f3f4f6", stroke: "#9ca3af", text: "#4b5563", label: "Unknown" };

// Palette for auto-coloring buildings that have no color set
const BUILDING_PALETTE = [
  "#e3f2fd", "#fce4ec", "#e8f5e9", "#fff8e1", "#f3e5f5",
  "#e0f7fa", "#fbe9e7", "#f1f8e9", "#ede7f6", "#e8eaf6",
];

// ===========================================================================
// FLOOR PLAN PAGE
// ===========================================================================

export default function FloorPlanPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>("buildings");
  const [activeBuildingId, setActiveBuildingId] = useState<number | null>(null);
  const [activeUnitId, setActiveUnitId] = useState<number | null>(null);
  const [activeFloor, setActiveFloor] = useState<number>(1);

  // Data state
  const [buildings, setBuildings] = useState<FloorPlanBuilding[]>([]);
  const [loading, setLoading] = useState(true);

  // Canvas state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [dragItem, setDragItem] = useState<{ type: string; id: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [resizeItem, setResizeItem] = useState<{ type: string; id: number; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const wasDraggedRef = useRef(false);

  // Bed info panel
  const [selectedBed, setSelectedBed] = useState<FloorPlanBed | null>(null);
  const [selectedBedUnit, setSelectedBedUnit] = useState<FloorPlanUnit | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  // Properties panel (edit mode)
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ type: string; id: number } | null>(null);

  // Room assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [assignFloor, setAssignFloor] = useState<number>(1);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [assigningRooms, setAssigningRooms] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "building" | "unit" | "bed" | "canvas";
    building?: FloorPlanBuilding;
    unit?: FloorPlanUnit & { _room: FloorPlanRoom };
    bed?: FloorPlanBed;
    bedUnit?: FloorPlanUnit;
  } | null>(null);

  // Computed values
  const activeBuilding = buildings.find((b) => b.id === activeBuildingId) || null;
  const allUnitsInBuilding = activeBuilding?.rooms.flatMap((r) =>
    r.units.map((u) => ({ ...u, _room: r }))
  ) || [];
  const activeUnitData = allUnitsInBuilding.find((u) => u.id === activeUnitId) || null;

  // Compute distinct floors: use building.total_floors (fallback to unit-based detection)
  const availableFloors = (() => {
    const totalFloors = activeBuilding?.total_floors || 0;
    if (totalFloors > 0) {
      return Array.from({ length: totalFloors }, (_, i) => i + 1);
    }
    return Array.from(
      new Set(allUnitsInBuilding.map((u) => u.floor || 1))
    ).sort((a, b) => a - b);
  })();

  // Filter units by selected floor
  const unitsOnActiveFloor = allUnitsInBuilding.filter(
    (u) => (u.floor || 1) === activeFloor
  );

  // Auto-select first available floor when entering rooms level
  useEffect(() => {
    if (viewLevel === "rooms" && availableFloors.length > 0 && !availableFloors.includes(activeFloor)) {
      setActiveFloor(availableFloors[0]);
    }
  }, [viewLevel, availableFloors, activeFloor]);

  // ===========================================================================
  // DATA LOADING
  // ===========================================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await floorPlanApi.getLayout();
      // Normalize: ensure rooms/units/beds are always arrays
      const normalized = (res.data.data || []).map((b: FloorPlanBuilding) => ({
        ...b,
        rooms: (b.rooms || []).map((r: FloorPlanRoom) => ({
          ...r,
          units: (r.units || []).map((u: FloorPlanUnit) => ({
            ...u,
            beds: u.beds || [],
          })),
        })),
      }));
      setBuildings(normalized);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data floor plan" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Floor Plan");
    loadData();
  }, [loadData]);

  // Load available (unassigned) rooms for assignment dialog
  const loadAvailableRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await roomsApi.getAll({ building_id: "none", limit: 200, is_active: "true" });
      setAvailableRooms(res.data.data || []);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat daftar ruangan" });
    } finally {
      setLoadingRooms(false);
    }
  };

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  const resetCanvas = () => {
    setSelectedElement(null);
    setPropertiesOpen(false);
  };

  const navigateToBuildings = () => {
    setViewLevel("buildings");
    setActiveBuildingId(null);
    setActiveUnitId(null);
    resetCanvas();
  };

  const navigateToRooms = (buildingId: number) => {
    // Only reset floor when entering a different building
    if (buildingId !== activeBuildingId) {
      setActiveFloor(1);
    }
    setViewLevel("rooms");
    setActiveBuildingId(buildingId);
    setActiveUnitId(null);
    resetCanvas();
  };

  const navigateToBeds = (unitId: number) => {
    setViewLevel("beds");
    setActiveUnitId(unitId);
    resetCanvas();
  };

  // ===========================================================================
  // AUTO-CENTER VIEW
  // ===========================================================================

  const centerView = useCallback(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    if (containerW === 0 || containerH === 0) return;

    let items: { x: number; y: number; w: number; h: number }[] = [];

    if (viewLevel === "buildings") {
      const laid = autoLayoutItems(buildings, 280, 200, 40);
      items = laid.map(b => ({ x: b.position_x, y: b.position_y, w: b.width, h: b.height }));
    } else if (viewLevel === "rooms") {
      const ab = buildings.find(b => b.id === activeBuildingId);
      if (ab) {
        // Include the building container itself in the bounding box
        if (ab.width && ab.height) {
          items.push({ x: 0, y: 0, w: ab.width, h: ab.height });
        }
        const units = ab.rooms.flatMap(r => r.units).filter(u => (u.floor || 1) === activeFloor);
        const laid = autoLayoutItems(units, 220, 160, 30);
        for (const u of laid) {
          items.push({ x: u.position_x, y: u.position_y, w: u.width, h: u.height });
        }
      }
    } else if (viewLevel === "beds") {
      const ab = buildings.find(b => b.id === activeBuildingId);
      if (ab) {
        const unit = ab.rooms.flatMap(r => r.units).find(u => u.id === activeUnitId);
        if (unit) {
          // Include the unit container itself in the bounding box
          if (unit.width && unit.height) {
            items.push({ x: 0, y: 0, w: unit.width, h: unit.height });
          }
          const laid = autoLayoutBeds(unit.beds || []);
          for (const b of laid) {
            items.push({ x: b.position_x, y: b.position_y, w: b.width, h: b.height });
          }
        }
      }
    }

    if (items.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Bounding box of all items
    const minX = Math.min(...items.map(i => i.x));
    const minY = Math.min(...items.map(i => i.y));
    const maxX = Math.max(...items.map(i => i.x + i.w));
    const maxY = Math.max(...items.map(i => i.y + i.h));

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const cx = minX + contentW / 2;
    const cy = minY + contentH / 2;

    // Fit zoom
    const pad = 60;
    const scaleX = (containerW - pad * 2) / Math.max(contentW, 1);
    const scaleY = (containerH - pad * 2) / Math.max(contentH, 1);
    const maxZoom = viewLevel === "buildings" ? 1.5 : 1.2;
    const fitZoom = Math.min(scaleX, scaleY, maxZoom);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

    const panX = containerW / 2 - cx * newZoom;
    const panY = containerH / 2 - cy * newZoom;

    setZoom(newZoom);
    setPan({ x: panX, y: panY });
  }, [viewLevel, activeBuildingId, activeUnitId, activeFloor, buildings]);

  // Auto-center when navigation changes or data loads
  useEffect(() => {
    const timer = setTimeout(centerView, 60);
    return () => clearTimeout(timer);
  }, [centerView]);

  // ===========================================================================
  // ZOOM & PAN
  // ===========================================================================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  const handleZoomIn = () => setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  const handleZoomOut = () => setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  const handleZoomFit = () => centerView();
  const handleZoomReset = () => { setZoom(1); centerView(); };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg")) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        if (editMode) {
          setSelectedElement(null);
          setPropertiesOpen(false);
        }
      }
    },
    [pan, editMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }

      if (editMode && dragItem) {
        const dx = (e.clientX - dragItem.startX) / zoom;
        const dy = (e.clientY - dragItem.startY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          wasDraggedRef.current = true;
        }
        const newX = Math.round((dragItem.offsetX + dx) / GRID_SIZE) * GRID_SIZE;
        const newY = Math.round((dragItem.offsetY + dy) / GRID_SIZE) * GRID_SIZE;
        updateItemPosition(dragItem.type, dragItem.id, newX, newY);
      }

      if (editMode && resizeItem) {
        const dx = (e.clientX - resizeItem.startX) / zoom;
        const dy = (e.clientY - resizeItem.startY) / zoom;
        const newW = Math.max(60, Math.round((resizeItem.startW + dx) / GRID_SIZE) * GRID_SIZE);
        const newH = Math.max(40, Math.round((resizeItem.startH + dy) / GRID_SIZE) * GRID_SIZE);
        updateItemSize(resizeItem.type, resizeItem.id, newW, newH);
      }
    },
    [isPanning, panStart, editMode, dragItem, resizeItem, zoom],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragItem(null);
    setResizeItem(null);
  }, []);

  // Touch support for pinch zoom
  const [touchDist, setTouchDist] = useState<number>(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        setTouchDist(Math.sqrt(dx * dx + dy * dy));
      } else if (e.touches.length === 1) {
        setIsPanning(true);
        setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      }
    },
    [pan],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        const scale = newDist / touchDist;
        setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * scale)));
        setTouchDist(newDist);
      } else if (isPanning && e.touches.length === 1) {
        setPan({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
      }
    },
    [touchDist, isPanning, panStart],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setTouchDist(0);
  }, []);

  // ===========================================================================
  // EDIT MODE — DRAG & RESIZE
  // ===========================================================================

  const updateItemPosition = (type: string, id: number, x: number, y: number) => {
    setHasUnsavedChanges(true);
    setBuildings((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (type === "building") {
        const b = copy.find((b: FloorPlanBuilding) => b.id === id);
        if (b) { b.position_x = x; b.position_y = y; }
      } else if (type === "unit") {
        for (const b of copy) {
          for (const r of b.rooms) {
            const u = r.units.find((u: FloorPlanUnit) => u.id === id);
            if (u) { u.position_x = x; u.position_y = y; return copy; }
          }
        }
      } else if (type === "bed") {
        for (const b of copy) {
          for (const r of b.rooms) {
            for (const u of r.units) {
              const bed = u.beds.find((bed: FloorPlanBed) => bed.id === id);
              if (bed) { bed.position_x = x; bed.position_y = y; return copy; }
            }
          }
        }
      }
      return copy;
    });
  };

  const updateItemSize = (type: string, id: number, w: number, h: number) => {
    setHasUnsavedChanges(true);
    setBuildings((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (type === "building") {
        const b = copy.find((b: FloorPlanBuilding) => b.id === id);
        if (b) { b.width = w; b.height = h; }
      } else if (type === "unit") {
        for (const b of copy) {
          for (const r of b.rooms) {
            const u = r.units.find((u: FloorPlanUnit) => u.id === id);
            if (u) { u.width = w; u.height = h; return copy; }
          }
        }
      } else if (type === "bed") {
        for (const b of copy) {
          for (const r of b.rooms) {
            for (const u of r.units) {
              const bed = u.beds.find((bed: FloorPlanBed) => bed.id === id);
              if (bed) { bed.width = w; bed.height = h; return copy; }
            }
          }
        }
      }
      return copy;
    });
  };

  const startDrag = (type: string, id: number, currentX: number, currentY: number, e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    wasDraggedRef.current = false;
    setDragItem({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: currentX,
      offsetY: currentY,
    });
    setSelectedElement({ type, id });
    setPropertiesOpen(true);
  };

  const startResize = (type: string, id: number, currentW: number, currentH: number, e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    setResizeItem({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      startW: currentW,
      startH: currentH,
    });
  };

  // ===========================================================================
  // SAVE LAYOUT
  // ===========================================================================

  const handleSaveLayout = async () => {
    try {
      const payload: SaveLayoutPayload = { buildings: [], units: [], beds: [] };

      for (const b of buildings) {
        payload.buildings!.push({
          id: b.id,
          position_x: b.position_x,
          position_y: b.position_y,
          width: b.width,
          height: b.height,
        });
        for (const r of b.rooms) {
          for (const u of r.units) {
            payload.units!.push({
              id: u.id,
              position_x: u.position_x,
              position_y: u.position_y,
              width: u.width,
              height: u.height,
            });
            for (const bed of u.beds) {
              payload.beds!.push({
                id: bed.id,
                position_x: bed.position_x,
                position_y: bed.position_y,
                width: bed.width,
                height: bed.height,
              });
            }
          }
        }
      }

      await floorPlanApi.saveLayout(payload);
      setHasUnsavedChanges(false);
      toast({ title: "Berhasil", description: "Layout floor plan berhasil disimpan" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal menyimpan layout" });
    }
  };

  // ===========================================================================
  // CLICK HANDLERS
  // ===========================================================================

  const handleBuildingClick = (building: FloorPlanBuilding) => {
    if (editMode) {
      // In edit mode: click selects, drag moves, right-click for context menu
      if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
      setSelectedElement({ type: "building", id: building.id });
      setPropertiesOpen(true);
      return;
    }
    navigateToRooms(building.id);
  };

  const handleUnitClick = (unit: FloorPlanUnit) => {
    if (editMode) {
      if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
      setSelectedElement({ type: "unit", id: unit.id });
      setPropertiesOpen(true);
      return;
    }
    navigateToBeds(unit.id);
  };

  const handleBedClick = (bed: FloorPlanBed, unit: FloorPlanUnit) => {
    if (editMode) {
      if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
      setSelectedElement({ type: "bed", id: bed.id });
      setPropertiesOpen(true);
      return;
    }
    // Open fullscreen modal for any bed that has a patient
    if (bed.current_patient) {
      setSelectedBed(bed);
      setSelectedBedUnit(unit);
      setInfoPanelOpen(true);
    }
  };

  // ===========================================================================
  // CONTEXT MENU
  // ===========================================================================

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on any click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [contextMenu]);

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editMode) return;
    setContextMenu({ x: e.clientX, y: e.clientY, type: "canvas" });
  };

  const handleBuildingContextMenu = (e: React.MouseEvent, building: FloorPlanBuilding) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editMode) return;
    setContextMenu({ x: e.clientX, y: e.clientY, type: "building", building });
  };

  const handleUnitContextMenu = (
    e: React.MouseEvent,
    unit: FloorPlanUnit & { _room: FloorPlanRoom },
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editMode) return;
    setContextMenu({ x: e.clientX, y: e.clientY, type: "unit", unit });
  };

  const handleBedContextMenu = (e: React.MouseEvent, bed: FloorPlanBed, bedUnit: FloorPlanUnit) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editMode) return;
    setContextMenu({ x: e.clientX, y: e.clientY, type: "bed", bed, bedUnit });
  };

  // ===========================================================================
  // ROOM ASSIGNMENT
  // ===========================================================================

  const openAssignDialog = () => {
    setSelectedRoomIds([]);
    setAssignFloor(activeFloor);
    setAssignDialogOpen(true);
    loadAvailableRooms();
  };

  const handleAssignRooms = async () => {
    if (!activeBuildingId || selectedRoomIds.length === 0) return;
    try {
      setAssigningRooms(true);
      for (const roomId of selectedRoomIds) {
        await buildingsApi.assignRoom(activeBuildingId, roomId, assignFloor);
      }
      toast({ title: "Berhasil", description: `${selectedRoomIds.length} ruangan berhasil di-assign ke gedung` });
      setAssignDialogOpen(false);
      await loadData(); // Reload to reflect changes
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal assign ruangan" });
    } finally {
      setAssigningRooms(false);
    }
  };

  const handleUnassignRoom = async (roomId: number) => {
    if (!activeBuildingId) return;
    try {
      await buildingsApi.unassignRoom(activeBuildingId, roomId);
      toast({ title: "Berhasil", description: "Ruangan berhasil di-hapus dari gedung" });
      await loadData();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal unassign ruangan" });
    }
  };

  // ===========================================================================
  // PROPERTIES PANEL HELPERS
  // ===========================================================================

  const getSelectedItem = (): { type: string; item: any } | null => {
    if (!selectedElement) return null;
    const { type, id } = selectedElement;

    if (type === "building") {
      const b = buildings.find((b) => b.id === id);
      return b ? { type, item: b } : null;
    }
    if (type === "unit") {
      for (const b of buildings) {
        for (const r of b.rooms) {
          const u = r.units.find((u) => u.id === id);
          if (u) return { type, item: u };
        }
      }
    }
    if (type === "bed") {
      for (const b of buildings) {
        for (const r of b.rooms) {
          for (const u of r.units) {
            const bed = u.beds.find((bed) => bed.id === id);
            if (bed) return { type, item: bed };
          }
        }
      }
    }
    return null;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedItem = getSelectedItem();

  const getLevelLabel = () => {
    switch (viewLevel) {
      case "buildings": return "Gedung";
      case "rooms": return "Kamar";
      case "beds": return "Bed";
    }
  };

  // Check if canvas has items to display
  const hasItems =
    (viewLevel === "buildings" && buildings.length > 0) ||
    (viewLevel === "rooms" && activeBuilding && activeBuilding.rooms.length > 0) ||
    (viewLevel === "beds" && activeUnitData && activeUnitData.beds.length > 0);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1 mr-4">
          <Building2 className="h-5 w-5 text-primary" />
          <button
            className={cn(
              "text-sm font-medium hover:text-primary transition-colors",
              viewLevel === "buildings" ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
            onClick={navigateToBuildings}
          >
            Floor Plan
          </button>
          {viewLevel !== "buildings" && activeBuilding && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                className={cn(
                  "text-sm font-medium hover:text-primary transition-colors",
                  viewLevel === "rooms" ? "text-foreground font-semibold" : "text-muted-foreground",
                )}
                onClick={() => navigateToRooms(activeBuilding.id)}
              >
                {activeBuilding.name}
              </button>
            </>
          )}
          {viewLevel === "beds" && activeUnitData && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {activeUnitData._room.name} — {activeUnitData.name}
              </span>
            </>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomFit} title="Fit Screen">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomReset} title="Reset">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Edit mode toggle */}
        {hasPermission("rooms.update") && (
          <div className="flex items-center gap-2">
            <Switch checked={editMode} onCheckedChange={setEditMode} />
            <span className="text-xs flex items-center gap-1">
              {editMode ? <><Pencil className="h-3 w-3" /> Edit</> : <><Eye className="h-3 w-3" /> View</>}
            </span>
          </div>
        )}

        {/* Assign room button (edit mode + rooms level) */}
        {editMode && viewLevel === "rooms" && activeBuilding && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openAssignDialog}>
            <Plus className="h-3 w-3 mr-1" />
            Tambah Ruangan
          </Button>
        )}

        {/* Save button */}
        {editMode && hasUnsavedChanges && (
          <Button size="sm" className="h-8 text-xs" onClick={handleSaveLayout}>
            <Save className="h-3 w-3 mr-1" />
            Simpan Layout
          </Button>
        )}

        {/* Legend (show at bed level) */}
        {viewLevel === "beds" && (
          <div className="flex items-center gap-3 ml-auto">
            {Object.entries(BED_STATUS_COLORS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm border" style={{ background: val.fill, borderColor: val.stroke }} />
                <span className="text-[10px] text-muted-foreground">{val.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Info label */}
        {viewLevel !== "beds" && (
          <div className="ml-auto text-xs text-muted-foreground">
            {editMode
              ? "Drag untuk pindahkan · Klik untuk properties · Klik kanan untuk menu"
              : `Klik ${getLevelLabel()} untuk masuk ke detail`}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted/30 relative cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floating Back Button (top-left) */}
        {viewLevel !== "buildings" && (
          <button
            className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/90 backdrop-blur border shadow-sm hover:bg-accent transition-colors text-sm font-medium"
            onClick={() => {
              if (viewLevel === "beds") navigateToRooms(activeBuildingId!);
              else navigateToBuildings();
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </button>
        )}

        {/* Floating Floor Buttons (top-right) */}
        {viewLevel === "rooms" && activeBuilding && availableFloors.length > 0 && (
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 text-center">Lantai</span>
            {availableFloors.map((floor) => (
              <button
                key={floor}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm font-medium transition-colors shadow-sm backdrop-blur",
                  activeFloor === floor
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-background/90 hover:bg-accent border-border"
                )}
                onClick={() => setActiveFloor(floor)}
              >
                Lantai {floor}
              </button>
            ))}
          </div>
        )}

        {/* Empty states */}
        {viewLevel === "buildings" && buildings.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Building2 className="h-16 w-16 mb-4" />
            <p className="text-lg font-medium mb-2">Belum ada gedung</p>
            <p className="text-sm mb-4">Buat gedung terlebih dahulu di Master Data → Gedung</p>
            {hasPermission("rooms.create") && (
              <Button onClick={() => navigate("/buildings")}>Kelola Gedung</Button>
            )}
          </div>
        )}

        {viewLevel === "rooms" && activeBuilding && activeBuilding.rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <DoorOpen className="h-16 w-16 mb-4" />
            <p className="text-lg font-medium mb-2">Belum ada ruangan di {activeBuilding.name}</p>
            <p className="text-sm mb-4">
              {editMode
                ? 'Klik "Tambah Ruangan" di toolbar untuk assign ruangan ke gedung ini'
                : "Aktifkan Edit Mode lalu assign ruangan ke gedung ini"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={navigateToBuildings}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              {editMode && (
                <Button onClick={openAssignDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Ruangan
                </Button>
              )}
            </div>
          </div>
        )}

        {viewLevel === "beds" && activeUnitData && activeUnitData.beds.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BedDouble className="h-16 w-16 mb-4" />
            <p className="text-lg font-medium mb-2">Belum ada bed di {activeUnitData.name}</p>
            <p className="text-sm mb-4">Tambah bed melalui halaman Manajemen Ruangan</p>
            <Button variant="outline" onClick={() => navigateToRooms(activeBuildingId!)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </div>
        )}

        {/* SVG Canvas */}
        {hasItems && (
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ touchAction: "none" }}
            onContextMenu={handleCanvasContextMenu}
          >
            {/* Background grid (always visible) */}
            <defs>
              <pattern
                id="grid"
                width={GRID_SIZE * zoom}
                height={GRID_SIZE * zoom}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`}
                  fill="none"
                  stroke={editMode ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)"}
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" className="canvas-bg" />

            {/* Transformed group for zoom & pan */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

              {/* Parent container box — Building outline (shown at rooms level) */}
              {viewLevel === "rooms" && activeBuilding && activeBuilding.width && activeBuilding.height && (() => {
                const bw = activeBuilding.width;
                const bh = activeBuilding.height;
                const bgColor = activeBuilding.color || BUILDING_PALETTE[0];
                return (
                  <g>
                    <rect
                      x={0}
                      y={0}
                      width={bw}
                      height={bh}
                      rx={12}
                      fill={bgColor}
                      fillOpacity={0.25}
                      stroke={bgColor}
                      strokeOpacity={0.5}
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      className="pointer-events-none"
                    />
                    <text
                      x={bw / 2}
                      y={bh / 2}
                      fontSize={Math.min(20, bw / 12)}
                      fontWeight="bold"
                      fill="rgba(0,0,0,0.15)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="select-none pointer-events-none"
                    >
                      {activeBuilding.name}
                    </text>
                  </g>
                );
              })()}

              {/* Parent container box — Unit outline (shown at beds level) */}
              {viewLevel === "beds" && activeUnitData && activeUnitData.width && activeUnitData.height && (() => {
                const uw = activeUnitData.width;
                const uh = activeUnitData.height;
                return (
                  <g>
                    <rect
                      x={0}
                      y={0}
                      width={uw}
                      height={uh}
                      rx={10}
                      fill="#f1f5f9"
                      fillOpacity={0.4}
                      stroke="#94a3b8"
                      strokeOpacity={0.4}
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      className="pointer-events-none"
                    />
                    <text
                      x={uw / 2}
                      y={uh / 2}
                      fontSize={Math.min(16, uw / 12)}
                      fontWeight="bold"
                      fill="rgba(0,0,0,0.12)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="select-none pointer-events-none"
                    >
                      {activeUnitData.name}
                    </text>
                  </g>
                );
              })()}

              {/* ===== LEVEL: Buildings ===== */}
              {viewLevel === "buildings" &&
                autoLayoutItems(buildings, 280, 200, 40).map((building, idx) => (
                  <BuildingCardNode
                    key={building.id}
                    building={building}
                    colorIndex={idx}
                    editMode={editMode}
                    selectedElement={selectedElement}
                    onDragStart={startDrag}
                    onResizeStart={startResize}
                    onClick={handleBuildingClick}
                    onContextMenu={handleBuildingContextMenu}
                  />
                ))}

              {/* ===== LEVEL: Rooms/Units inside selected building ===== */}
              {viewLevel === "rooms" &&
                activeBuilding &&
                autoLayoutItems(unitsOnActiveFloor, 220, 160, 30, 60).map((unit) => (
                  <UnitCardNode
                    key={unit.id}
                    unit={unit}
                    room={unit._room}
                    editMode={editMode}
                    selectedElement={selectedElement}
                    onDragStart={startDrag}
                    onResizeStart={startResize}
                    onClick={handleUnitClick}
                    onUnassign={handleUnassignRoom}
                    onContextMenu={(e) => handleUnitContextMenu(e, unit)}
                  />
                ))}

              {/* ===== LEVEL: Beds inside selected unit ===== */}
              {viewLevel === "beds" &&
                activeUnitData &&
                autoLayoutBeds(activeUnitData.beds).map((bed) => (
                  <BedNode
                    key={bed.id}
                    bed={bed}
                    unit={activeUnitData}
                    editMode={editMode}
                    selectedElement={selectedElement}
                    onDragStart={startDrag}
                    onResizeStart={startResize}
                    onBedClick={handleBedClick}
                    onContextMenu={(e) => handleBedContextMenu(e, bed, activeUnitData)}
                  />
                ))}
            </g>
          </svg>
        )}
      </div>

      {/* ================================================================ */}
      {/* Bed Detail Fullscreen Modal                                      */}
      {/* ================================================================ */}
      {selectedBed && selectedBedUnit && (
        <BedDetailModal
          open={infoPanelOpen}
          onClose={() => setInfoPanelOpen(false)}
          bed={selectedBed}
          unit={selectedBedUnit}
        />
      )}

      {/* ================================================================ */}
      {/* Room Assignment Dialog                                           */}
      {/* ================================================================ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Assign Ruangan ke {activeBuilding?.name}
            </DialogTitle>
            <DialogDescription>
              Pilih ruangan dan lantai tujuan
            </DialogDescription>
          </DialogHeader>

          {/* Floor Selector */}
          {activeBuilding && (activeBuilding.total_floors || 1) > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Lantai Tujuan</label>
              <div className="flex gap-2">
                {Array.from({ length: activeBuilding.total_floors || 1 }, (_, i) => i + 1).map((f) => (
                  <button
                    key={f}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                      assignFloor === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted border-border"
                    )}
                    onClick={() => setAssignFloor(f)}
                  >
                    Lantai {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingRooms ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : availableRooms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DoorOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Semua ruangan sudah di-assign ke gedung</p>
              <p className="text-xs mt-1">Buat ruangan baru di Master Data → Ruangan</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 pr-4">
                {availableRooms.map((room) => (
                  <label
                    key={room.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedRoomIds.includes(room.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      checked={selectedRoomIds.includes(room.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoomIds((prev) => [...prev, room.id]);
                        } else {
                          setSelectedRoomIds((prev) => prev.filter((id) => id !== room.id));
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{room.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {room.code} · {room.service_type} · {room.room_class || room.room_type}
                      </div>
                    </div>
                    {room.has_bed && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {room.total_beds || 0} bed
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleAssignRooms} disabled={selectedRoomIds.length === 0 || assigningRooms}>
              {assigningRooms && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign {selectedRoomIds.length > 0 ? `(${selectedRoomIds.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Properties Panel (Edit mode)                                     */}
      {/* ================================================================ */}
      {editMode && propertiesOpen && selectedItem && (
        <div className="absolute right-4 top-20 w-64 bg-background border rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <Move className="h-3 w-3" />
              Properties
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPropertiesOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase">
              {selectedItem.type === "building"
                ? "Gedung"
                : selectedItem.type === "unit"
                  ? "Kamar"
                  : "Bed"}
            </div>
            <div className="text-sm font-medium">
              {selectedItem.type === "building"
                ? selectedItem.item.name
                : selectedItem.type === "unit"
                  ? selectedItem.item.name
                  : `Bed ${selectedItem.item.bed_number}`}
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">X</Label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={selectedItem.item.position_x}
                  onChange={(e) =>
                    updateItemPosition(
                      selectedItem.type,
                      selectedItem.item.id,
                      Number(e.target.value),
                      selectedItem.item.position_y,
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Y</Label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={selectedItem.item.position_y}
                  onChange={(e) =>
                    updateItemPosition(
                      selectedItem.type,
                      selectedItem.item.id,
                      selectedItem.item.position_x,
                      Number(e.target.value),
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={selectedItem.item.width}
                  onChange={(e) =>
                    updateItemSize(
                      selectedItem.type,
                      selectedItem.item.id,
                      Number(e.target.value),
                      selectedItem.item.height,
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={selectedItem.item.height}
                  onChange={(e) =>
                    updateItemSize(
                      selectedItem.type,
                      selectedItem.item.id,
                      selectedItem.item.width,
                      Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Context Menu Overlay                                              */}
      {/* ================================================================ */}
      {contextMenu && (
        <div
          className="fixed z-[999] min-w-[180px] rounded-lg border bg-white shadow-xl py-1 text-sm animate-in fade-in-0 zoom-in-95"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ---- Building-level context menu ---- */}
          {contextMenu.type === "building" && contextMenu.building && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                🏢 {contextMenu.building.name}
              </div>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  navigateToRooms(contextMenu.building!.id);
                  closeContextMenu();
                }}
              >
                📋 Lihat Ruangan
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  setSelectedElement({ type: "building", id: contextMenu.building!.id });
                  setPropertiesOpen(true);
                  closeContextMenu();
                }}
              >
                ⚙️ Properties
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  navigateToRooms(contextMenu.building!.id);
                  setTimeout(() => openAssignDialog(), 300);
                  closeContextMenu();
                }}
              >
                ➕ Assign Ruangan
              </button>
            </>
          )}

          {/* ---- Unit-level context menu ---- */}
          {contextMenu.type === "unit" && contextMenu.unit && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                🚪 {contextMenu.unit.name}
              </div>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  navigateToBeds(contextMenu.unit!.id);
                  closeContextMenu();
                }}
              >
                🛏️ Lihat Bed
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  setSelectedElement({ type: "unit", id: contextMenu.unit!.id });
                  setPropertiesOpen(true);
                  closeContextMenu();
                }}
              >
                ⚙️ Properties
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-red-600 flex items-center gap-2"
                onClick={() => {
                  handleUnassignRoom(contextMenu.unit!._room.id);
                  closeContextMenu();
                }}
              >
                ✖️ Unassign dari Gedung
              </button>
            </>
          )}

          {/* ---- Bed-level context menu ---- */}
          {contextMenu.type === "bed" && contextMenu.bed && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                🛏️ Bed {contextMenu.bed.bed_number}
              </div>
              {contextMenu.bed.status === "occupied" && contextMenu.bed.current_patient && (
                <>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                    onClick={() => {
                      setSelectedBed(contextMenu.bed!);
                      setSelectedBedUnit(contextMenu.bedUnit!);
                      setInfoPanelOpen(true);
                      closeContextMenu();
                    }}
                  >
                    👤 Info Pasien
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                    onClick={() => {
                      window.open(`/bedside?bed_id=${contextMenu.bed!.id}`, "_blank");
                      closeContextMenu();
                    }}
                  >
                    🏥 Bedside View
                  </button>
                </>
              )}
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  setSelectedElement({ type: "bed", id: contextMenu.bed!.id });
                  setPropertiesOpen(true);
                  closeContextMenu();
                }}
              >
                ⚙️ Properties
              </button>
            </>
          )}

          {/* ---- Canvas context menu ---- */}
          {contextMenu.type === "canvas" && (
            <>
              {viewLevel === "buildings" && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground italic">
                  Drag gedung untuk memindahkan posisi
                </div>
              )}
              {viewLevel === "rooms" && activeBuilding && (
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                  onClick={() => {
                    openAssignDialog();
                    closeContextMenu();
                  }}
                >
                  ➕ Tambah Ruangan ke {activeBuilding.name}
                </button>
              )}
              {viewLevel !== "buildings" && (
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                  onClick={() => {
                    if (viewLevel === "beds") {
                      setViewLevel("rooms");
                      setActiveUnitId(null);
                    } else {
                      setViewLevel("buildings");
                      setActiveBuildingId(null);
                    }
                    closeContextMenu();
                  }}
                >
                  ⬅️ Kembali
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// AUTO-LAYOUT BEDS HELPER
// ===========================================================================

function autoLayoutItems<T extends { position_x: number; position_y: number }>(
  items: T[],
  defaultW: number,
  defaultH: number,
  gap: number,
  offsetY: number = 20,
): T[] {
  if (items.length === 0) return items;
  const allZero = items.every((it) => it.position_x === 0 && it.position_y === 0);
  if (!allZero) return items;

  const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
  return items.map((item, i) => ({
    ...item,
    position_x: 20 + (i % cols) * (defaultW + gap),
    position_y: offsetY + Math.floor(i / cols) * (defaultH + gap),
  }));
}

function autoLayoutBeds(beds: FloorPlanBed[]): FloorPlanBed[] {
  if (beds.length === 0) return beds;
  const allZero = beds.every((b) => b.position_x === 0 && b.position_y === 0);
  if (!allZero) return beds;

  const cols = Math.max(1, Math.ceil(Math.sqrt(beds.length)));
  const bedW = 140;
  const bedH = 90;
  const gap = 20;
  return beds.map((bed, i) => ({
    ...bed,
    position_x: 20 + (i % cols) * (bedW + gap),
    position_y: 20 + Math.floor(i / cols) * (bedH + gap),
    width: bed.width || bedW,
    height: bed.height || bedH,
  }));
}

// ===========================================================================
// BUILDING CARD SVG NODE (Level 1)
// ===========================================================================

interface BuildingCardNodeProps {
  building: FloorPlanBuilding;
  colorIndex: number;
  editMode: boolean;
  selectedElement: { type: string; id: number } | null;
  onDragStart: (type: string, id: number, x: number, y: number, e: React.MouseEvent) => void;
  onResizeStart: (type: string, id: number, w: number, h: number, e: React.MouseEvent) => void;
  onClick: (building: FloorPlanBuilding) => void;
  onContextMenu?: (e: React.MouseEvent, building: FloorPlanBuilding) => void;
}

function BuildingCardNode({
  building,
  colorIndex,
  editMode,
  selectedElement,
  onDragStart,
  onResizeStart,
  onClick,
  onContextMenu,
}: BuildingCardNodeProps) {
  const isSelected = selectedElement?.type === "building" && selectedElement?.id === building.id;
  const bgColor = building.color || BUILDING_PALETTE[colorIndex % BUILDING_PALETTE.length];
  const w = building.width || 280;
  const h = building.height || 200;

  const allUnits = building.rooms.flatMap((r) => r.units);

  return (
    <g transform={`translate(${building.position_x}, ${building.position_y})`}>
      {/* Shadow */}
      <rect x={3} y={3} width={w} height={h} rx={10} fill="rgba(0,0,0,0.08)" />

      {/* Background */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={10}
        fill={bgColor}
        stroke={isSelected ? "#2563eb" : "rgba(0,0,0,0.15)"}
        strokeWidth={isSelected ? 2.5 : 1}
        className={cn(editMode ? "cursor-move" : "cursor-pointer")}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (editMode) {
            onDragStart("building", building.id, building.position_x, building.position_y, e);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(building);
        }}
        onContextMenu={(e) => {
          if (onContextMenu) onContextMenu(e, building);
        }}
      />

      {/* Centered building name */}
      <text
        x={w / 2}
        y={h / 2}
        fontSize={Math.min(18, w / 10)}
        fontWeight="bold"
        fill="rgba(0,0,0,0.25)"
        textAnchor="middle"
        dominantBaseline="middle"
        className="select-none pointer-events-none"
      >
        {building.name}
      </text>

      {/* Unit silhouettes at exact same positions as rooms view (1:1) */}
      {allUnits.length > 0 && (() => {
        const laid = autoLayoutItems(allUnits, 220, 160, 30, 60);
        return (
          <g className="pointer-events-none">
            {laid.map((u) => {
              const uw = u.width || 220;
              const uh = u.height || 160;
              return (
                <g key={u.id} transform={`translate(${u.position_x}, ${u.position_y})`}>
                  <rect
                    x={0}
                    y={0}
                    width={uw}
                    height={uh}
                    rx={6}
                    fill="rgba(255,255,255,0.5)"
                    stroke="rgba(0,0,0,0.12)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={uw / 2}
                    y={uh / 2}
                    fontSize={Math.min(12, uw / 12)}
                    fill="rgba(0,0,0,0.18)"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none"
                  >
                    {u.name}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Resize handle (edit mode) */}
      {editMode && isSelected && (
        <rect
          x={w - 12}
          y={h - 12}
          width={14}
          height={14}
          rx={2}
          fill="#2563eb"
          stroke="white"
          strokeWidth={1}
          className="cursor-se-resize"
          onMouseDown={(e) => onResizeStart("building", building.id, w, h, e)}
        />
      )}
    </g>
  );
}

// ===========================================================================
// UNIT CARD SVG NODE (Level 2 — Rooms level)
// ===========================================================================

interface UnitCardNodeProps {
  unit: FloorPlanUnit;
  room: FloorPlanRoom;
  editMode: boolean;
  selectedElement: { type: string; id: number } | null;
  onDragStart: (type: string, id: number, x: number, y: number, e: React.MouseEvent) => void;
  onResizeStart: (type: string, id: number, w: number, h: number, e: React.MouseEvent) => void;
  onClick: (unit: FloorPlanUnit) => void;
  onUnassign: (roomId: number) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function UnitCardNode({
  unit,
  room,
  editMode,
  selectedElement,
  onDragStart,
  onResizeStart,
  onClick,
  onUnassign,
  onContextMenu,
}: UnitCardNodeProps) {
  const isSelected = selectedElement?.type === "unit" && selectedElement?.id === unit.id;
  const w = unit.width || 220;
  const h = unit.height || 160;

  const beds = unit.beds || [];

  return (
    <g transform={`translate(${unit.position_x}, ${unit.position_y})`}>
      {/* Shadow */}
      <rect x={2} y={2} width={w} height={h} rx={8} fill="rgba(0,0,0,0.06)" />

      {/* Background */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={8}
        fill="white"
        stroke={isSelected ? "#2563eb" : "#d1d5db"}
        strokeWidth={isSelected ? 2 : 1}
        className={cn(editMode ? "cursor-move" : "cursor-pointer")}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (editMode) {
            onDragStart("unit", unit.id, unit.position_x, unit.position_y, e);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(unit);
        }}
        onContextMenu={(e) => {
          if (onContextMenu) onContextMenu(e);
        }}
      />

      {/* Centered unit name */}
      <text
        x={w / 2}
        y={h / 2}
        fontSize={Math.min(14, w / 10)}
        fontWeight="bold"
        fill="rgba(0,0,0,0.2)"
        textAnchor="middle"
        dominantBaseline="middle"
        className="select-none pointer-events-none"
      >
        {unit.name}
      </text>

      {/* Bed silhouettes at exact same positions as beds view (1:1) */}
      {beds.length > 0 && (() => {
        const laid = autoLayoutBeds(beds);
        return (
          <g className="pointer-events-none">
            {laid.map((b) => {
              const bw2 = b.width || 140;
              const bh2 = b.height || 90;
              const colors = BED_STATUS_COLORS[b.status] || DEFAULT_BED_COLOR;
              return (
                <g key={b.id} transform={`translate(${b.position_x}, ${b.position_y})`}>
                  <rect
                    x={0}
                    y={0}
                    width={bw2}
                    height={bh2}
                    rx={4}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={0.5}
                  />
                  <text
                    x={bw2 / 2}
                    y={bh2 / 2}
                    fontSize={Math.min(10, bw2 / 10)}
                    fill={colors.text}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none"
                  >
                    {b.bed_number}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* Unassign button (edit mode + selected) */}
      {editMode && isSelected && (
        <g
          transform={`translate(${w - 24}, 4)`}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onUnassign(room.id);
          }}
        >
          <rect x={0} y={0} width={20} height={20} rx={4} fill="#fee2e2" stroke="#fca5a5" strokeWidth={0.5} />
          <line x1={5} y1={5} x2={15} y2={15} stroke="#dc2626" strokeWidth={1.5} />
          <line x1={15} y1={5} x2={5} y2={15} stroke="#dc2626" strokeWidth={1.5} />
        </g>
      )}

      {/* Resize handle (edit mode) */}
      {editMode && isSelected && (
        <rect
          x={w - 10}
          y={h - 10}
          width={12}
          height={12}
          rx={2}
          fill="#2563eb"
          stroke="white"
          strokeWidth={1}
          className="cursor-se-resize"
          onMouseDown={(e) => onResizeStart("unit", unit.id, w, h, e)}
        />
      )}
    </g>
  );
}

// ===========================================================================
// BED SVG NODE (Level 3)
// ===========================================================================

interface BedNodeProps {
  bed: FloorPlanBed;
  unit: FloorPlanUnit;
  editMode: boolean;
  selectedElement: { type: string; id: number } | null;
  onDragStart: (type: string, id: number, x: number, y: number, e: React.MouseEvent) => void;
  onResizeStart: (type: string, id: number, w: number, h: number, e: React.MouseEvent) => void;
  onBedClick: (bed: FloorPlanBed, unit: FloorPlanUnit) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function BedNode({
  bed,
  unit,
  editMode,
  selectedElement,
  onDragStart,
  onResizeStart,
  onBedClick,
  onContextMenu,
}: BedNodeProps) {
  const isSelected = selectedElement?.type === "bed" && selectedElement?.id === bed.id;
  const colors = BED_STATUS_COLORS[bed.status] || DEFAULT_BED_COLOR;
  const patient = bed.current_patient;
  const bedW = bed.width || 140;
  const bedH = bed.height || 90;

  return (
    <g
      transform={`translate(${bed.position_x}, ${bed.position_y})`}
      className={cn(
        "transition-opacity",
        !editMode && bed.status === "occupied" && "cursor-pointer",
        editMode && "cursor-move",
      )}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (editMode) {
          onDragStart("bed", bed.id, bed.position_x, bed.position_y, e);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onBedClick(bed, unit);
      }}
      onContextMenu={(e) => {
        if (onContextMenu) onContextMenu(e);
      }}
    >
      {/* Shadow for occupied */}
      {patient && <rect x={2} y={2} width={bedW} height={bedH} rx={6} fill="rgba(0,0,0,0.06)" />}

      {/* Bed rect */}
      <rect
        x={0}
        y={0}
        width={bedW}
        height={bedH}
        rx={6}
        fill={colors.fill}
        stroke={isSelected ? "#2563eb" : colors.stroke}
        strokeWidth={isSelected ? 2.5 : 1}
      />

      {/* Bed number centered */}
      <text
        x={bedW / 2}
        y={bedH / 2}
        fontSize={Math.min(14, bedW / 8)}
        fontWeight="bold"
        fill={colors.text}
        textAnchor="middle"
        dominantBaseline="middle"
        className="select-none pointer-events-none"
      >
        {bed.bed_number}
      </text>

      {/* Status for non-occupied non-available */}
      {!patient && bed.status !== "available" && (
        <text
          x={bedW / 2}
          y={bedH / 2 + 14}
          fontSize={9}
          fill={colors.text}
          textAnchor="middle"
          className="select-none pointer-events-none"
        >
          {colors.label}
        </text>
      )}

      {/* Resize handle (edit mode) */}
      {editMode && isSelected && (
        <rect
          x={bedW - 8}
          y={bedH - 8}
          width={10}
          height={10}
          rx={1}
          fill="#2563eb"
          stroke="white"
          strokeWidth={1}
          className="cursor-se-resize"
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart("bed", bed.id, bedW, bedH, e);
          }}
        />
      )}
    </g>
  );
}
