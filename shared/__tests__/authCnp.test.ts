declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

// Minimal unit test to ensure the optional CNP argument is persisted into
// the user profile via createUserProfileAfterSignup.

jest.mock('../firebaseConfig', () => ({
  auth: {},
}));

const mockCreateUserProfileAfterSignup = jest.fn();
jest.mock('../creditService', () => ({
  createUserProfileAfterSignup: (...args: any[]) => mockCreateUserProfileAfterSignup(...args),
}));

jest.mock('../activityLogService', () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockCreateUserWithEmailAndPassword = jest.fn();
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

import { signUpWithEmail } from '../auth';

describe('signUpWithEmail optional CNP', () => {
  it('stores normalized CNP in extraProfileData when provided', async () => {
    const mockUser = { uid: 'uid-123', email: 'test@example.com' };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    await signUpWithEmail('test@example.com', 'password123', undefined, undefined, '1800101-400016');

    expect(mockCreateUserProfileAfterSignup).toHaveBeenCalled();
    const call = mockCreateUserProfileAfterSignup.mock.calls[0];
    expect(call[0]).toEqual(mockUser);
    expect(call[1]).toBe(null);
    expect(call[2]).toEqual(expect.objectContaining({ cnp: '1800101400016' }));
  });
});

