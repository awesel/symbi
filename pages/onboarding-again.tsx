import React, { useState, useEffect, KeyboardEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext'; // Assuming this is the correct path for your AuthContext
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import Head from 'next/head';

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

  const handleSaveAndNavigate = async () => {
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
      router.push('/dashboard');
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage('Failed to update profile. Please try again.');
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
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #2D1B69 0%, #4B2A9D 100%)',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <Head>
        <title>Update Your Interests - Symbi</title>
      </Head>

      <div style={{
        width: '100%',
        maxWidth: '700px',
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        marginTop: '32px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#1A202C',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Update Your Interests 🔧
        </h1>
        
        <p style={{
          color: '#888',
          textAlign: 'center',
          marginBottom: '32px',
          fontSize: '16px'
        }}>
          We&apos;ll use your interests and skills to find the best matches.
        </p>
        
        <form onSubmit={(e) => { e.preventDefault(); handleSaveAndNavigate(); }}>
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="interests" style={{
              display: 'block',
              marginBottom: '8px',
              color: '#4A5568',
              fontWeight: '500'
            }}>
              Your Interests
            </label>
            <input
              id="interests"
              value={interestsInput}
              onChange={e => handleBubbleInput(e.target.value, setInterestsArr, interestsArr, setInterestsInput)}
              onKeyDown={e => handleBubbleKeyDown(e, setInterestsArr, interestsArr, interestsInput, setInterestsInput)}
              placeholder="Type interests and press Enter or comma to add"
              className="interest-input"
              style={{
                width: '100%',
                border: '2px solid #E2E8F0',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '16px',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              disabled={isSubmitting}
            />
            <div style={{
              marginTop: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {interestsArr.map((item, idx) => (
                <span key={idx} className="interest-tag" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '9999px',
                  padding: '6px 12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  {item}
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() => {
                      setInterestsArr(interestsArr.filter((_, i) => i !== idx));
                    }}
                    className="remove-button"
                    style={{
                      marginLeft: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: '#4B2A9D',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      lineHeight: 1,
                      padding: '0 4px'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label htmlFor="expertise" style={{
              display: 'block',
              marginBottom: '8px',
              color: '#4A5568',
              fontWeight: '500'
            }}>
              Your Expertise/Skills
            </label>
            <input
              id="expertise"
              value={expertiseInput}
              onChange={e => handleBubbleInput(e.target.value, setExpertiseArr, expertiseArr, setExpertiseInput)}
              onKeyDown={e => handleBubbleKeyDown(e, setExpertiseArr, expertiseArr, expertiseInput, setExpertiseInput)}
              placeholder="Type skills and press Enter or comma to add"
              className="expertise-input"
              style={{
                width: '100%',
                border: '2px solid #E2E8F0',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '16px',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              disabled={isSubmitting}
            />
            <div style={{
              marginTop: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {expertiseArr.map((item, idx) => (
                <span key={idx} className="expertise-tag" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '9999px',
                  padding: '6px 12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  {item}
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() => {
                      setExpertiseArr(expertiseArr.filter((_, i) => i !== idx));
                    }}
                    className="remove-button"
                    style={{
                      marginLeft: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: '#92400E',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      lineHeight: 1,
                      padding: '0 4px'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              backgroundColor: message.startsWith('Failed') ? '#FEE2E2' : '#DCFCE7',
              color: message.startsWith('Failed') ? '#991B1B' : '#166534',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}

          <div style={{
            marginTop: '24px',
            textAlign: 'center'
          }}>
            <button
              onClick={handleSaveAndNavigate}
              disabled={isSubmitting}
              className="back-link"
              style={{
                color: '#4B2A9D',
                textDecoration: 'none',
                fontSize: '16px',
                fontWeight: '500',
                transition: 'all 0.2s',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0'
              }}
            >
              {isSubmitting ? 'Saving...' : '← Back to Dashboard'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .interest-input:focus,
        .expertise-input:focus {
          border-color: #4B2A9D;
          box-shadow: 0 0 0 3px rgba(75, 42, 157, 0.1);
          outline: none;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .back-link:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .interest-tag:hover,
        .expertise-tag:hover {
          transform: scale(1.02);
        }

        .interest-tag {
          background: #E9D5FF;
          color: #4B2A9D;
        }

        .interest-tag:hover {
          background: #D8B4FE;
        }

        .expertise-tag {
          background: #FEF3C7;
          color: #92400E;
        }

        .expertise-tag:hover {
          background: #FDE68A;
        }

        .remove-button {
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .remove-button:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default OnboardingAgainPage; 