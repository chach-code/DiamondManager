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
      }
    }
  } catch (e) {
    // Ignore errors in test environment where localStorage might not be available
  }
  
  try {
    const res = await fetch(apiUrl, {
      method,
      headers, // Always include headers object (even if empty) for consistency with tests
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Still include credentials for cookie auth (Chrome)
      cache: "no-cache",
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
    
    // Build headers - only include if needed
    let headers: Record<string, string> | undefined = undefined;
    
    // Add JWT token if using token-based auth (Safari fallback)
    if (shouldUseTokenAuth()) {
      const token = getAuthToken();
      if (token) {
        headers = { "Authorization": `Bearer ${token}` };
      }
    }
    
    try {
      const res = await fetch(apiUrl, {
        ...(headers && { headers }),
        credentials: "include", // Still include credentials for cookie auth (Chrome)
        cache: "no-cache",
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
