// ===================================================================================
// --- File 1: src/api.js ---
// (Contains the API helper class for all backend communication)
// ===================================================================================

class API {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Universal request handler
   */
  async request(endpoint, options = {}) {
    const { method = 'GET', body = null, token = null, isFormData = false, isFileDownload = false } = options; // <-- ADDED isFileDownload
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers();
    if (!isFormData) {
      headers.append('Content-Type', 'application/json');
    }
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    const config = {
      method,
      headers,
    };

    if (body) {
      config.body = isFormData ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);
      
      // --- *** THIS IS THE FIX *** ---
      // We only throw "Session expired" if a token was actually sent.
      // This stops the login/register pages from showing this error.
      if (response.status === 401 && token) { 
        window.dispatchEvent(new Event('auth-error'));
        throw new Error("Session expired. Please login again.");
      }
      // --- *** END OF FIX *** ---

      // --- START: NEW FILE DOWNLOAD FIX ---
      if (isFileDownload) {
        if (!response.ok) {
          // Try to parse error message if it's JSON, otherwise throw generic error
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || "File download failed");
          } catch (e) {
            throw new Error(e.message || "File download failed");
          }
        }
        
        // This is a file download
        const blob = await response.blob();
        let filename = 'downloaded_file';
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
            if (filenameMatch && filenameMatch.length > 1) {
                filename = filenameMatch[1];
            }
        }
        
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(link.href);
        return { message: "File downloaded" };
      }
      // --- END: NEW FILE DOWNLOAD FIX ---

      const data = await response.json(); 

      if (!response.ok) {
        // This will now correctly show "Invalid email or password"
        // or any other error from the backend.
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error) {
      if (error.message !== "Session expired. Please login again.") {
        console.error('API request failed:', error);
      }
      throw error;
    }
  }

  // --- Auth Methods ---
  login(email, password) {
    return this.request('/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  register(formData) {
    return this.request('/register', {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
  }
  
  getMe(token) {
    return this.request('/me', { token });
  }

  // --- 'User' Role Methods ---
  uploadFiles(formData, token) {
    return this.request('/upload', {
      method: 'POST',
      body: formData,
      token,
      isFormData: true,
    });
  }
  
  getMyFiles(token) {
    return this.request('/my-files', { token });
  }
  
  updateMyProfile(profileData, token) {
    return this.request('/my-profile', {
        method: 'PUT',
        body: profileData,
        token,
    });
  }
  
  updateMyProfilePic(formData, token) {
    return this.request('/my-profile/pic', {
        method: 'POST',
        body: formData,
        token,
        isFormData: true,
    });
  }
  
  // --- Admin/Employee Methods ---
  getUsers(params, token) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users?${query}`, { token });
  }

  downloadFile(fileId, token) {
    // --- FIX: Tell the request function to expect a file ---
    return this.request(`/file/${fileId}`, { token, isFileDownload: true });
  }
  
  // --- NEW: Staff Management Methods ---
  getStaff(token) {
    return this.request('/staff', { token });
  }

  createStaff(userData, token) {
    // --- FIX: Route was /staff, backend has /users ---
    return this.request('/users', {
      method: 'POST',
      body: userData,
      token,
    });
  }
  
  updateStaff(id, userData, token) {
    // --- FIX: Route was /staff/:id, backend has /users/:id ---
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: userData,
      token,
    });
  }
  
  deleteStaff(id, token) {
     return this.request(`/staff/${id}`, {
      method: 'DELETE',
      token,
    });
  }
  
  // --- NEW: Admin-Create-User Method ---
  adminCreateUser(formData, token) {
    return this.request('/admin/create-user', {
        method: 'POST',
        body: formData,
        token,
        isFormData: true,
    });
  }
  
  // --- NEW: Admin-Update-User Method ---
  adminUpdateUser(id, formData, token) {
    return this.request(`/admin/update-user/${id}`, {
        method: 'POST', // Use POST for multipart/form-data
        body: formData,
        token,
        isFormData: true,
    });
  }

  deleteUser(id, token) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
      token,
    });
  }

  // --- NEW: Admin File Management ---
  adminAddFile(userId, formData, token) {
    return this.request(`/admin/user/${userId}/file`, {
      method: 'POST',
      body: formData,
      token,
      isFormData: true,
    });
  }
  
  adminDeleteFile(fileId, token) {
    return this.request(`/admin/user/file/${fileId}`, {
      method: 'DELETE',
      token,
    });
  }
}

// Instantiate and export a single API instance
const api = new API('http://localhost:5000');
export default api;