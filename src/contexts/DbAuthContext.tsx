import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '@/lib/auth';
import { getApiUrl } from '@/lib/config';

interface DbAuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (nome: string, email: string, password: string, telefone?: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const DbAuthContext = createContext<DbAuthContextType | undefined>(undefined);

// Use centralized configuration
const API_URL = getApiUrl();

export const DbAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar token do localStorage ao iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      fetchCurrentUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(authToken);
      } else {
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const signup = async (nome: string, email: string, password: string, telefone?: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome, email, password, telefone }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  return (
    <DbAuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </DbAuthContext.Provider>
  );
};

export const useDbAuth = () => {
  const context = useContext(DbAuthContext);
  if (context === undefined) {
    throw new Error('useDbAuth must be used within a DbAuthProvider');
  }
  return context;
};
