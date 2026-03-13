import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated by making a request to a protected endpoint
    // Since we use HTTP-only cookies, we can't read the token directly
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Try to access a protected endpoint to verify authentication
      // If this succeeds, the user is authenticated
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000/api'}/users/me`, {
        credentials: 'include', // Include cookies
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback((userData) => {
    // For cookie-based auth, we don't need to store token locally
    // The backend handles the cookie
    setIsAuthenticated(true);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to clear cookie
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000/api'}/users/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
