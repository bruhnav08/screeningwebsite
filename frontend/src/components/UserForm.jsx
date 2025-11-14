import React, { useState, useEffect } from 'react';
import api from '../api';

// --- Reusable Component: UserForm ---
export function UserForm({ 
  initialData, 
  onSubmit, 
  isCreate = false,
  submitButtonText = "Save",
  showPassword = true,
  showRole = false,
  roleOptions = ['user', 'admin', 'employee'], 
  isEdit = false,
  allowEmailEdit = false, 
  showSettings = true, 
  // --- *** REMOVED old showStatus/showPremium props *** ---
  // --- *** NEW PROPS for new fields *** ---
  showAccountType = false,
  showSensitiveStorage = false
  // --- *** END OF NEW PROPS *** ---
}) {
  const [formData, setFormData] = useState(initialData);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initialData.profile_pic || null);

  const getMaxDate = () => {
    const today = new Date();
    const eighteenYearsAgo = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    return eighteenYearsAgo.toISOString().split('T')[0];
  };
  const maxValidDate = getMaxDate();

  useEffect(() => {
    let data = {...initialData};
    if (data.selected_date) {
        data.selected_date = data.selected_date.split('T')[0];
    }
    // --- *** NEW: Ensure new fields have defaults *** ---
    if (!data.account_type) {
      data.account_type = 'personal'; // Default for forms
    }
    if (data.needs_sensitive_storage === undefined) {
      data.needs_sensitive_storage = false; // Default for forms
    }
    // --- *** END OF NEW DEFAULTS *** ---
    
    setFormData(data);
    setPreviewUrl(data.profile_pic || null);
    setProfilePicFile(null); 
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (name === 'profile_pic' && files[0]) {
      const file = files[0];
      setProfilePicFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData, profilePicFile);
  };
  
  const getFullImageUrl = (url) => {
    if (!url) {
      const initials = formData.name ? formData.name[0].toUpperCase() : 'U';
      return `https://placehold.co/150x150/E2D9FF/6842FF?text=${initials}`;
    }
    if (url.startsWith('http') || url.startsWith('blob:')) {
      return url;
    }
    return `${api.baseUrl}${url}`;
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Profile Pic with Preview */}
      <div className="flex items-center space-x-4">
        <img 
          src={getFullImageUrl(previewUrl)} 
          alt="Profile" 
          className="w-16 h-16 rounded-full object-cover"
          onError={(e) => { 
            const initials = formData.name ? formData.name[0].toUpperCase() : 'U';
            e.target.src = `https://placehold.co/150x150/E2D9FF/6842FF?text=${initials}`;
          }}
        />
        <div className="flex-1">
          <label htmlFor="profile_pic" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile Picture</label>
          <input 
            type="file" 
            name="profile_pic" 
            id="profile_pic" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-600 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800" 
          />
        </div>
      </div>
      
      {/* All Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Text Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
          <input type="text" name="name" id="name" required 
            minLength="2"
            value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        
        {/* Date Picker */}
        <div>
          <label htmlFor="selected_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
          <input type="date" name="selected_date" id="selected_date" 
            title="You must be at least 18 years old."
            max={maxValidDate}
            value={formData.selected_date || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>

        {/* Password Field */}
        {showPassword && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input 
              type="password" 
              name="password" 
              id="password" 
              required={isCreate} 
              minLength="6"
              title="Password must be at least 6 characters long"
              value={formData.password || ''} 
              onChange={handleChange} 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
              placeholder={isCreate ? "Required (min 6 chars)" : "Leave blank to keep same"} 
            />
          </div>
        )}
        
        {/* Dropdown (Select) - for Admins */}
        {showRole && (
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              {roleOptions.map(role => (
                <option key={role} value={role} className="capitalize">{role}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <fieldset className="space-y-4 p-4 border border-gray-200 rounded-md dark:border-gray-700">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Login Details</legend>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (for Login)</label>
          <input type="email" name="email" id="email" required 
                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$" 
                title="Please enter a valid email address (e.g., user@example.com)"
                value={formData.email || ''} onChange={handleChange} 
                disabled={isEdit && !allowEmailEdit}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-600" />
        </div>
      </fieldset>
      
      {/* --- *** NEW: Radio Buttons for Account Type *** --- */}
      {showAccountType && (
        <fieldset className="space-y-2 p-4 border border-gray-200 rounded-md dark:border-gray-700">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">How will you be using this service?</legend>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
            {['personal', 'professional', 'academic'].map(type => (
              <div key={type} className="flex items-center">
                <input 
                  id={`account_type_${type}`} 
                  name="account_type" 
                  type="radio" 
                  value={type}
                  checked={formData.account_type === type}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700" 
                />
                <label htmlFor={`account_type_${type}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-300 capitalize">{type}</label>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      {/* --- *** END OF RADIO BUTTONS *** --- */}

      {/* Checkboxes */}
      {showSettings && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Settings</legend>
          <div className="flex items-start">
            <input id="agreed_to_terms" name="agreed_to_terms" type="checkbox" 
              required={isCreate && !isEdit}
              checked={formData.agreed_to_terms || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700" />
            <label htmlFor="agreed_to_terms" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">I agree to the terms and conditions</label>
          </div>
          <div className="flex items-start">
            <input id="email_notifications" name="email_notifications" type="checkbox" checked={formData.email_notifications || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700" />
            <label htmlFor="email_notifications" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Receive email notifications</label>
          </div>
        </fieldset>
      )}
      
      {/* --- *** NEW: Checkbox for Sensitive Storage *** --- */}
      {showSensitiveStorage && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Storage Needs</legend>
          <div className="flex items-start">
            <input 
              id="needs_sensitive_storage" 
              name="needs_sensitive_storage" 
              type="checkbox" 
              checked={formData.needs_sensitive_storage || false} 
              onChange={handleChange} 
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700" 
            />
            <label htmlFor="needs_sensitive_storage" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Request for high-sensitivity storage (at extra cost)</label>
          </div>
        </fieldset>
      )}
      {/* --- *** END OF CHECKBOX *** --- */}

      <button
        type="submit"
        disabled={showSettings && !formData.agreed_to_terms && !isEdit}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {submitButtonText}
      </button>
    </form>
  );
}