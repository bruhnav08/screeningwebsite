import React from 'react';

// --- NEW: Theme Toggle Button ---
export function ThemeToggle({ isDarkMode, setIsDarkMode }) {
  return (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="fixed bottom-4 right-4 z-50 bg-gray-800 dark:bg-white text-white dark:text-gray-800 w-12 h-12 rounded-full text-2xl flex items-center justify-center shadow-lg hover:bg-gray-700 dark:hover:bg-gray-200"
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? '☀️' : '🌙'}
    </button>
  );
}