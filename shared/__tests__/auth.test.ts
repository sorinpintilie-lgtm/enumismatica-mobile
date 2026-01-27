declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock('../firebaseConfig', () => ({
  auth: {},
}));

const mockAuth = {
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
};

jest.mock('firebase/auth', () => mockAuth);

import { signInWithEmail, signUpWithEmail, signInWithGoogle, logout, onAuthStateChange } from '../auth';

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signInWithEmail', () => {
    it('should sign in successfully with valid credentials', async () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      const result = await signInWithEmail('test@example.com', 'password123');

      expect(result).toEqual({ user: mockUser, error: null });
      expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password123');
    });

    it('should return error for empty email', async () => {
      const result = await signInWithEmail('', 'password123');

      expect(result).toEqual({ user: null, error: 'Email and password are required' });
      expect(mockAuth.signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should return error for invalid email format', async () => {
      const result = await signInWithEmail('invalid-email', 'password123');

      expect(result).toEqual({ user: null, error: 'Invalid email format' });
      expect(mockAuth.signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should return error on Firebase failure', async () => {
      mockAuth.signInWithEmailAndPassword.mockRejectedValue(new Error('Firebase error'));

      const result = await signInWithEmail('test@example.com', 'password123');

      expect(result).toEqual({ user: null, error: 'Firebase error' });
    });
  });

  describe('signUpWithEmail', () => {
    it('should sign up successfully with valid credentials', async () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockAuth.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      const result = await signUpWithEmail('test@example.com', 'password123');

      expect(result).toEqual({ user: mockUser, error: null });
      expect(mockAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password123');
    });

    it('should sign up successfully with identity document data', async () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockAuth.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      const result = await signUpWithEmail('test@example.com', 'password123', undefined, {
        type: 'ci',
        number: 'AB123456',
      });

      expect(result).toEqual({ user: mockUser, error: null });
      expect(mockAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@example.com', 'password123');
    });

    it('should return error for empty email', async () => {
      const result = await signUpWithEmail('', 'password123');

      expect(result).toEqual({ user: null, error: 'Email and password are required' });
      expect(mockAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should return error for invalid email format', async () => {
      const result = await signUpWithEmail('invalid-email', 'password123');

      expect(result).toEqual({ user: null, error: 'Invalid email format' });
      expect(mockAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should return error for password too short', async () => {
      const result = await signUpWithEmail('test@example.com', '123');

      expect(result).toEqual({ user: null, error: 'Password must be at least 6 characters' });
      expect(mockAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should return error on Firebase failure', async () => {
      mockAuth.createUserWithEmailAndPassword.mockRejectedValue(new Error('Firebase error'));

      const result = await signUpWithEmail('test@example.com', 'password123');

      expect(result).toEqual({ user: null, error: 'Firebase error' });
    });
  });

  describe('signInWithGoogle', () => {
    it('should sign in with Google successfully', async () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockAuth.signInWithPopup.mockResolvedValue({ user: mockUser });

      const result = await signInWithGoogle();

      expect(result).toEqual({ user: mockUser, error: null });
      expect(mockAuth.signInWithPopup).toHaveBeenCalled();
    });

    it('should return error on Firebase failure', async () => {
      mockAuth.signInWithPopup.mockRejectedValue(new Error('Google sign-in failed'));

      const result = await signInWithGoogle();

      expect(result).toEqual({ user: null, error: 'Google sign-in failed' });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockAuth.signOut.mockResolvedValue();

      const result = await logout();

      expect(result).toEqual({ error: null });
      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('should return error on Firebase failure', async () => {
      mockAuth.signOut.mockRejectedValue(new Error('Logout failed'));

      const result = await logout();

      expect(result).toEqual({ error: 'Logout failed' });
    });
  });

  describe('onAuthStateChange', () => {
    it('should call onAuthStateChanged with callback', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockAuth.onAuthStateChanged.mockReturnValue(mockUnsubscribe);

      const unsubscribe = onAuthStateChange(mockCallback);

      expect(mockAuth.onAuthStateChanged).toHaveBeenCalledWith({}, mockCallback);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });
});
