import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useRouter } from 'next/router';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  onboardingCompleted: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  interests?: string[];
  expertise?: string[];
}

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();

  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const signInPromiseRef = useRef<Promise<void> | null>(null);

  const updateUserProfile = async (userId: string) => {
    const userDocRef = doc(db, 'users', userId);
    return onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
    });
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        if (signInPromiseRef.current) {
          try {
            await signInPromiseRef.current;
          } catch {
            // signInPromiseRef should have already set an error if one occurred
          }
        }
        if (unsubscribeProfile) unsubscribeProfile();
        unsubscribeProfile = await updateUserProfile(currentUser.uid);
      } else {
        setUserProfile(null);
        if (errorRef.current === "User profile not found. Please try signing in again." || errorRef.current === "User profile not found. Please try signing in again or complete onboarding.") {
          setError(null);
        }
      }
      setLoading(false);
      setAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  useEffect(() => {
    if (!loading && authReady) {
      if (user && userProfile) {
        if (!userProfile.onboardingCompleted) {
          if (router.pathname !== '/onboarding') {
            router.push('/onboarding');
          }
        } else if (router.pathname === '/onboarding' || router.pathname === '/signin') {
          router.push('/');
        }
      } else if (!user && router.pathname.startsWith('/app')) {
        router.push('/signin');
      }
    }
  }, [user, userProfile, loading, authReady, router]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      signInPromiseRef.current = signInWithPopup(auth, provider).then(() => {});
      await signInPromiseRef.current;
    } catch (err) {
      console.error("Sign in error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during sign in.');
      }
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to sign out.');
      } else {
        setError('An unknown error occurred during sign out.');
      }
    }
  };

  return { user, userProfile, error, loading, authReady, signInWithGoogle, logOut, updateUserProfile };
} 