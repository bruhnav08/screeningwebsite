import React, { useState, useMemo } from 'react';
import api from '../api';
import { UserForm } from '../components';

// --- View 2: RegistrationForm ---
export function RegistrationForm({ onRegisterSuccess, onNavigateToLogin }) {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // --- *** MODIFIED: Add new fields to initialData *** ---
  const initialData = useMemo(() => ({
    name: '',
    email: '',
    password: '',
    role: 'user', 
    selected_date: '',
    agreed_to_terms: false,
    email_notifications: true,
    account_type: 'personal', // Default to 'personal'
    needs_sensitive_storage: false,
  }), []); 
  // --- *** END OF MODIFICATION *** ---

  const handleSubmit = async (formData, profilePicFile) => {
    setError(null);
    setSuccess(null);

    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }
    if (profilePicFile) {
      data.append('profile_pic', profilePicFile);
    }

    try {
      const result = await api.register(data);
      setSuccess("Registration successful! You are now logged in.");
      setTimeout(() => onRegisterSuccess(result.token, result.role), 1500);
    } catch (err) {
      // Format backend error messages
      setError(err.message.split('\n').map((msg, i) => <div key={i}>{msg}</div>));
    }
  };

  return (
    <div className="w-full max-w-lg p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Create your User Account</h2>
      <p className="text-sm text-center text-gray-600 dark:text-gray-400">Sign up to start uploading files.</p>
      {error && <div className="text-red-500 text-sm text-center space-y-1">{error}</div>}
      {success && <div className="text-green-500 text-sm text-center">{success}</div>}
      
      <UserForm 
        onSubmit={handleSubmit}
        isCreate={true}
        submitButtonText="Create Account"
        initialData={initialData}
        showPassword={true}
        showRole={false} // Public registration form HIDES the role selector
        showSettings={true} // Shows 'agreed_to_terms' and 'email_notifications'
        allowEmailEdit={true} // Allow email edit on create
        // --- *** NEW: Show the new fields on the registration form *** ---
        showAccountType={true}
        showSensitiveStorage={true}
      />
      
      <p className="text-sm text-center text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <button onClick={onNavigateToLogin} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          Sign in
        </button>
      </p>
    </div>
  );
}