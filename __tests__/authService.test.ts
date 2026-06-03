import { login, sendPasswordReset, signUp } from '@/hooks/authService';
import {
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
} from 'firebase/auth';

// 1. Mock the entire firebase/auth package wrappers
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

// Mock the underlying local firebaseConfig auth export instance
jest.mock('@/hooks/firebaseConfig', () => ({
  auth: {},
}));

describe('Firebase Authentication Service Test Suite (Shreeya)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- UNIT TEST 1 ---
  it('should throw an error message if the registration fails due to weak password or invalid email', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
      message: 'Firebase: Password should be at least 6 characters (auth/weak-password).',
    });

    await expect(signUp('test@stemmlab.com', '123')).rejects.toBe(
      'Firebase: Password should be at least 6 characters (auth/weak-password).'
    );
  });

  // --- UNIT TEST 2 ---
  it('should throw a clean error string message if credentials match an invalid user during login', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
      message: 'Firebase: Error (auth/wrong-password).',
    });

    await expect(login('user@stemmlab.com', 'wrongpassword')).rejects.toBe(
      'Firebase: Error (auth/wrong-password).'
    );
  });

  // --- INTEGRATION TEST (Balanced to 1 explicit outcome check) ---
  it('should successfully handle user recovery workflows under ideal connection scenarios', async () => {
    (sendPasswordResetEmail as jest.Mock).mockResolvedValue(true);

    const resetSentStatus = await sendPasswordReset('success@stemmlab.com');
    expect(resetSentStatus).toBe(true);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });
});