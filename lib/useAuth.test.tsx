import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from './useAuth';
import { auth } from './firebase'; // Mock this
import { useRouter } from 'next/router'; // Mock this

// Mock Firebase and Next.js router
jest.mock('./firebase', () => ({
  auth: {
    onAuthStateChanged: jest.fn(),
    signInWithPopup: jest.fn(),
    signOut: jest.fn(),
    currentUser: null,
  },
  db: {}, // Mock db if needed for other functions
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockRouterPush = jest.fn();
const mockOnAuthStateChanged = auth.onAuthStateChanged as jest.Mock;
const mockSignInWithPopup = auth.signInWithPopup as jest.Mock;
const mockSignOut = auth.signOut as jest.Mock;

describe('useAuth Hook', () => {
  let mockRouter: { push: jest.Mock; pathname: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter = { push: mockRouterPush, pathname: '/' };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    // @ts-ignore
    auth.currentUser = null; 
    // Reset userProfile state for each test indirectly by controlling onAuthStateChanged
  });

  // Helper to simulate auth state change
  const simulateAuthStateChange = (user: any, userProfileData?: any) => {
    let onSnapshotCallback: ((snapshot: any) => void) | null = null;
    
    // Mock onSnapshot to capture its callback
    const mockDoc = jest.fn().mockReturnValue({
        onSnapshot: (callback: (snapshot: any) => void) => {
            onSnapshotCallback = callback;
            return jest.fn(); // Return an unsubscribe function for onSnapshot
        }
    });
    jest.mock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'), // Import and retain default exports
        doc: () => mockDoc(), // Mock doc to control onSnapshot
        getDoc: jest.fn().mockResolvedValue({
            exists: () => !!userProfileData,
            data: () => userProfileData
        }),
        setDoc: jest.fn().mockResolvedValue(undefined),
        serverTimestamp: jest.fn(() => new Date()), // Mock serverTimestamp
    }));


    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback(user); // Simulate Firebase auth state change
      return jest.fn(); // Return an unsubscribe function for onAuthStateChanged
    });
    
    // If a user is provided and onSnapshotCallback was set up, simulate profile update
    if (user && onSnapshotCallback && userProfileData) {
        act(() => {
            onSnapshotCallback!({ exists: () => true, data: () => userProfileData });
        });
    } else if (user && onSnapshotCallback) {
         act(() => {
            onSnapshotCallback!({ exists: () => false, data: () => null });
        });
    }
  };


  it('should redirect to /onboarding if user is new and onboarding is not completed', async () => {
    const mockUser = { uid: 'test-uid', email: 'test@stanford.edu' };
    const mockProfile = { uid: 'test-uid', onboardingCompleted: false };
    
    simulateAuthStateChange(mockUser, mockProfile);

    const { result, waitForNextUpdate } = renderHook(() => useAuth());
    
    await act(async () => {
        // Wait for authReady and userProfile to be set
        await waitForNextUpdate(); 
        await waitForNextUpdate();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/onboarding');
  });

  it('should redirect to / if user exists and onboarding is completed', async () => {
    mockRouter.pathname = '/onboarding'; // Simulate user is on onboarding page
    const mockUser = { uid: 'test-uid', email: 'test@stanford.edu' };
    const mockProfile = { uid: 'test-uid', onboardingCompleted: true };

    simulateAuthStateChange(mockUser, mockProfile);

    const { result, waitForNextUpdate } = renderHook(() => useAuth());

    await act(async () => {
      await waitForNextUpdate();
      await waitForNextUpdate();
    });
    
    expect(mockRouterPush).toHaveBeenCalledWith('/');
  });

  it('should not redirect if user is on /onboarding and onboarding is not completed', async () => {
    mockRouter.pathname = '/onboarding';
    const mockUser = { uid: 'test-uid', email: 'test@stanford.edu' };
    const mockProfile = { uid: 'test-uid', onboardingCompleted: false };

    simulateAuthStateChange(mockUser, mockProfile);

    const { result, waitForNextUpdate } = renderHook(() => useAuth());
    
    await act(async () => {
      await waitForNextUpdate();
      await waitForNextUpdate();
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });


  it('should redirect to /signin if user is not authenticated and tries to access a protected route', async () => {
    mockRouter.pathname = '/app/dashboard'; // Example protected route
    simulateAuthStateChange(null); // No user

    const { result, waitForNextUpdate } = renderHook(() => useAuth());

    await act(async () => {
      await waitForNextUpdate(); // for loading and authReady
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/signin');
  });

  // Test for signInWithGoogle successful new user
  it('signInWithGoogle should create new user and redirect to /onboarding', async () => {
    const newUser = { uid: 'new-uid', email: 'new@stanford.edu', displayName: 'New User', photoURL: 'new.jpg' };
    mockSignInWithPopup.mockResolvedValue({ user: newUser });
    
    // Mock getDoc to simulate user not existing
    const { getDoc } = require('firebase/firestore');
    getDoc.mockResolvedValue({ exists: () => false, data: () => null });


    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    
    // Simulate auth state change after sign-in
    // This part is tricky because signInWithGoogle itself triggers onAuthStateChanged internally.
    // For testing, we might need to manually trigger the profile update or adjust the mock.
    act(() => {
        const authCallback = mockOnAuthStateChanged.mock.calls[0][0];
        authCallback(newUser); // Manually call the auth callback with the new user
    });
     // Simulate the profile being set via onSnapshot after user creation
    const { onSnapshot } = require('firebase/firestore').doc();
    const onSnapshotCallback = onSnapshot.mock.calls[0][0];
     act(() => {
        onSnapshotCallback({
            exists: () => true,
            data: () => ({ uid: newUser.uid, email: newUser.email, onboardingCompleted: false })
        });
    });


    expect(mockRouterPush).toHaveBeenCalledWith('/onboarding');
  });

}); 