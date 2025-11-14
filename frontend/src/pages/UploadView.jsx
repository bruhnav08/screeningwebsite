import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { Modal, UserForm } from '../components';

// --- View 3: UploadView (for 'user' role) ---
export function UploadView({ token, onLogout, currentUser }) {
  const [myFiles, setMyFiles] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(null);
  const fileInputRef = useRef(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState({ type: '', text: '' });
  const [profileData, setProfileData] = useState(currentUser);
  
  // Helper function for image URLs
  const getFullImageUrl = (url) => {
    if (!url) return "https://placehold.co/150x150/E2D9FF/6842FF?text=U";
    if (url.startsWith('http') || url.startsWith('blob:')) {
      return url;
    }
    return `${api.baseUrl}${url}`;
  };

  // Update form data if currentUser prop changes
  useEffect(() => {
    let data = {...currentUser};
    if (data.selected_date) {
        data.selected_date = data.selected_date.split('T')[0];
    }
    data.password = '';
    setProfileData(data);
  }, [currentUser]);
  

  const fetchMyFiles = useCallback(async () => {
    try {
      const files = await api.getMyFiles(token);
      setMyFiles(files);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    fetchMyFiles();
  }, [fetchMyFiles]);

  const handleFileChange = (e) => {
    setSelectedFiles(e.target.files);
  };
  
  const handleDownload = async (fileId, filename) => {
    try {
      setError(null);
      await api.downloadFile(fileId, token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) {
      setError("Please select one or more files to upload.");
      return;
    }
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append('files_to_upload', file);
    }
    
    try {
      const result = await api.uploadFiles(formData, token);
      setSuccess(result.message);
      fetchMyFiles(); // Refresh the file list
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSelectedFiles(null);
    } catch (err) {
      // Show backend error (e.g., if API is down)
      setError(err.message);
    }
  };
  
  const handleProfileSave = async (formData, profilePicFile) => {
    setModalMessage({ type: '', text: '' });
    const textData = {...formData};
    
    try {
      if (!textData.password) {
        delete textData.password;
      }
      textData.email_notifications = textData.email_notifications === 'true' || textData.email_notifications === true;
      
      await api.updateMyProfile(textData, token);

      if (profilePicFile) {
        const picFormData = new FormData();
        picFormData.append('profile_pic', profilePicFile);
        await api.updateMyProfilePic(picFormData, token);
      }
      
      setModalMessage({ type: 'success', text: 'Profile updated!' });
      window.dispatchEvent(new Event('refresh-user'));
      setTimeout(() => setIsModalOpen(false), 1500);
      
    } catch(err) {
      setModalMessage({ type: 'error', text: err.message.split('\n').map((msg, i) => <div key={i}>{msg}</div>) });
    }
  };

  return (
    <div className="w-full max-w-4xl p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <img src={getFullImageUrl(currentUser.profile_pic)} alt="Profile" className="w-12 h-12 rounded-full object-cover" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My File Uploader</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Welcome, <span className="font-medium">{currentUser.name}</span> (User)</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
          >
            Edit Profile
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
          >
            Logout
          </button>
        </div>
      </div>
      
      {error && <div className="text-red-500 text-sm text-center p-3 bg-red-100 rounded">{error}</div>}
      {success && <div className="text-green-500 text-sm text-center p-3 bg-green-100 rounded">{success}</div>}

      {/* --- *** MODIFICATION *** --- */}
      {/* The conditional upload block is GONE. All users can upload. */}
      <form className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg" onSubmit={handleUploadSubmit}>
        <div>
          <label htmlFor="files_to_upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload Files (txt, csv, png, mp4, etc.)</label>
          <input 
            type="file" 
            name="files_to_upload" 
            id="files_to_upload" 
            multiple 
            ref={fileInputRef}
            onChange={handleFileChange} 
            accept=".txt,.csv,.png,.jpg,.jpeg,.mp4,.pdf,.doc,.docx,.xls,.xlsx"
            className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-600 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800" 
          />
        </div>
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Upload
        </button>
      </form>
      {/* --- *** END OF MODIFICATION *** --- */}
      
      {/* --- My Files List --- */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">My Uploaded Files</h3>
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700 rounded">
          {myFiles.length > 0 ? (
            myFiles.map(file => (
              <div key={file.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded">
                <span className="text-sm text-gray-700 dark:text-gray-300">{file.filename}</span>
                <button 
                  onClick={() => handleDownload(file.id, file.filename)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 font-medium"
                >
                  Download
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">You have not uploaded any files yet.</p>
          )}
        </div>
      </div>
      
      {/* --- Edit Profile Modal --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit My Profile">
        {modalMessage.text && (
          <div className={`p-2 mb-4 rounded text-sm ${modalMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {modalMessage.text}
          </div>
        )}
        <UserForm 
          initialData={profileData}
          onSubmit={handleProfileSave}
          isEdit={true}
          submitButtonText="Save Changes"
          showPassword={true}
          showRole={false}
          showSettings={true} 
          allowEmailEdit={false} 
          // Correctly hide the new fields from the user's *own* edit modal
          showAccountType={false}
          showSensitiveStorage={false}
        />
      </Modal>
    </div>
  );
}