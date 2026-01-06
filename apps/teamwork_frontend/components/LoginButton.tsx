import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginButtonProps {
  className?: string;
  variant?: 'primary' | 'outline';
}

export function LoginButton({ className = '', variant = 'primary' }: LoginButtonProps) {
  const { signIn, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setIsSigningIn(false);
    }
  };

  const baseStyles = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    outline: 'border-2 border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleSignIn}
        disabled={isLoading || isSigningIn}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      >
        {/* Microsoft logo */}
        <svg
          className="w-5 h-5"
          viewBox="0 0 21 21"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
        {isSigningIn ? 'Signing in...' : 'Sign in with Microsoft'}
      </button>
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { user, profile, signOut, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setIsSigningOut(false);
  };

  if (isLoading || !user) return null;

  const displayName = profile?.display_name || user.email || 'User';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>
            <div className="p-1">
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LoginButton;
