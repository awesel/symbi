// lib/useAuth.ts
import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

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

  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data() as UserProfile);
          if (errorRef.current === "User profile not found. Please try signing in again.") {
            setError(null); // Clear the specific error if profile is now found
          }
        } else {
          // User is authenticated, but profile document not found.
          // This could be a transient issue if signInWithGoogle just created it.
          // Set error, but DO NOT set userProfile to null here.
          // This prevents wiping the profile state if signInWithGoogle just set it.
          setError("User profile not found. Please try signing in again.");
        }
      } else {
        // User is null (logged out)
        setUserProfile(null);
        // Optionally clear the error when user logs out
        if (errorRef.current === "User profile not found. Please try signing in again.") {
            setError(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, db]); // Dependencies for setting up the listener

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'stanford.edu' });
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user && result.user.email && result.user.email.endsWith('@stanford.edu')) {
        const userDocRef = doc(db, 'users', result.user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // New user, create profile
          const newUserProfile: UserProfile = {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            onboardingCompleted: false,
            createdAt: serverTimestamp() as Timestamp, // Will be converted by Firestore
            lastLoginAt: serverTimestamp() as Timestamp, // Will be converted by Firestore
          };
          await setDoc(userDocRef, newUserProfile);
          setUserProfile(newUserProfile);
        } else {
          // Existing user, update last login time and set profile
          await setDoc(userDocRef, { lastLoginAt: serverTimestamp() }, { merge: true });
          setUserProfile(userDocSnap.data() as UserProfile);
        }
        setUser(result.user); // Firebase user object
      } else {
        await signOut(auth); // Sign out if not a Stanford email
        setUser(null);
        setUserProfile(null);
        setError('Please sign in with your @stanford.edu email address.');
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(err.message || 'Failed to sign in with Google.');
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: any) {
      console.error("Sign out error:", err);
      setError(err.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return { user, userProfile, error, loading, signInWithGoogle, logOut };
} 