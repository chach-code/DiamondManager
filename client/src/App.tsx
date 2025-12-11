import { Switch, Route, Router as WouterRouter, useLocation as useWouterLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { getBasePath, stripBasePath, addBasePath, getRouteFromQuery } from "@/lib/basePath";
import { useEffect, useState, useRef, useMemo, Component, ReactNode } from "react";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import { useLocation } from "wouter";

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const base = getBasePath();
  const [location] = useWouterLocation();
  const [, setLocationLocal] = useLocation();
  
  // Memoize paths to prevent unnecessary re-renders
  // MUST be called before any conditional returns (Rules of Hooks)
  const { rootPath, normalizedRootPath, appPath } = useMemo(() => {
    const root = base ? `${base}/` : "/";
    const normalized = root.endsWith('/') ? root : `${root}/`;
    const app = addBasePath('/app');
    return { rootPath: root, normalizedRootPath: normalized, appPath: app };
  }, [base]);

  // If user is authenticated and is on the public landing, redirect to /app
  // MUST be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return; // Don't redirect if not authenticated or still loading
    
    const landingPaths = [rootPath, normalizedRootPath];
    
    // Only redirect if we're on the landing page and not already on app path
    // Use full path comparison to avoid loops
    const currentPath = location || '';
    if (landingPaths.includes(currentPath) && currentPath !== appPath) {
      setLocationLocal(appPath);
    }
  }, [isAuthenticated, isLoading, location, rootPath, normalizedRootPath, appPath, setLocationLocal]);

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

  // Early return AFTER all hooks are called
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path={rootPath} component={Landing} />
      <Route path={normalizedRootPath} component={Landing} />
      <Route path={addBasePath('/app')} component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Custom Router that syncs wouter's location with the base path
// Note: Query string redirect is now handled in main.tsx before React renders
function BasePathSync() {
  // This component is now minimal - just a placeholder
  // The actual redirect happens in main.tsx to avoid React effect loops
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

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              The application encountered an error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Refresh Page
            </button>
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm">Error Details</summary>
                <pre className="mt-2 text-xs overflow-auto bg-muted p-2 rounded">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  // Catch and log any unhandled errors for debugging
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Unhandled error:', event.error);
    };
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
