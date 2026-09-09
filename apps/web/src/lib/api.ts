import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// The auth token lives in an httpOnly cookie set by the API (not readable by
// JS, so not stealable via XSS the way localStorage was) — withCredentials
// makes the browser send/accept it automatically on every request.
export const api = axios.create({
  baseURL: `${apiUrl}/api`,
  withCredentials: true,
});
