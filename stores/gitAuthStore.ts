import { create } from 'zustand';

interface Credentials {
  username: string;
  token: string;
}

type AuthPromise = {
  resolve: (credentials: Credentials) => void;
  reject: (reason?: any) => void;
} | null;

interface GitAuthState {
  isAuthModalOpen: boolean;
  authPromise: AuthPromise;
  promptForCredentials: () => Promise<Credentials>;
  closeAuthModal: (credentials?: Credentials) => void;
}

export const useGitAuthStore = create<GitAuthState>((set, get) => ({
  isAuthModalOpen: false,
  authPromise: null,

  promptForCredentials: () => {
    return new Promise<Credentials>((resolve, reject) => {
      set({
        isAuthModalOpen: true,
        authPromise: { resolve, reject },
      });
    });
  },

  closeAuthModal: (credentials) => {
    const { authPromise } = get();
    if (authPromise) {
      if (credentials) {
        authPromise.resolve(credentials);
      } else {
        authPromise.reject(new Error('Authentication cancelled by user.'));
      }
    }
    set({ isAuthModalOpen: false, authPromise: null });
  },
}));
