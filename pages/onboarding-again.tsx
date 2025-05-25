import React, { useState, useEffect, FormEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext'; // Assuming this is the correct path for your AuthContext
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

const OnboardingAgainPage: React.FC = () => {
  const { user, userProfile, loading: authLoading, error: authError } = useAuth();
  const router = useRouter();

  const [interestsArr, setInterestsArr] = useState<string[]>([]);
  const [expertiseArr, setExpertiseArr] = useState<string[]>([]);
  const [interestsInput, setInterestsInput] = useState('');
  const [expertiseInput, setExpertiseInput] = useState('');
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
      setInterestsArr(userProfile.interests || []);
      setExpertiseArr(userProfile.expertise || []);
      setInterestsInput('');
      setExpertiseInput('');
    }
  }, [user, userProfile, authLoading, authError, router]);

  const handleBubbleInput = (value: string, setArr: (arr: string[]) => void, arr: string[], setInput: (val: string) => void) => {
    // Split on comma, trim, and add to array if not empty or duplicate
    const parts = value.split(',');
    if (parts.length > 1) {
      const newTags = parts.slice(0, -1).map(p => p.trim()).filter(p => p && !arr.includes(p));
      if (newTags.length > 0) setArr([...arr, ...newTags]);
      setInput(parts[parts.length - 1]);
    } else {
      setInput(value);
    }
  };

  const handleBubbleKeyDown = (e: KeyboardEvent<HTMLInputElement>, setArr: (arr: string[]) => void, arr: string[], input: string, setInput: (val: string) => void) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      if (!arr.includes(input.trim())) {
        setArr([...arr, input.trim()]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && arr.length > 0) {
      // Remove last tag if input is empty
      setArr(arr.slice(0, -1));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);

    // Combine arrays and any remaining input
    const interestsArray = [...interestsArr, ...((interestsInput.trim() && !interestsArr.includes(interestsInput.trim())) ? [interestsInput.trim()] : [])];
    const expertiseArray = [...expertiseArr, ...((expertiseInput.trim() && !expertiseArr.includes(expertiseInput.trim())) ? [expertiseInput.trim()] : [])];

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
          <input
            id="interests"
            value={interestsInput}
            onChange={e => handleBubbleInput(e.target.value, setInterestsArr, interestsArr, setInterestsInput)}
            onKeyDown={e => handleBubbleKeyDown(e, setInterestsArr, interestsArr, interestsInput, setInterestsInput)}
            placeholder="e.g., artificial intelligence, history, hiking"
            style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', padding: '8px', fontSize: '1em', marginBottom: '8px' }}
            disabled={isSubmitting}
          />
          {/* Bubbles for interests */}
          <div style={{ marginTop: '0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {interestsArr.map((item, idx) => (
              <span key={idx} style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#e0e7ff',
                color: '#3730a3',
                borderRadius: '16px',
                padding: '4px 12px',
                fontSize: '0.95em',
                marginRight: '4px',
                marginBottom: '4px',
              }}>
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => {
                    setInterestsArr(interestsArr.filter((_, i) => i !== idx));
                  }}
                  style={{
                    marginLeft: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#a21caf',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1em',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="expertise" style={{ display: 'block', marginBottom: '5px' }}>
            Your Expertise/Skills (comma-separated):
          </label>
          <input
            id="expertise"
            value={expertiseInput}
            onChange={e => handleBubbleInput(e.target.value, setExpertiseArr, expertiseArr, setExpertiseInput)}
            onKeyDown={e => handleBubbleKeyDown(e, setExpertiseArr, expertiseArr, expertiseInput, setExpertiseInput)}
            placeholder="e.g., Python, project management, public speaking"
            style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px', padding: '8px', fontSize: '1em', marginBottom: '8px' }}
            disabled={isSubmitting}
          />
          {/* Bubbles for expertise */}
          <div style={{ marginTop: '0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {expertiseArr.map((item, idx) => (
              <span key={idx} style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#fef9c3',
                color: '#92400e',
                borderRadius: '16px',
                padding: '4px 12px',
                fontSize: '0.95em',
                marginRight: '4px',
                marginBottom: '4px',
              }}>
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => {
                    setExpertiseArr(expertiseArr.filter((_, i) => i !== idx));
                  }}
                  style={{
                    marginLeft: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#b45309',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1em',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
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