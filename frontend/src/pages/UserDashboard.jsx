import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../api';
import { Modal, Pagination, UserForm } from '../components';
import { useDebounce } from '../hooks';

// Hook to detect clicks outside an element
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

const ALL_ROLES = ['admin', 'employee', 'user'];
// --- *** THIS IS THE FIX: Add 'management' to the filter list *** ---
const ALL_ACCOUNT_TYPES = ['personal', 'professional', 'academic', 'management'];

// --- View 4: UserDashboard (for 'admin' and 'employee') ---
export function UserDashboard({ token, onLogout, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffModalMessage, setStaffModalMessage] = useState({ type: '', text: '' });
  const [editingStaff, setEditingStaff] = useState(null);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalError, setUserModalError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  const [expandedRowId, setExpandedRowId] = useState(null);
  
  const adminAddFileRef = useRef(null);
  const [currentUserIdForUpload, setCurrentUserIdForUpload] = useState(null);
  const [fileManagementError, setFileManagementError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [selectedRoles, setSelectedRoles] = useState(ALL_ROLES);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null); 
  useClickOutside(filterMenuRef, () => setIsFilterMenuOpen(false));

  // --- *** THIS IS THE FIX: Add 'management' to the default selected state *** ---
  const [selectedAccountTypes, setSelectedAccountTypes] = useState(ALL_ACCOUNT_TYPES);
  const [selectedSensitivity, setSelectedSensitivity] = useState('all');

  const isAdmin = currentUser.role.toLowerCase() === 'admin';

  const initialUserData = useMemo(() => ({
    name: '',
    email: '',
    password: '',
    role: 'user',
    selected_date: '',
    account_type: 'personal',
    needs_sensitive_storage: false,
  }), []); 
  
  const initialStaffData = useMemo(() => ({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    selected_date: '',
  }), []); 

  // Data Fetching
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search: debouncedSearchTerm,
        sort_by: sortBy,
        sort_order: sortOrder,
        roles: selectedRoles.join(','),
        start_date: startDate,
        end_date: endDate,
        account_types: selectedAccountTypes.join(','),
        sensitivity: selectedSensitivity,
      };
      const data = await api.getUsers(params, token);
      setUsers(data.users);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, debouncedSearchTerm, sortBy, sortOrder, selectedRoles, startDate, endDate, selectedAccountTypes, selectedSensitivity]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // Event Handlers
  const handleSort = (column) => {
    if (column === sortBy) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1); 
  };

  const handleRoleChange = (role) => {
    setSelectedRoles(prev => {
      const newRoles = new Set(prev);
      if (newRoles.has(role)) {
        newRoles.delete(role);
      } else {
        newRoles.add(role);
      }
      return Array.from(newRoles);
    });
    setCurrentPage(1);
  };

  const handleAccountTypeChange = (type) => {
    setSelectedAccountTypes(prev => {
      const newTypes = new Set(prev);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      return Array.from(newTypes);
    });
    setCurrentPage(1);
  };
  
  const handleSensitivityChange = (value) => {
    setSelectedSensitivity(value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedRoles(ALL_ROLES);
    setSelectedAccountTypes(ALL_ACCOUNT_TYPES);
    setSelectedSensitivity('all');
    setStartDate('');
    setEndDate('');
    setIsFilterMenuOpen(false);
    setCurrentPage(1);
  };
  
  const handleDownload = async (fileId, filename) => {
    try {
      setError(null);
      await api.downloadFile(fileId, token);
    } catch (err) {
      setError(`Failed to download ${filename}: ${err.message}`);
    }
  };
  
  const handleSaveStaff = async (formData, profilePicFile) => {
    setStaffModalMessage({ type: '', text: '' });
    const staffData = {...formData};
    
    try {
      const isCreating = !editingStaff?.id; 

      if (isCreating) {
        await api.createStaff(staffData, token);
      } else {
        if (!staffData.password) {
          delete staffData.password;
        }
        await api.updateStaff(editingStaff.id, staffData, token);
      }
      closeStaffModal();

      if (isCreating) {
        setSearchTerm('');
        setSelectedRoles(ALL_ROLES);
        setSelectedAccountTypes(ALL_ACCOUNT_TYPES);
        setSelectedSensitivity('all');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1); 
      } else {
        fetchUsers(); 
      }
      
    } catch (err) {
      setStaffModalMessage({ type: 'error', text: err.message.split('\n').map((msg, i) => <div key={i}>{msg}</div>) });
    }
  };
  
  const handleSaveUser = async (formData, profilePicFile) => {
    setUserModalError(null);
    const data = new FormData();
    
    for (const key in formData) {
      if (key === 'password' && (editingUser && editingUser.id) && !formData[key]) {
        continue;
      }
      data.append(key, formData[key]);
    }
    
    if (profilePicFile) {
      data.append('profile_pic', profilePicFile);
    }
    
    try {
      const isCreating = !editingUser?.id;

      if (isCreating) {
        await api.adminCreateUser(data, token);
      } else {
        await api.adminUpdateUser(editingUser.id, data, token);
      }
      closeUserModal();
      
      if (isCreating) {
        setSearchTerm('');
        setSelectedRoles(ALL_ROLES);
        setSelectedAccountTypes(ALL_ACCOUNT_TYPES);
        setSelectedSensitivity('all');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
      } else {
        fetchUsers();
      }

    } catch (err) {
      setUserModalError(err.message.split('\n').map((msg, i) => <div key={i}>{msg}</div>));
    }
  };


  const handleDeleteUser = async (id) => {
    if (window.confirm('Are you sure you want to delete this user? This will also delete all their uploaded files and profile picture.')) {
      try {
        await api.deleteUser(id, token);
        fetchUsers();
      } catch (err) {
        alert(`Error deleting user: ${err.message}`);
      }
    }
  };

  const handleCreateStaff = () => {
    setStaffModalMessage({ type: '', text: '' });
    setEditingStaff(initialStaffData);
    setIsStaffModalOpen(true);
  };
  
  const closeStaffModal = () => {
    setIsStaffModalOpen(false);
    setEditingStaff(null);
    setStaffModalMessage({ type: '', text: '' });
  };
  
  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
    setUserModalError(null);
  };
  
  const handleRowClick = (userId) => {
    setFileManagementError(null);
    if (expandedRowId === userId) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(userId);
    }
  };

  const handleAdminFileAddClick = (userId) => {
    setCurrentUserIdForUpload(userId);
    adminAddFileRef.current.click();
  };

  const handleAdminFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUserIdForUpload) return;

    setFileManagementError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      await api.adminAddFile(currentUserIdForUpload, formData, token);
      await fetchUsers();
    } catch (err) {
      setFileManagementError(`Failed to upload file: ${err.message}`);
    } finally {
      setLoading(false);
      e.target.value = null;
      setCurrentUserIdForUpload(null);
    }
  };

  const handleAdminFileDelete = async (fileId, filename) => {
    if (window.confirm(`Are you sure you want to delete this file?\n\n${filename}`)) {
      setFileManagementError(null);
      try {
        setLoading(true);
        await api.adminDeleteFile(fileId, token);
        await fetchUsers();
      } catch (err) {
        setFileManagementError(`Failed to delete file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };
  
  const getFullImageUrl = (url) => {
    if (!url) {
      return "https://placehold.co/150x150/E2D9FF/6842FF?text=U";
    }
    if (url.startsWith('http') || url.startsWith('blob:')) {
      return url;
    }
    return `${api.baseUrl}${url}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <input
        type="file"
        ref={adminAddFileRef}
        onChange={handleAdminFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">User Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Welcome, <span className="font-medium">{currentUser.name}</span> (<span className="capitalize font-medium">{currentUser.role}</span>)
          </p>
        </div>
        <div className="flex space-x-2">
          {isAdmin && (
            <>
              <button
                onClick={() => { setUserModalError(null); setEditingUser(initialUserData); setIsUserModalOpen(true); }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Create User
              </button>
              <button
                onClick={handleCreateStaff}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Staff
              </button>
            </>
          )}
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
          className="w-full md:flex-1 px-4 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        
        <div className="relative" ref={filterMenuRef}>
          <button
            onClick={() => setIsFilterMenuOpen(prev => !prev)}
            className="w-full md:w-auto px-4 py-2 flex items-center justify-center gap-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.572a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            Filters
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          
          {isFilterMenuOpen && (
            <div className="absolute z-10 top-12 right-0 w-80 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl space-y-4">
              
              {/* Roles Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Role</label>
                <div className="flex flex-col mt-2 space-y-1">
                  {ALL_ROLES.map(role => (
                    <label key={role} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => handleRoleChange(role)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:text-indigo-400"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* --- *** MODIFIED: Account Type Section now includes 'management' *** --- */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Account Type</label>
                <div className="flex flex-col mt-2 space-y-1">
                  {ALL_ACCOUNT_TYPES.map(type => (
                    <label key={type} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAccountTypes.includes(type)}
                        onChange={() => handleAccountTypeChange(type)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:text-indigo-400"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Sensitive Storage Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Storage Needs</label>
                <div className="flex flex-col mt-2 space-y-1">
                  {[
                    { label: 'All', value: 'all' },
                    { label: 'Yes (Sensitive)', value: 'true' },
                    { label: 'No (Standard)', value: 'false' }
                  ].map(item => (
                    <label key={item.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sensitivity-filter"
                        value={item.value}
                        checked={selectedSensitivity === item.value}
                        onChange={() => handleSensitivityChange(item.value)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded-full dark:border-gray-600 dark:bg-gray-700 dark:text-indigo-400"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Date Joined</label>
                <div className="mt-2 space-y-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {setStartDate(e.target.value); setCurrentPage(1);}}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {setEndDate(e.target.value); setCurrentPage(1);}}
                    min={startDate}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="To"
                  />
                </div>
              </div>
              
              <button
                onClick={handleClearFilters}
                className="w-full text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* User Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('role')}>
                Role {sortBy === 'role' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Account Type
              </th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Files
              </th>
              <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('created_date')}>
                Joined {sortBy === 'created_date' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              {isAdmin && (
                <th scope="col" className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="p-4 text-center text-gray-500 dark:text-gray-400">Loading users...</td></tr>
            ) : error ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="p-4 text-center text-red-500">Failed to load users.</td></tr>
            ) : (
              users.map(user => (
                <React.Fragment key={user.id}>
                  <tr 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="p-3 whitespace-nowrap" onClick={() => handleRowClick(user.id)} style={{ cursor: 'pointer' }}>
                       <div className="flex items-center">
                          <img 
                            src={getFullImageUrl(user.profile_pic)} 
                            alt={user.name} 
                            className="w-10 h-10 rounded-full mr-3 object-cover"
                            onError={(e) => { 
                              const initials = user.name ? user.name[0].toUpperCase() : 'U';
                              e.target.src = `https://placehold.co/150x150/E2D9FF/6842FF?text=${initials}`;
                            }}
                          />
                          <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                       </div>
                    </td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">{user.email || 'N/A'}</td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        user.role === 'employee' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    {/* --- *** MODIFIED: Account Type Cell now shows 'management' *** --- */}
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        user.account_type === 'management' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {user.account_type || 'N/A'}
                      </span>
                    </td>
                    {/* --- *** END OF MODIFICATION *** --- */}
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {user.gallery ? user.gallery.length : 0}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-700 dark:text-gray-300">{user.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'}</td>
                    {isAdmin && (
                      <td className="p-3 text-sm font-medium">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (user.role === 'user') {
                              setUserModalError(null);
                              setEditingUser(user);
                              setIsUserModalOpen(true);
                            } else {
                              setStaffModalMessage({ type: '', text: '' });
                              setEditingStaff(user);
                              setIsStaffModalOpen(true);
                            }
                          }} 
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-3"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user.id);
                          }} 
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                  
                  {expandedRowId === user.id && (
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={isAdmin ? 7 : 6} className="p-4">
                        <div className="flex justify-between">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">Sensitive Storage Request: </span>
                            {user.needs_sensitive_storage ? (
                              <span className="font-bold text-red-600 dark:text-red-400">Yes</span>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">No</span>
                            )}
                          </div>
                          {fileManagementError && (
                            <div className="text-red-500 text-sm text-center mb-2">{fileManagementError}</div>
                          )}
                        </div>
                        {user.role === 'user' ? (
                          <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">File Management:</h4>
                              <button
                                onClick={() => handleAdminFileAddClick(user.id)}
                                className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-xs"
                              >
                                Add File
                              </button>
                            </div>
                            {user.gallery && user.gallery.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {user.gallery.map(file => (
                                  <div key={file.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-sm">
                                    <span className="text-sm text-indigo-600 dark:text-indigo-300 truncate" title={file.filename}>
                                      {file.filename}
                                    </span>
                                    <div>
                                      <button
                                        onClick={() => handleDownload(file.id, file.filename)}
                                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium mr-3"
                                      >
                                        Download
                                      </button>
                                      <button
                                        onClick={() => handleAdminFileDelete(file.id, file.filename)}
                                        className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 font-medium"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">No files uploaded by this user.</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                            This user role ({user.role}) does not have a file gallery.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
        />
      )}

      {/* --- Staff Modal (Unchanged, maintains division of labour) --- */}
      <Modal isOpen={isStaffModalOpen} onClose={closeStaffModal} title={editingStaff?.id ? 'Edit Staff' : 'Create New Staff'}>
        {staffModalMessage.text && (
          <div className={`p-2 mb-4 rounded text-sm ${staffModalMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {staffModalMessage.text}
          </div>
        )}
        <UserForm
          initialData={editingStaff || initialStaffData}
          onSubmit={handleSaveStaff}
          isCreate={!editingStaff?.id}
          isEdit={!!editingStaff?.id}
          submitButtonText={editingStaff?.id ? "Save Changes" : "Create Staff"}
          showPassword={true}
          showRole={true}
          roleOptions={['admin', 'employee']} 
          showSettings={false}
          allowEmailEdit={true}
          showAccountType={false} // --- CORRECT: Hidden for staff
          showSensitiveStorage={false} // --- CORRECT: Hidden for staff
        />
      </Modal>
      
      {/* --- User Modal (MODIFIED to show new fields) --- */}
      <Modal isOpen={isUserModalOpen} onClose={closeUserModal} title={editingUser?.id ? 'Edit User' : 'Create New User'}>
        {userModalError && (
          <div className={`p-2 mb-4 rounded text-sm bg-red-100 text-red-700`}>
            {userModalError}
          </div>
        )}
        <UserForm
          initialData={editingUser || initialUserData}
          onSubmit={handleSaveUser}
          isCreate={!editingUser?.id}
          isEdit={!!editingUser?.id}
          submitButtonText={editingUser?.id ? "Save Changes" : "Create User"}
          showPassword={true}
          showRole={false}
          showSettings={false} 
          allowEmailEdit={true}
          showAccountType={true} // --- CORRECT: Shown for user
          showSensitiveStorage={true} // --- CORRECT: Shown for user
        />
      </Modal>
    </div>
  );
}