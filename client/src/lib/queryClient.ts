import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "./apiConfig";

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
  
  try {
    const res = await fetch(apiUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      // Add cache control for Safari
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
    
    try {
      const res = await fetch(apiUrl, {
        credentials: "include",
        // Add cache control for Safari
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
