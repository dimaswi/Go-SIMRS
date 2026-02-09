import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { patientsApi, type Patient } from '@/lib/api';
import { Search, Loader2 } from 'lucide-react';

export function PatientSearch() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Sync query from URL when on patient-search pages
  useEffect(() => {
    if (location.pathname.startsWith('/patient-search')) {
      const urlQuery = searchParams.get('q') || '';
      setQuery(urlQuery);
    }
  }, [location.pathname, searchParams]);

  // Handle Enter key - navigate to search page
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (!query.trim()) return;

      setIsSearching(true);
      try {
        // First, search to check if there's only 1 result
        const response = await patientsApi.search(query.trim(), 2);
        const patients: Patient[] = response.data || [];
        
        if (patients.length === 1) {
          // If only 1 result, go directly to detail page
          navigate(`/patient-search/${patients[0].id}?q=${encodeURIComponent(query.trim())}`);
        } else {
          // If 0 or more than 1 result, go to list page
          navigate(`/patient-search?q=${encodeURIComponent(query.trim())}`);
        }
        
        // Keep query visible in input field
      } catch (error) {
        console.error('Error searching patients:', error);
        // On error, still navigate to list page
        navigate(`/patient-search?q=${encodeURIComponent(query.trim())}`);
      } finally {
        setIsSearching(false);
      }
    }
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Cari No. RM / Nama Pasien..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-8 pr-8 h-8 w-[220px] lg:w-[280px] bg-muted/40 border-0 rounded-full text-sm placeholder:text-muted-foreground/70 focus-visible:bg-background focus-visible:border focus-visible:border-input"
          disabled={isSearching}
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
