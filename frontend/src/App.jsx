import React, { useState, useEffect } from 'react';

// --- Import our NEW modules ---
import api from './api';
import { LoginForm, RegistrationForm, UploadView, UserDashboard } from './pages';
import { ThemeToggle } from './components';
import { useDarkMode } from './hooks';

// ===================================================================================
// --- File 4: src/App.jsx ---
// (This is the main entry point and router)
// ===================================================================================

export default function App() {
  const [view, setView] = useState('login');
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading
  
  // --- NEW: Call the dark mode hook ---
  const [isDarkMode, setIsDarkMode] = useDarkMode();

  // This effect runs ONCE on app load to check for a persistent token
  useEffect(() => {
    const tokenFromStorage = localStorage.getItem('authToken');
    if (tokenFromStorage) {
      // We found a token. Let's verify it and get the user.
      api.getMe(tokenFromStorage)
        .then(user => {
          // Only "user" roles stay logged in
          if (user.role.toLowerCase() === 'user') {
            setCurrentUser(user);
            setToken(tokenFromStorage);
          } else {
            // This is an admin/employee token, don't keep it
            localStorage.removeItem('authToken');
          }
        })
        .catch(err => {
          // Token is invalid or expired
          localStorage.removeItem('authToken');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false); // No token, just stop loading
      setView('login');
    }
  }, []); // Empty array means this runs only once on mount
  
  // This effect runs when the token *changes* (e.g., after login)
  useEffect(() => {
    if (token && !currentUser) {
      // Just logged in, get user data
      api.getMe(token)
        .then(setCurrentUser)
        .catch(err => {
          console.error("Error fetching user data after login:", err);
          setToken(null); // Token might be bad
        });
    } else if (!token) {
      // This is the logout logic
      localStorage.removeItem('authToken');
      setCurrentUser(null);
      if (view !== 'register') { 
        setView('login');
      }
    }
  }, [token, currentUser]); // Rerun if token changes OR currentUser is cleared
  
  // This effect listens for global auth errors or profile updates
  useEffect(() => {
    const handleAuthError = () => {
      console.log("Auth error detected, logging out.");
      setToken(null);
    };
    
    // This event is dispatched from the UploadView modal
    const refreshUser = () => {
        if(token) {
            api.getMe(token).then(setCurrentUser).catch(() => setToken(null));
        }
    };
    
    window.addEventListener('auth-error', handleAuthError);
    window.addEventListener('refresh-user', refreshUser);
    return () => {
      window.removeEventListener('auth-error', handleAuthError);
      window.removeEventListener('refresh-user', refreshUser);
    };
  }, [token]); // Re-bind if token changes

  const handleLoginSuccess = (apiToken, role) => {
    // Role-based persistent login
    if (role.toLowerCase() === 'user') {
      localStorage.setItem('authToken', apiToken);
    }
    setToken(apiToken);
  };
  
  const handleRegisterSuccess = (apiToken, role) => {
    if (role.toLowerCase() === 'user') {
      localStorage.setItem('authToken', apiToken);
    }
    setToken(apiToken);
  };

  const handleLogout = () => {
    setToken(null);
  };

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="text-center">
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      );
    }
    
    // --- This is the 3-ROLE ROUTER ---
    if (token && currentUser) {
      const role = currentUser.role.toLowerCase();
      if (role === 'admin') {
        return <UserDashboard token={token} onLogout={handleLogout} currentUser={currentUser} />;
      }
      if (role === 'employee') {
        return <UserDashboard token={token} onLogout={handleLogout} currentUser={currentUser} />;
      }
      if (role === 'user') {
        return <UploadView token={token} onLogout={handleLogout} currentUser={currentUser} />;
      }
    }
    
    // If not logged in, show login or register
    if (view === 'register') {
      return <RegistrationForm onRegisterSuccess={handleRegisterSuccess} onNavigateToLogin={() => setView('login')} />;
    }
    return <LoginForm onLoginSuccess={handleLoginSuccess} onNavigateToRegister={() => setView('register')} />;
  };

  return (
    // --- MODIFIED: Added dark:bg-gray-900 ---
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {renderView()}
      {/* --- NEW: Render the toggle --- */}
      <ThemeToggle isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
    </div>
  );
}