import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { Visit } from "@/lib/api/visits";
import type { SickLetter } from "@/lib/api/medical-records";

interface SickLetterPreviewProps {
  visit: Visit;
  data: SickLetter;
}

export function SickLetterPreview({ visit, data }: SickLetterPreviewProps) {
  if (!data) return <div className="text-center p-10 text-muted-foreground">Data surat tidak ditemukan.</div>;

  const patient = visit.registration?.Patient;
  const doctor = visit.doctor;

  const calculateAge = (dob?: string) => {
    if (!dob) return "-";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} Tahun`;
  };

  return (
    <div className="font-serif text-sm">
      <div className="text-center font-bold underline text-lg mb-6">
        SURAT KETERANGAN SAKIT
      </div>
      <div className="text-center mb-8">
        Nomor: {data.letter_number || ".........................../......./20..."}
      </div>

      <div className="mb-4">
        Yang bertanda tangan di bawah ini, menerangkan bahwa:
      </div>

      <table className="w-full mb-6 ml-4">
        <tbody>
          <tr>
            <td className="w-40 py-1">Nama</td>
            <td className="w-4 py-1">:</td>
            <td className="font-bold">{patient?.name || "-"}</td>
          </tr>
          <tr>
            <td className="py-1">Umur / Jenis Kelamin</td>
            <td className="py-1">:</td>
            <td>
              {calculateAge(patient?.date_of_birth)} /{" "}
              {patient?.gender === "L" ? "Laki-laki" : patient?.gender === "P" ? "Perempuan" : "-"}
            </td>
          </tr>
          <tr>
            <td className="py-1">Pekerjaan</td>
            <td className="py-1">:</td>
            <td>{patient?.occupation || "-"}</td>
          </tr>
          <tr>
            <td className="py-1 align-top">Alamat</td>
            <td className="py-1 align-top">:</td>
            <td>{patient?.address || "-"}</td>
          </tr>
        </tbody>
      </table>

      <div className="mb-4 leading-relaxed">
        Dalam keadaan sakit dan perlu istirahat selama <b>{data.days}</b> hari, 
        terhitung mulai tanggal <b>{data.start_date ? format(new Date(data.start_date), "dd MMMM yyyy", { locale: id }) : "-"}</b> s/d 
        tanggal <b>{data.end_date ? format(new Date(data.end_date), "dd MMMM yyyy", { locale: id }) : "-"}</b>.
      </div>

      {data.purpose && (
        <div className="mb-8">
          Surat keterangan ini diberikan untuk keperluan: {data.purpose}
        </div>
      )}

      <div className="mb-8">
        Harap yang berkepentingan maklum.
      </div>

      {/* Signature Area */}
      <div className="flex justify-end mt-12 text-center">
        <div className="w-64">
          <p className="mb-1">Kedungadem, {format(new Date(), "dd MMMM yyyy", { locale: id })}</p>
          <p className="mb-20">Dokter Pemeriksa</p>
          
          <div className="border-b border-black w-48 mx-auto relative pb-1">
            {/* Signature overlay will be placed by parent DocumentPreviewTab */}
            <div id="signature-anchor-doctor" className="absolute bottom-1 left-0 w-full h-16 pointer-events-none" />
            ( {doctor?.name || "...................................."} )
          </div>
        </div>
      </div>
    </div>
  );
}
