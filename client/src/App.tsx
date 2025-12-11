import { Switch, Route, Router as WouterRouter, useLocation as useWouterLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { getBasePath, stripBasePath, addBasePath, getRouteFromQuery } from "@/lib/basePath";
import { useEffect, useState, Component, ReactNode } from "react";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import { useLocation } from "wouter";

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const base = getBasePath();
  const [location] = useWouterLocation();
  const [, setLocationLocal] = useLocation();
  
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

  // If user is authenticated and is on the public landing, redirect to /app
  useEffect(() => {
    if (!isAuthenticated) return; // Don't redirect if not authenticated
    
    const appPath = addBasePath('/app');
    const landingPaths = [rootPath, normalizedRootPath];
    // Only redirect if we're on the landing page
    if (landingPaths.includes(location) && location !== appPath) {
      setLocationLocal(appPath);
    }
  }, [isAuthenticated, location, rootPath, normalizedRootPath, setLocationLocal]);

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
function BasePathSync() {
  const base = getBasePath();
  const [location, setLocation] = useWouterLocation();
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Handle initial query string redirect and path sync - run once on mount
  useEffect(() => {
    if (hasInitialized) return;
    
    // Handle GitHub Pages 404.html redirect format (?/path)
    const routeFromQuery = getRouteFromQuery();
    if (routeFromQuery) {
      // Convert ?/app to /DiamondManager/app
      const cleanRoute = routeFromQuery.startsWith('/') ? routeFromQuery : `/${routeFromQuery}`;
      const fullPath = addBasePath(cleanRoute);
      
      // Update URL to clean format (remove ?/ query string)
      window.history.replaceState(null, '', fullPath);
      setLocation(fullPath, { replace: true } as any);
      setHasInitialized(true);
      return;
    }
    
    // If no query string, just initialize
    setHasInitialized(true);
  }, [setLocation, hasInitialized]);
  
  // Separate effect for ongoing path syncing (only after initialization)
  useEffect(() => {
    if (!hasInitialized || !base) return;
    
    // Skip if location has query params (handled above) or if it's already correct
    if (location && !location.includes('?') && location.startsWith(base)) {
      const pathWithoutBase = stripBasePath(location);
      const expectedLocation = addBasePath(pathWithoutBase);
      
      // Only update if location doesn't match expected format
      // Use pathname comparison to avoid triggering on every location change
      const currentPath = window.location.pathname;
      if (currentPath !== expectedLocation) {
        window.history.replaceState(null, '', expectedLocation);
      }
    }
  }, [base, location, hasInitialized]);
  
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
