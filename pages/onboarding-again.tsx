import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext'; // Assuming this is the correct path for your AuthContext
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

const OnboardingAgainPage: React.FC = () => {
  const { user, userProfile, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  const [interests, setInterests] = useState('');
  const [expertise, setExpertise] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return; // Wait until authentication loading is complete
    }

    if (authError) {
        return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (userProfile) {
      setInterests(userProfile.interests?.join(', ') || '');
      setExpertise(userProfile.expertise?.join(', ') || '');
    }
  }, [user, userProfile, authLoading, authError, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);

    const interestsArray = interests.split(',').map(item => item.trim()).filter(item => item);
    const expertiseArray = expertise.split(',').map(item => item.trim()).filter(item => item);

    const userDocRef = doc(db, 'users', user.uid);

    try {
      await updateDoc(userDocRef, {
        interests: interestsArray,
        expertise: expertiseArray,
        lastLoginAt: serverTimestamp() 
      });
      setMessage('Profile updated successfully!');
      // The onSnapshot listener in useAuth will automatically update the profile
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <p>Loading authentication...</p>;
  }

  if (authError) {
    return <p>Authentication Error: {authError}. You might need to <Link href="/login">login</Link> again.</p>;
  }

  if (!user) {
    return <p>No user session. Redirecting to login...</p>;
  }

  if (!userProfile) {
    return <p>Loading user profile...</p>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Edit Your Profile</h1>
      <p>Update your interests and expertise to help us find better matches for you.</p>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="interests" style={{ display: 'block', marginBottom: '5px' }}>
            Your Interests (comma-separated):
          </label>
          <textarea
            id="interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g., artificial intelligence, history, hiking"
            rows={3}
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="expertise" style={{ display: 'block', marginBottom: '5px' }}>
            Your Expertise/Skills (comma-separated):
          </label>
          <textarea
            id="expertise"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            placeholder="e.g., Python, project management, public speaking"
            rows={3}
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        {message && <p style={{ color: message.startsWith('Failed') ? 'red' : 'green', marginBottom: '15px' }}>{message}</p>}

        <button 
          type="submit" 
          disabled={isSubmitting}
          style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
      <div style={{ marginTop: '20px' }}>
        <Link href="/">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default OnboardingAgainPage; 