import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface BreadcrumbOverride {
  /** Extra segments to append after the auto-generated ones */
  extraSegments?: { label: string; path?: string }[];
}

interface BreadcrumbContextType {
  override: BreadcrumbOverride | null;
  setOverride: (o: BreadcrumbOverride | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  override: null,
  setOverride: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<BreadcrumbOverride | null>(null);
  const setOverride = useCallback((o: BreadcrumbOverride | null) => setOverrideState(o), []);

  return (
    <BreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
