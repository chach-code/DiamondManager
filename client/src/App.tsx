import { Switch, Route, Router as WouterRouter, useLocation as useWouterLocation } from "wouter";
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
  const basePath = base ? `${base}/` : "/";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path={basePath} component={Landing} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path={basePath} component={Home} />
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
    // If we have a base path and location doesn't start with it, fix it
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
