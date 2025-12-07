import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  registrationApi,
  queueApi,
  type Queue,
  paymentMethodLabels,
  registrationTypeLabels,
  queueTypeLabels,
} from "@/lib/api/queue";
import { api } from "@/lib/api/client";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  Check,
  ChevronsUpDown,
  User,
  Calendar,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Room {
  id: number;
  code: string;
  name: string;
}

interface Patient {
  id: number;
  name: string;
  medical_record_number: string;
  nik?: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  address?: string;
  bpjs_number?: string;
  insurance_name?: string;
  insurance_number?: string;
}

interface Doctor {
  id: number;
  name: string;
  specialization?: string;
}

const formSchema = z.object({
  patient_id: z.number().min(1, "Pasien wajib dipilih"),
  registration_type: z.enum(["outpatient", "pharmacy", "radiology", "laboratory", "emergency"]),
  destination_room_id: z.number().min(1, "Poli tujuan wajib dipilih"),
  doctor_id: z.number().optional(),
  payment_method: z.enum(["cash", "bpjs", "insurance"]),
  bpjs_number: z.string().optional(),
  insurance_name: z.string().optional(),
  insurance_number: z.string().optional(),
  complaint: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function RegistrationCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queueIdParam = searchParams.get("queue_id");
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Patient search
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: 0,
      registration_type: "outpatient",
      destination_room_id: 0,
      payment_method: "cash",
      bpjs_number: "",
      insurance_name: "",
      insurance_number: "",
      complaint: "",
      notes: "",
    },
  });

  const watchPaymentMethod = form.watch("payment_method");
  const watchRegistrationType = form.watch("registration_type");
  const watchDestinationRoomId = form.watch("destination_room_id");

  // Watch for payment method changes and auto-fill if patient data exists
  useEffect(() => {
    if (selectedPatient) {
      if (watchPaymentMethod === "bpjs" && selectedPatient.bpjs_number) {
        form.setValue("bpjs_number", selectedPatient.bpjs_number);
      } else if (watchPaymentMethod === "insurance") {
        if (selectedPatient.insurance_name) {
          form.setValue("insurance_name", selectedPatient.insurance_name);
        }
        if (selectedPatient.insurance_number) {
          form.setValue("insurance_number", selectedPatient.insurance_number);
        }
      }
    }
  }, [watchPaymentMethod, selectedPatient, form]);

  // Load queue if queue_id is provided
  const loadQueue = useCallback(async () => {
    if (!queueIdParam) return;
    setLoadingQueue(true);
    try {
      const response = await queueApi.getById(parseInt(queueIdParam));
      const queueData = response.data.data;
      setQueue(queueData);

      // Set payment method based on queue type
      if (queueData.queue_type === "bpjs") {
        form.setValue("payment_method", "bpjs");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data antrean.",
      });
    } finally {
      setLoadingQueue(false);
    }
  }, [queueIdParam, form, toast]);

  // Load rooms
  const loadRooms = useCallback(async () => {
    try {
      const response = await api.get("/rooms", {
        params: { limit: 100 },
      });
      // Filter untuk pendaftaran: rawat jalan, gawat darurat (UGD), penunjang medis, dan farmasi
      // Exclude: rawat inap dan depo farmasi
      const filteredRooms = (response.data.data || []).filter(
        (room: Room & { service_type?: string; room_type?: string }) => 
          room.service_type && 
          ['rawat_jalan', 'gawat_darurat', 'penunjang_medis', 'farmasi'].includes(room.service_type) &&
          room.room_type !== 'depo_farmasi' // Exclude depo farmasi
      );
      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data ruangan",
      });
    }
  }, [toast]);

  // Filter rooms based on registration type
  const getFilteredRooms = useCallback(() => {
    const registrationType = watchRegistrationType;
    
    if (!registrationType || !rooms.length) return rooms;
    
    return rooms.filter((room: Room & { service_type?: string; room_type?: string }) => {
      switch (registrationType) {
        case 'outpatient':
          // Rawat jalan: hanya ruangan dengan service_type rawat_jalan
          return room.service_type === 'rawat_jalan';
        case 'pharmacy':
          // Farmasi: hanya ruangan dengan service_type farmasi (exclude depo_farmasi)
          return room.service_type === 'farmasi' && room.room_type !== 'depo_farmasi';
        case 'radiology':
          // Radiologi: ruangan penunjang medis dengan room_type radiologi, ct_scan, mri, usg
          return room.service_type === 'penunjang_medis' && 
                 ['radiologi', 'ct_scan', 'mri', 'usg'].includes(room.room_type || '');
        case 'laboratory':
          // Laboratorium: ruangan penunjang medis dengan room_type laboratorium
          return room.service_type === 'penunjang_medis' && 
                 ['laboratorium', 'laboratorium_pk', 'laboratorium_pa'].includes(room.room_type || '');
        case 'emergency':
          // UGD: hanya ruangan dengan service_type gawat_darurat
          return room.service_type === 'gawat_darurat';
        default:
          return true;
      }
    });
  }, [rooms, watchRegistrationType]);

  // Load doctors
  const loadDoctors = useCallback(async (roomId?: number) => {
    if (!roomId) {
      setDoctors([]);
      return;
    }
    
    try {
      // Get room staff (doctors assigned to the selected room)
      const response = await api.get(`/rooms/${roomId}/staff`);
      const roomStaff = response.data.data || [];
      
      // Filter only doctors (tipe_karyawan = 'dokter')
      const doctorsInRoom = roomStaff
        .filter((staff: any) => staff.employee?.tipe_karyawan === 'dokter')
        .map((staff: any) => ({
          id: staff.employee.id,
          name: staff.employee.nama_lengkap,
          specialization: staff.employee.spesialisasi || staff.role,
        }));
      
      setDoctors(doctorsInRoom);
    } catch (error) {
      console.error("Failed to load doctors:", error);
      setDoctors([]);
    }
  }, []);

  // Search patients
  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPatients([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const response = await registrationApi.searchPatient(query);
      setPatients(response.data.data || []);
    } catch (error) {
      console.error("Failed to search patients:", error);
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  useEffect(() => {
    setPageTitle("Pendaftaran Baru");
    loadRooms();
    loadQueue();
  }, [loadRooms, loadQueue]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (patientSearch) {
        searchPatients(patientSearch);
      }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [patientSearch, searchPatients]);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    form.setValue("patient_id", patient.id);
    setPatientPopoverOpen(false);
    setPatientSearch("");
    
    // Auto-load payment data based on current payment method
    const currentPaymentMethod = form.getValues("payment_method");
    if (currentPaymentMethod === "bpjs" && patient.bpjs_number) {
      form.setValue("bpjs_number", patient.bpjs_number);
    } else if (currentPaymentMethod === "insurance") {
      if (patient.insurance_name) {
        form.setValue("insurance_name", patient.insurance_name);
      }
      if (patient.insurance_number) {
        form.setValue("insurance_number", patient.insurance_number);
      }
    }
  };

  // Reset destination room when registration type changes
  useEffect(() => {
    // Reset room selection when registration type changes
    form.setValue("destination_room_id", 0);
  }, [watchRegistrationType, form]);

  // Load doctors when room changes
  useEffect(() => {
    if (watchDestinationRoomId && watchDestinationRoomId > 0) {
      loadDoctors(watchDestinationRoomId);
      // Reset doctor selection when room changes
      form.setValue("doctor_id", undefined);
    } else {
      setDoctors([]);
      form.setValue("doctor_id", undefined);
    }
  }, [watchDestinationRoomId, loadDoctors, form]);

  const onSubmit = async (values: FormValues) => {
    // Validate BPJS number
    if (values.payment_method === "bpjs" && !values.bpjs_number) {
      form.setError("bpjs_number", { message: "Nomor BPJS wajib diisi" });
      return;
    }
    // Validate insurance
    if (values.payment_method === "insurance" && (!values.insurance_name || !values.insurance_number)) {
      if (!values.insurance_name) {
        form.setError("insurance_name", { message: "Nama asuransi wajib diisi" });
      }
      if (!values.insurance_number) {
        form.setError("insurance_number", { message: "Nomor polis wajib diisi" });
      }
      return;
    }

    setSubmitting(true);
    try {
      // Determine if room queue should be created
      // UGD/Emergency patients do NOT get room queue numbers
      // Other patients (rawat jalan, farmasi, radiologi, laboratorium) DO get room queue numbers
      const isEmergency = values.registration_type === "emergency";
      
      // Create registration with visit and room queue
      const payload: any = {
        patient_id: values.patient_id,
        registration_type: values.registration_type,
        destination_room_id: values.destination_room_id,
        doctor_id: values.doctor_id,
        payment_method: values.payment_method,
        bpjs_number: values.bpjs_number,
        insurance_name: values.insurance_name,
        insurance_number: values.insurance_number,
        complaint: values.complaint,
        notes: values.notes,
        // Auto-create visit for direct registration (without queue)
        create_visit: true,
        // Only create room queue for non-emergency patients
        create_room_queue: !isEmergency,
        // Set priority based on registration type
        queue_priority: isEmergency ? "emergency" : "normal",
      };
      
      // Only add queue_id if coming from queue flow
      if (queueIdParam) {
        payload.queue_id = parseInt(queueIdParam);
      }
      
      const response = await registrationApi.create(payload);
      const registration = response.data.data;
      
      // Get room queue number from response (if exists)
      const regData = registration as any;
      let roomQueueNumber = null;
      const visit = regData.visits?.[0] || regData.visit;
      if (visit?.room_queue?.queue_number) {
        roomQueueNumber = visit.room_queue.queue_number;
      }

      toast({
        title: "Pendaftaran Berhasil!",
        description: (
          <div className="space-y-1">
            <p className="font-semibold">
              {isEmergency ? "Pasien UGD" : "Pasien"}: {selectedPatient?.name}
            </p>
            <p>No. RM: {selectedPatient?.medical_record_number}</p>
            <p>Ruangan: {rooms.find(r => r.id === values.destination_room_id)?.name}</p>
            {roomQueueNumber && (
              <p className="text-lg font-bold">Nomor Antrian Ruangan: {roomQueueNumber}</p>
            )}
            {isEmergency && (
              <p className="text-sm text-muted-foreground italic">
                Pasien UGD langsung ditangani tanpa nomor antrian
              </p>
            )}
          </div>
        ),
        duration: 10000,
      });

      navigate("/registrations");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membuat pendaftaran.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md max-w-full mx-auto w-full">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(queueIdParam ? "/queues" : "/registrations")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Pendaftaran Pasien
              </CardTitle>
              <CardDescription>
                {queue
                  ? `Dari antrean ${queue.queue_number}`
                  : "Pendaftaran langsung (tanpa antrean)"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loadingQueue ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Queue Info */}
                {queue && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">No. Antrean</p>
                        <p className="text-2xl font-bold">{queue.queue_number}</p>
                      </div>
                      <Badge>{queueTypeLabels[queue.queue_type]}</Badge>
                    </div>
                  </div>
                )}

                {/* Patient Selection */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Data Pasien</h3>
                  
                  <FormField
                    control={form.control}
                    name="patient_id"
                    render={() => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-base">Cari Pasien</FormLabel>
                        <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full h-11 justify-between",
                                  !selectedPatient && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">
                                  {selectedPatient
                                    ? `${selectedPatient.name} (${selectedPatient.medical_record_number})`
                                    : "Cari pasien..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Ketik nama, nomor rekam medis, atau NIK..."
                                value={patientSearch}
                                onValueChange={setPatientSearch}
                              />
                              <CommandList>
                                {searchingPatients ? (
                                  <div className="p-8 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Mencari pasien...</p>
                                  </div>
                                ) : patients.length === 0 ? (
                                  <CommandEmpty>
                                    <div className="p-4 text-center">
                                      {patientSearch.length < 2
                                        ? "Ketik minimal 2 karakter untuk mencari..."
                                        : "Pasien tidak ditemukan. Periksa kembali kata kunci pencarian."}
                                    </div>
                                  </CommandEmpty>
                                ) : (
                                  <CommandGroup heading="Hasil Pencarian">
                                    {patients.map((patient) => (
                                      <CommandItem
                                        key={patient.id}
                                        value={patient.id.toString()}
                                        onSelect={() => handleSelectPatient(patient)}
                                        className="py-3"
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedPatient?.id === patient.id
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">{patient.name}</div>
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            No. RM: {patient.medical_record_number}
                                            {patient.nik && ` • NIK: ${patient.nik}`}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Selected Patient Info */}
                  {selectedPatient && (
                    <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg border border-green-200 dark:border-green-800 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                            <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-base">{selectedPatient.name}</p>
                            <p className="text-sm text-muted-foreground">No. RM: {selectedPatient.medical_record_number}</p>
                          </div>
                        </div>
                        {selectedPatient.gender && (
                          <Badge variant="outline" className="bg-white dark:bg-gray-900">
                            {selectedPatient.gender === "male" ? "Laki-laki" : "Perempuan"}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-green-200 dark:border-green-800">
                        {selectedPatient.date_of_birth && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{formatDate(selectedPatient.date_of_birth)}</span>
                          </div>
                        )}
                        {selectedPatient.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedPatient.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Registration Details */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Detail Pendaftaran</h3>

                  <FormField
                    control={form.control}
                    name="registration_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Jenis Kunjungan</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full h-11">
                              <SelectValue placeholder="Pilih jenis kunjungan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="outpatient">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{registrationTypeLabels.outpatient}</span>
                                <span className="text-xs text-muted-foreground">Pasien berobat jalan, mendapat nomor antrian</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="pharmacy">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{registrationTypeLabels.pharmacy || 'Farmasi'}</span>
                                <span className="text-xs text-muted-foreground">Pasien ke farmasi, mendapat nomor antrian</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="radiology">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{registrationTypeLabels.radiology || 'Radiologi'}</span>
                                <span className="text-xs text-muted-foreground">Pasien ke radiologi, mendapat nomor antrian</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="laboratory">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{registrationTypeLabels.laboratory || 'Laboratorium'}</span>
                                <span className="text-xs text-muted-foreground">Pasien ke laboratorium, mendapat nomor antrian</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="emergency">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{registrationTypeLabels.emergency}</span>
                                <span className="text-xs text-muted-foreground">Pasien gawat darurat, langsung ditangani</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination_room_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-base">Ruangan Tujuan</FormLabel>
                        <Popover open={roomPopoverOpen} onOpenChange={setRoomPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full h-11 justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">
                                  {field.value
                                    ? rooms.find((room) => room.id === field.value)?.name
                                    : "Pilih ruangan tujuan"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Cari ruangan..." />
                              <CommandList>
                                <CommandEmpty>Ruangan tidak ditemukan.</CommandEmpty>
                                <CommandGroup>
                                  {getFilteredRooms().map((room) => (
                                    <CommandItem
                                      key={room.id}
                                      value={`${room.code} ${room.name}`}
                                      onSelect={() => {
                                        field.onChange(room.id);
                                        setRoomPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          room.id === field.value
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{room.name}</span>
                                        <span className="text-xs text-muted-foreground">Kode: {room.code}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="doctor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">
                          Dokter <span className="text-xs text-muted-foreground font-normal">(Opsional)</span>
                        </FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)}
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full h-11">
                              <SelectValue placeholder="Pilih dokter jika sudah ditentukan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">
                              <span className="text-muted-foreground">Belum ditentukan</span>
                            </SelectItem>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id.toString()}>
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{doctor.name}</span>
                                  {doctor.specialization && (
                                    <span className="text-xs text-muted-foreground">{doctor.specialization}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complaint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Keluhan Utama</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tuliskan keluhan utama pasien..."
                            className="w-full min-h-[100px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Payment Details */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Informasi Pembayaran</h3>

                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Metode Pembayaran</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full h-11">
                              <SelectValue placeholder="Pilih metode pembayaran" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{paymentMethodLabels.cash}</span>
                                <span className="text-xs text-muted-foreground">Pembayaran tunai/mandiri</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="bpjs">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{paymentMethodLabels.bpjs}</span>
                                <span className="text-xs text-muted-foreground">BPJS Kesehatan</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="insurance">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{paymentMethodLabels.insurance}</span>
                                <span className="text-xs text-muted-foreground">Asuransi swasta</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchPaymentMethod === "bpjs" && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <FormField
                        control={form.control}
                        name="bpjs_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Nomor Kartu BPJS</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Masukkan 13 digit nomor BPJS" 
                                className="w-full h-11"
                                maxLength={13}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {watchPaymentMethod === "insurance" && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800 space-y-4">
                      <FormField
                        control={form.control}
                        name="insurance_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Nama Perusahaan Asuransi</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Contoh: Allianz, Prudential, AXA" 
                                className="w-full h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="insurance_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Nomor Polis Asuransi</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Masukkan nomor polis asuransi" 
                                className="w-full h-11"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        Catatan Tambahan <span className="text-xs text-muted-foreground font-normal">(Opsional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Catatan atau informasi tambahan yang perlu disampaikan..."
                          className="w-full min-h-[80px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(queueIdParam ? "/queues" : "/registrations")}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Daftarkan
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
