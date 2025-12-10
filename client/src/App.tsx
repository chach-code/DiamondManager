import { Switch, Route, Router as WouterRouter, useLocation as useWouterLocation, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { getBasePath, stripBasePath, addBasePath } from "@/lib/basePath";
import { useEffect } from "react";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const base = getBasePath();
  const [location] = useWouterLocation();
  
  // For local development (no base path), use "/"
  // For GitHub Pages (with base path), use the base path
  const rootPath = base ? `${base}/` : "/";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Debug: log routing info (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('Router Debug:', { 
      location, 
      base, 
      rootPath, 
      isAuthenticated, 
      isLoading 
    });
  }

  // Normalize root path - ensure it ends with / for matching
  const normalizedRootPath = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  
  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path={normalizedRootPath} component={Landing} />
          <Route path={rootPath} component={Landing} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path={normalizedRootPath} component={Home} />
          <Route path={rootPath} component={Home} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

// Custom Router that syncs wouter's location with the base path
function BasePathSync() {
  const base = getBasePath();
  const [location, setLocation] = useWouterLocation();
  
  useEffect(() => {
    // Only sync if we have a base path (GitHub Pages)
    if (base) {
      const pathWithoutBase = stripBasePath(location);
      const expectedLocation = addBasePath(pathWithoutBase);
      
      if (location !== expectedLocation) {
        // Update the browser URL without triggering navigation
        window.history.replaceState(null, '', expectedLocation);
        // Also update wouter's internal state
        setLocation(expectedLocation, true);
      }
    }
  }, [base, location, setLocation]);
  
  return null;
}

function Router() {
  return (
    <WouterRouter>
      <BasePathSync />
      <AppRouter />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
