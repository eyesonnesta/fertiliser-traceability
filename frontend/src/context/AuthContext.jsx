// =====================================================================
// Auth context
// Makes the logged-in user available to the whole app, and stores the
// token in localStorage so a page refresh doesn't log you out.
// =====================================================================

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEYS = ['token', 'user'];

function clearStoredAuth() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));

  // On first load, if a token exists, ask the backend who we are.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => {
        if (!cancelled) {
          setUser(res.data.user);
        }
      })
      .catch(() => clearStoredAuth()) // bad/expired token
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Called by the login page on success.
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(res.data.user);
    return res.data.user;
  }

  async function logout() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    clearStoredAuth();
    setUser(null);
    setLoading(false);

    if (!token) {
      return;
    }

    try {
      await api.post('/auth/logout', {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Client-side logout must still complete if the revocation request fails.
    }
  }

  function applyAuthUpdate({ user: nextUser, token }) {
    if (token) {
      localStorage.setItem('token', token);
      sessionStorage.removeItem('token');
    }
    if (nextUser) {
      localStorage.setItem('user', JSON.stringify(nextUser));
      sessionStorage.removeItem('user');
      setUser(nextUser);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, applyAuthUpdate }}>
      {children}
    </AuthContext.Provider>
  );
}

// Small hook so components can do: const { user, login } = useAuth();
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
