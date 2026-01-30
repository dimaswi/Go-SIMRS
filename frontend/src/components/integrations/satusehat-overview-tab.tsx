import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, Stethoscope, MapPin, Building2, CheckCircle, ChevronRight } from "lucide-react";
import type { SatuSehatReadinessResponse } from "@/lib/api/integrations";

interface OverviewTabProps {
  readiness: SatuSehatReadinessResponse | null;
  onChangeTab: (tab: string) => void;
}

export function OverviewTab({ readiness, onChangeTab }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Patients Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Pasien
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readiness?.patients.with_ihs || 0} / {readiness?.patients.total || 0}
            </div>
            <Progress
              value={readiness?.patients.total ? (readiness.patients.with_ihs / readiness.patients.total) * 100 : 0}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sudah memiliki IHS Number
            </p>
          </CardContent>
        </Card>

        {/* Practitioners Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-green-500" />
              Karyawan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readiness?.practitioners.with_ihs || 0} / {readiness?.practitioners.total || 0}
            </div>
            <Progress
              value={readiness?.practitioners.total ? (readiness.practitioners.with_ihs / readiness.practitioners.total) * 100 : 0}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sudah memiliki IHS Number
            </p>
          </CardContent>
        </Card>

        {/* Locations Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              Lokasi/Ruangan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readiness?.locations.with_satusehat || 0} / {readiness?.locations.total || 0}
            </div>
            <Progress
              value={readiness?.locations.total ? (readiness.locations.with_satusehat / readiness.locations.total) * 100 : 0}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sudah dikirim ke SatuSehat
            </p>
          </CardContent>
        </Card>

        {/* Encounters Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" />
              Encounter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {readiness?.encounters.sent || 0} / {readiness?.encounters.total_completed || 0}
            </div>
            <Progress
              value={readiness?.encounters.total_completed ? (readiness.encounters.sent / readiness.encounters.total_completed) * 100 : 0}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {readiness?.encounters.pending || 0} menunggu dikirim
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Steps Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Langkah Pengiriman Data</CardTitle>
          <CardDescription>Ikuti urutan berikut untuk mengirim data ke SatuSehat</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${readiness?.patients.ready ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                {readiness?.patients.ready ? <CheckCircle className="h-4 w-4" /> : '1'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Lookup IHS Number Pasien</p>
                <p className="text-sm text-muted-foreground">Cari ID pasien di SatuSehat berdasarkan NIK</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onChangeTab("patients")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${readiness?.practitioners.ready ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                {readiness?.practitioners.ready ? <CheckCircle className="h-4 w-4" /> : '2'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Lookup IHS Number Karyawan</p>
                <p className="text-sm text-muted-foreground">Cari ID practitioner di SatuSehat berdasarkan NIK</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onChangeTab("practitioners")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${readiness?.locations.ready ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                {readiness?.locations.ready ? <CheckCircle className="h-4 w-4" /> : '3'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Kirim Data Lokasi/Ruangan</p>
                <p className="text-sm text-muted-foreground">Daftarkan ruangan faskes ke SatuSehat</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onChangeTab("locations")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${(readiness?.encounters.sent || 0) > 0 ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                {(readiness?.encounters.sent || 0) > 0 ? <CheckCircle className="h-4 w-4" /> : '4'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Kirim Encounter (Kunjungan)</p>
                <p className="text-sm text-muted-foreground">Kirim data kunjungan pasien yang sudah selesai</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onChangeTab("encounters")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
