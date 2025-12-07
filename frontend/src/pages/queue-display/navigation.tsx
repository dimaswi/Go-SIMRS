import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { counterApi, type Counter } from "@/lib/api/counters";
import { settingsApi } from "@/lib/api";
import { Monitor, Tv, ArrowRight, Loader2 } from "lucide-react";

export default function QueueDisplayNavigation() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalName, setHospitalName] = useState("RUMAH SAKIT");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const settings = response.data.data;
        if (settings.app_name) {
          setHospitalName(settings.app_name);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();

    const loadCounters = async () => {
      try {
        const data = await counterApi.getActiveCounters();
        setCounters(data);
      } catch (error) {
        console.error("Failed to load counters:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCounters();
  }, []);

  const openMainDisplay = () => {
    window.open("/queue-display/main", "_blank");
  };

  const openCounterDisplay = (counterId: number) => {
    window.open(`/queue-display/counter/${counterId}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {hospitalName}
          </h1>
          <p className="text-xl text-gray-600">
            Navigasi Display Antrian
          </p>
        </div>

        {/* Main Display Card */}
        <Card className="mb-8 shadow-xl border-2 border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Tv className="h-8 w-8" />
              Display Utama (Lobby)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Tampilan Semua Loket
                </h3>
                <ul className="text-gray-600 space-y-1">
                  <li>✅ Menampilkan semua loket</li>
                  <li>✅ Statistik global</li>
                  <li>❌ Tanpa suara</li>
                  <li>📺 Untuk dipasang di area tunggu utama</li>
                </ul>
              </div>
              <Button
                size="lg"
                onClick={openMainDisplay}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Buka Display Utama
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Counter Displays */}
        <Card className="shadow-xl border-2 border-indigo-200">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Monitor className="h-8 w-8" />
              Display Per Loket
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-gray-600 mb-6">
              Pilih loket untuk membuka display khusus dengan suara
            </p>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="ml-3 text-lg text-gray-600">Memuat loket...</span>
              </div>
            ) : counters.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Tidak ada loket yang tersedia</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {counters.map((counter) => (
                  <Card
                    key={counter.id}
                    className="border-2 border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => openCounterDisplay(counter.id)}
                  >
                    <CardContent className="p-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-indigo-600 mb-2">
                          {counter.code}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">
                          {counter.name}
                        </h3>
                        {counter.location && (
                          <p className="text-sm text-gray-500 mb-4">
                            📍 {counter.location}
                          </p>
                        )}
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          <div>✅ Card "Sedang Dipanggil"</div>
                          <div>🔊 Dengan suara</div>
                          <div>📊 Statistik loket</div>
                        </div>
                        <Button
                          className="w-full bg-indigo-600 hover:bg-indigo-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCounterDisplay(counter.id);
                          }}
                        >
                          Buka Display {counter.code}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p className="mb-2">
            💡 <strong>Tips:</strong> Display akan dibuka di tab baru
          </p>
          <p>
            📺 Display Utama = Tanpa suara, untuk lobby | 
            🔊 Display Per Loket = Dengan suara, untuk masing-masing loket
          </p>
        </div>
      </div>
    </div>
  );
}
