import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "./apiConfig";
import { getAuthToken, shouldUseTokenAuth } from "./authToken";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const apiUrl = getApiUrl(url);
  
  // Build headers - include JWT token if using token auth
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add JWT token if using token-based auth (Safari fallback)
  // Wrap in try-catch to handle test environments where localStorage might not be available
  try {
    if (typeof window !== 'undefined' && shouldUseTokenAuth()) {
      const token = getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        console.log("🔑 [apiRequest] Including JWT token in request", {
          method,
          url: apiUrl,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 30) + '...',
        });
      } else {
        console.warn("⚠️ [apiRequest] shouldUseTokenAuth() is true but no token found", { method, url: apiUrl });
      }
    } else {
      console.log("🍪 [apiRequest] Using cookie-based auth (not using JWT token)", { method, url: apiUrl });
    }
  } catch (e) {
    // Ignore errors in test environment where localStorage might not be available
    console.warn("⚠️ [apiRequest] Error checking token auth:", e);
  }
  
  try {
    console.log("📡 [apiRequest] Making request", {
      method,
      url: apiUrl,
      hasAuthHeader: !!headers["Authorization"],
      headers: Object.keys(headers),
    });
    
    const res = await fetch(apiUrl, {
      method,
      headers, // Always include headers object (even if empty) for consistency with tests
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Still include credentials for cookie auth (Chrome)
      cache: "no-cache",
    });
    
    console.log("📡 [apiRequest] Response received", {
      method,
      url: apiUrl,
      status: res.status,
      statusText: res.statusText,
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Better error handling for network failures (common on Safari)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to server. Please check your internet connection.`);
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const apiUrl = getApiUrl(path);
    
    // Build headers - always create object for consistency
    const headers: Record<string, string> = {};
    
    // Add JWT token if using token-based auth (Safari fallback)
    // Wrap in try-catch to handle test environments where localStorage might not be available
    try {
      if (typeof window !== 'undefined' && shouldUseTokenAuth()) {
        const token = getAuthToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
          console.log("🔑 [queryClient] Including JWT token in request", {
            url: apiUrl,
            tokenLength: token.length,
            tokenPreview: token.substring(0, 30) + '...',
          });
        } else {
          console.warn("⚠️ [queryClient] shouldUseTokenAuth() is true but no token found", { url: apiUrl });
        }
      } else {
        console.log("🍪 [queryClient] Using cookie-based auth (not using JWT token)", { url: apiUrl });
      }
    } catch (e) {
      // Ignore errors in test environment where localStorage might not be available
      console.warn("⚠️ [queryClient] Error checking token auth:", e);
    }
    
    try {
      console.log("📡 [queryClient] Making request", {
        url: apiUrl,
        hasAuthHeader: !!headers["Authorization"],
        headers: Object.keys(headers),
      });
      
      const res = await fetch(apiUrl, {
        headers, // Always include headers object (even if empty) for consistency with tests
        credentials: "include", // Still include credentials for cookie auth (Chrome)
        cache: "no-cache",
      });
      
      console.log("📡 [queryClient] Response received", {
        url: apiUrl,
        status: res.status,
        statusText: res.statusText,
      });

      // CRITICAL: Handle 401 immediately to prevent retry loops
      if (res.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        // For "throw" behavior, throw immediately to prevent any retry logic
        // This ensures React Query doesn't try to retry 401 errors
        throw new Error(`401: Unauthorized - authentication required`);
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // If it's already a 401 error, re-throw immediately (no retries)
      if (error instanceof Error && error.message.includes('401')) {
        throw error;
      }
      // Better error handling for network failures (common on Safari)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error: Unable to connect to server. Please check your internet connection.`);
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
