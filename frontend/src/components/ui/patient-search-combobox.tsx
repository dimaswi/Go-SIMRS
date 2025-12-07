"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { patientsApi, type Patient } from "@/lib/api"

interface PatientSearchComboboxProps {
  value?: Patient | null
  onValueChange?: (patient: Patient | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function PatientSearchCombobox({
  value,
  onValueChange,
  placeholder = "Cari pasien (Nama, NIK, atau No. RM)...",
  disabled = false,
  className,
}: PatientSearchComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [patients, setPatients] = React.useState<Patient[]>([])
  const [loading, setLoading] = React.useState(false)

  // Calculate age from birth date
  const calculateAge = (birthDate: string | undefined) => {
    if (!birthDate) return "-"
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return `${age} th`
  }

  // Search patients with debounce
  React.useEffect(() => {
    if (!search || search.length < 2) {
      setPatients([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        console.log("Searching for:", search)
        const response = await patientsApi.search(search, 20)
        console.log("Search response:", response)
        const data = response.data?.data || response.data || []
        console.log("Patients found:", data)
        setPatients(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Failed to search patients:", error)
        setPatients([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-[2.5rem] text-sm",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? (
            <div className="flex items-center gap-2 text-left w-full">
              <User className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{value.nama_lengkap}</div>
                <div className="text-xs text-muted-foreground">
                  {value.no_rm} • {value.nik || "NIK -"}
                </div>
              </div>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Ketik nama, NIK, atau No. RM..." 
            value={search}
            onValueChange={setSearch}
            className="h-9" 
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {!loading && search.length < 2 && (
              <CommandEmpty>Ketik minimal 2 karakter untuk mencari...</CommandEmpty>
            )}
            
            {!loading && search.length >= 2 && patients.length === 0 && (
              <CommandEmpty>Pasien tidak ditemukan.</CommandEmpty>
            )}
            
            {!loading && patients.length > 0 && (
              <CommandGroup>
                {patients.map((patient) => (
                  <CommandItem
                    key={patient.id}
                    value={patient.id.toString()}
                    onSelect={() => {
                      onValueChange?.(patient)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="py-3"
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{patient.nama_lengkap}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">
                            {patient.jenis_kelamin === "L" ? "Laki-Laki" : "Perempuan"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">No. RM:</span> {patient.no_rm}
                          </div>
                          <div>
                            <span className="font-medium">NIK:</span> {patient.nik || "-"}
                          </div>
                          <div>
                            <span className="font-medium">Usia:</span> {calculateAge(patient.tanggal_lahir)}
                          </div>
                          <div>
                            <span className="font-medium">Tempat Lahir:</span> {patient.tempat_lahir || "-"}
                          </div>
                          {patient.nama_ibu && (
                            <div className="col-span-2">
                              <span className="font-medium">Ibu:</span> {patient.nama_ibu}
                            </div>
                          )}
                          {patient.nama_ayah && (
                            <div className="col-span-2">
                              <span className="font-medium">Ayah:</span> {patient.nama_ayah}
                            </div>
                          )}
                          {patient.alamat_domisili && (
                            <div className="col-span-2 truncate">
                              <span className="font-medium">Alamat:</span> {patient.alamat_domisili}
                            </div>
                          )}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value?.id === patient.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
