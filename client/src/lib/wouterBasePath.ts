import { useLocation as useWouterLocation } from "wouter";
import { useCallback } from "react";
import { getBasePath, stripBasePath, addBasePath } from "./basePath";

// Custom location hook for wouter that handles base path
export function useLocation() {
  const base = getBasePath();
  const [location, setLocation] = useWouterLocation();
  
  // Strip base path from location for routing
  const pathWithoutBase = stripBasePath(location);
  
  // Memoize setLocation to prevent infinite loops in useEffect dependencies
  const setLocationWithBase = useCallback((path: string, replace?: boolean) => {
    const pathWithBase = addBasePath(path);
    // wouter expects an options object like { replace?: boolean }
    const options = typeof replace === 'boolean' ? { replace } : undefined;
    // Cast to any because wouter types may vary between versions
    setLocation(pathWithBase, options as any);
  }, [setLocation]);
  
  return [pathWithoutBase, setLocationWithBase] as const;
}

