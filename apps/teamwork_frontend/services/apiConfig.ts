/**
 * API Configuration
 *
 * In development: API calls go through Vite proxy (relative URLs work)
 * In production: API calls go to the deployed backend URL
 */

// Injected by Vite at build time
declare const __API_URL__: string;

// Get the API base URL
// - Development: empty string (uses Vite proxy)
// - Production: full backend URL from VITE_API_URL env var
export const API_BASE_URL = typeof __API_URL__ !== 'undefined' ? __API_URL__ : '';

/**
 * Build a full API URL
 * @param path - API path starting with /api
 * @returns Full URL for the API endpoint
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
