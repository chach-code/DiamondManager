import { useLocation as useWouterLocation } from "wouter";
import { getBasePath, stripBasePath, addBasePath } from "./basePath";

// Custom location hook for wouter that handles base path
export function useLocation() {
  const base = getBasePath();
  const [location, setLocation] = useWouterLocation();
  
  // Strip base path from location for routing
  const pathWithoutBase = stripBasePath(location);
  
  // Custom setLocation that adds base path
  const setLocationWithBase = (path: string, replace?: boolean) => {
    const pathWithBase = addBasePath(path);
    setLocation(pathWithBase, replace);
  };
  
  return [pathWithoutBase, setLocationWithBase] as const;
}

