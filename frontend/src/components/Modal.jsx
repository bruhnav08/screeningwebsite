import React from 'react';
import PropTypes from 'prop-types'; // 1. IMPORT PROPTYPES

// --- Reusable Component: Modal (WITH DARK MODE) ---
export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      // --- FIX: Add accessibility attributes ---
      role="button" 
      tabIndex="0"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div 
        // --- ADDED dark: classes ---
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
        // --- FIX: Add accessibility attributes ---
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title" 
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          {/* --- FIX: Add id for aria-labelledby --- */}
          <h3 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl" aria-label="Close modal">&times;</button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- 2. ADD PROPTYPES BLOCK ---
Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};