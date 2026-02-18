import { createContext, useState, useContext, useEffect } from 'react';
import { initializeCSRF } from '../services/api';

const AuthContext = createContext(null);

// Use environment variable if available, fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const AUTH_BASE_URL = API_BASE_URL.replace('/api', '');

// Helper function to get CSRF token from cookie
const getCsrfToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize CSRF token and check if user is already logged in
    const initialize = async () => {
      // Get CSRF token first
      await initializeCSRF();

      // Check if user is already logged in
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initialize();
  }, []);

  const login = async (username, password) => {
    try {
      // First, get CSRF token by making a GET request
      await fetch(`${API_BASE_URL}/csrf/`, {
        method: 'GET',
        credentials: 'include',
      });

      // Now get the CSRF token from cookies
      const csrfToken = getCsrfToken();

      // Perform login with CSRF token
      const response = await fetch(`${AUTH_BASE_URL}/api-auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': csrfToken,
        },
        body: new URLSearchParams({
          username,
          password,
        }),
        credentials: 'include',
      });

      if (response.ok || response.redirected) {
        // After successful login, determine user role
        const userData = {
          username,
          role: determineRole(username),
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
      } else {
        const errorText = await response.text();
        console.error('Login failed:', errorText);
        throw new Error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    const csrfToken = getCsrfToken();
    fetch(`${AUTH_BASE_URL}/api-auth/logout/`, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
    }).finally(() => {
      setUser(null);
      localStorage.removeItem('user');
    });
  };

  const determineRole = (username) => {
    // All users have the same unified role with full access
    return 'User';
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
