const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function handleResponse(response) {
  if (response.ok) {
    return response.json();
  }

  let message = "Request failed";

  try {
    const payload = await response.json();
    message = payload.details || payload.message || message;
  } catch {
    message = response.statusText || message;
  }

  throw new Error(message);
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  return handleResponse(response);
}

export async function adminRequest(path, adminKey, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("x-admin-key", adminKey);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return handleResponse(response);
}

