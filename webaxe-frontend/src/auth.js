const AUTH_STORAGE_KEY = "webaxe_auth";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: "", user: null };

    const parsed = JSON.parse(raw);
    return {
      token: parsed?.token || "",
      user: parsed?.user || null
    };
  } catch {
    return { token: "", user: null };
  }
}

export function saveAuth(auth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
}
