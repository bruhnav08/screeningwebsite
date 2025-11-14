import React, { useState } from 'react';
import api from '../api'; // Note the '../api' path

// --- View 1: LoginForm ---
export function LoginForm({ onLoginSuccess, onNavigateToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      // Login now returns { token, role }
      const data = await api.login(email, password);
      onLoginSuccess(data.token, data.role);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    // --- FIX 3 (Dark Mode) ---
    <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Sign in to your account</h2>
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <div>
          {/* --- FIX 3 (Dark Mode) --- */}
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$" // --- NEW VALIDATION ---
            title="Please enter a valid email address (e.g., user@example.com)" // --- NEW ---
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            // --- FIX 3 (Dark Mode) ---
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        <div>
          {/* --- FIX 3 (Dark Mode) --- */}
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input
            id="password" name="password" type="password" autoComplete="current-password" required
            minLength="6" // --- NEW VALIDATION ---
            title="Password must be at least 6 characters long" // --- NEW ---
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            // --- FIX 3 (Dark Mode) ---
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Sign in
        </button>
      </form>
      {/* --- FIX 3 (Dark Mode) --- */}
      <p className="text-sm text-center text-gray-600 dark:text-gray-400">
        Need an account?{' '}
        <button onClick={onNavigateToRegister} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          Register as a User
        </button>
      </p>
    </div>
  );
}