'use client';

// AuthorIdentityContext.tsx
// Context for managing author identity (name + email) in the Client Review Portal.
// Persists identity in localStorage for convenience.

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface AuthorIdentity {
  name: string;
  email: string;
}

interface AuthorIdentityContextValue {
  identity: AuthorIdentity | null;
  setIdentity: (identity: AuthorIdentity) => void;
  clearIdentity: () => void;
  requireIdentity: (onComplete: () => void) => void;
  isModalOpen: boolean;
}

const STORAGE_KEY = 'hive-review-author-identity';

const AuthorIdentityContext = createContext<AuthorIdentityContextValue | null>(null);

export function AuthorIdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<AuthorIdentity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Load identity from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name && parsed.email) {
          setIdentityState(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const setIdentity = useCallback((newIdentity: AuthorIdentity) => {
    setIdentityState(newIdentity);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newIdentity));
    } catch {
      // Ignore storage errors
    }
    setIsModalOpen(false);

    // Execute pending action if any
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const clearIdentity = useCallback(() => {
    setIdentityState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const requireIdentity = useCallback((onComplete: () => void) => {
    if (identity) {
      onComplete();
    } else {
      setPendingAction(() => onComplete);
      setIsModalOpen(true);
    }
  }, [identity]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingAction(null);
  }, []);

  return (
    <AuthorIdentityContext.Provider
      value={{
        identity,
        setIdentity,
        clearIdentity,
        requireIdentity,
        isModalOpen,
      }}
    >
      {children}
      {isModalOpen && (
        <AuthorIdentityModal
          onSubmit={setIdentity}
          onClose={closeModal}
        />
      )}
    </AuthorIdentityContext.Provider>
  );
}

export function useAuthorIdentity() {
  const context = useContext(AuthorIdentityContext);
  if (!context) {
    throw new Error('useAuthorIdentity must be used within AuthorIdentityProvider');
  }
  return context;
}

// Modal component for capturing identity
function AuthorIdentityModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (identity: AuthorIdentity) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Please enter a valid email';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-semibold text-white">
          Before you continue
        </h2>
        <p className="mb-6 text-sm text-gray-400">
          Please provide your name and email so we can track feedback and approvals.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="author-name" className="mb-1 block text-sm font-medium text-gray-300">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              id="author-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="John Smith"
              className={`w-full rounded-md border bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:border-amber-500 focus:ring-amber-500'
              }`}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="author-email" className="mb-1 block text-sm font-medium text-gray-300">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="author-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="john@company.com"
              className={`w-full rounded-md border bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:border-amber-500 focus:ring-amber-500'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-amber-400"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
