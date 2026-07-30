import axios from 'axios';

/**
 * Shared axios instance for all API calls.
 *
 * `withCredentials: true` sends the auth cookie on cross-fetch requests. Because
 * the SPA is served from the same origin as the APIs (behind the ticketing.dev
 * ingress in prod, via the Vite dev proxy in dev), requests are same-origin and
 * the cookie flows without CORS complications.
 *
 * baseURL is empty (relative /api/...), so it works wherever the app is hosted.
 */
export const api = axios.create({
  withCredentials: true,
});

/** Extract the array of `{ message, field? }` errors from an API error response. */
export function extractErrors(err: unknown): { message: string; field?: string }[] {
  if (
    axios.isAxiosError(err) &&
    err.response?.data &&
    Array.isArray((err.response.data as any).errors)
  ) {
    return (err.response.data as any).errors;
  }
  return [{ message: 'Something went wrong' }];
}
