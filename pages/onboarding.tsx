import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp, Timestamp, collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  sender: 'system' | 'user';
  text: string;
  timestamp: Timestamp;
}

// Mocked tags for autofill - replace with actual Firestore fetching
const MOCKED_TAGS = [
  // STEM
  'machine learning', 'deep learning', 'artificial intelligence', 'natural language processing',
  'computer vision', 'web development', 'frontend', 'backend', 'full stack',
  'data science', 'data engineering', 'statistics', 'mathematics', 'calculus', 'linear algebra',
  'physics', 'quantum computing', 'astrophysics', 'chemistry', 'biology', 'neuroscience',
  'robotics', 'embedded systems', 'blockchain', 'cryptography', 'computer graphics', 'game dev',
  'AR/VR', 'network security', 'ethical hacking', 'cloud computing', 'devops',

  // Social Sciences
  'economics', 'macroeconomics', 'microeconomics', 'behavioral economics', 'psychology',
  'sociology', 'anthropology', 'political science', 'international relations', 'law',

  // Humanities
  'philosophy', 'ethics', 'history', 'classics', 'literature', 'religious studies', 'linguistics',

  // Arts & Creative
  'writing', 'poetry', 'film', 'screenwriting', 'theater', 'acting', 'painting', 'sculpture',
  'graphic design', 'photography', 'animation', 'music', 'music production', 'djing',
  'singing', 'songwriting', 'fashion design', 'interior design', 'architecture',

  // Languages
  'spanish', 'french', 'german', 'chinese', 'japanese', 'korean', 'latin', 'greek', 'arabic',

  // Career & Productivity
  'entrepreneurship', 'startups', 'venture capital', 'product management',
  'consulting', 'finance', 'investment banking', 'trading', 'marketing', 'design thinking',
  'time management', 'note-taking', 'public speaking', 'resume writing', 'interview prep',

  // Hobbies
  'gaming', 'chess', 'poker', 'board games', 'dungeons & dragons', 'cooking',
  'baking', 'hiking', 'camping', 'photography', 'journaling', 'gardening', 'bird watching',
  'travel', 'vlogging', 'blogging', 'calligraphy', 'origami',

  // Fitness & Wellness
  'gym', 'bodybuilding', 'calisthenics', 'powerlifting', 'yoga', 'meditation', 'nutrition',
  'mental health', 'sleep science', 'running', 'cycling', 'rock climbing', 'martial arts',

  // Pop Culture
  'anime', 'manga', 'kpop', 'hip hop', 'indie music', 'film analysis', 'standup comedy',
  'sci-fi', 'fantasy', 'marvel', 'star wars', 'harry potter', 'video essays',

  // Miscellaneous
  '3D printing', 'urban planning', 'space exploration', 'sustainability', 'climate change',
  'philanthropy', 'education reform', 'e-sports', 'quantified self', 'biohacking'
];

const OnboardingPage: React.FC = () => {
  const { user, userProfile, loading: authLoading, error: authError, updateUserProfile } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<'interests' | 'expertise' | 'completed'>('interests');
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>(MOCKED_TAGS); // Later fetch from Firestore
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch actual tags from Firestore
    const fetchTags = async () => {
      try {
        const tagsCollectionRef = collection(db, 'tags_used');
        const querySnapshot = await getDocs(tagsCollectionRef);
        const fetchedTags: string[] = [];
        querySnapshot.forEach(doc => {
          // Assuming each document in 'tags_used' has a 'name' field for the tag
          if (doc.data().name) {
            fetchedTags.push(doc.data().name as string);
          }
        });
        if (fetchedTags.length > 0) {
            setAllTags(fetchedTags);
            console.log("Fetched tags:", fetchedTags); // For debugging
        } else {
            console.log("No tags fetched, using mocked tags."); // For debugging
            setAllTags(MOCKED_TAGS); // Fallback to mocked if firestore is empty
        }
      } catch (error) {
        console.error("Error fetching tags:", error);
        setAllTags(MOCKED_TAGS); // Fallback to mocked tags on error
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user || authError) {
        router.push('/login');
      } else if (userProfile?.onboardingCompleted && currentStep !== 'completed') {
        router.push('/'); // Already onboarded
      }
    }
  }, [user, userProfile, authLoading, authError, router, currentStep]);

  useEffect(() => {
    if (currentStep === 'interests' && messages.length === 0) {
      setMessages([
        {
          id: 'system1',
          sender: 'system',
          text: "What are you curious about, but not an expert in? Please enter a comma-separated list (e.g., machine learning, history, hiking).",
          timestamp: serverTimestamp() as Timestamp
        }
      ]);
    } else if (currentStep === 'expertise' && messages.find(m => m.id === 'system2') === undefined) {
      setMessages(prev => [...prev, {
        id: 'system2',
        sender: 'system',
        text: "Great! Now, what are you knowledgeable about? Please enter a comma-separated list (e.g., Python, project management, public speaking).",
        timestamp: serverTimestamp() as Timestamp
      }]);
    }
  }, [currentStep, messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value) {
      const lastWord = value.split(/[, ]+/).pop()?.toLowerCase() || '';
      if(lastWord.length > 1) { // Only show suggestions if input is more than one char
        setSuggestions(
            allTags.filter(tag => 
                tag.toLowerCase().startsWith(lastWord) && 
                !value.toLowerCase().split(/[, ]+/).includes(tag.toLowerCase()) // Don't suggest already typed tags
            ).slice(0, 5) // Limit suggestions
        );
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const addSuggestionToInput = (suggestion: string) => {
    const currentTags = inputValue.split(',').map(t => t.trim()).filter(t => t);
    currentTags.pop(); // Remove the potentially incomplete tag
    currentTags.push(suggestion);
    setInputValue(currentTags.join(', ') + ', ');
    setSuggestions([]);
    // Focus input if possible - requires ref
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user || !userProfile || isSubmitting) return;
    setIsSubmitting(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: inputValue,
      timestamp: serverTimestamp() as Timestamp
    };
    setMessages(prev => [...prev, userMessage]);

    const items = inputValue.split(',').map(item => item.trim()).filter(item => item);
    const userDocRef = doc(db, 'users', user.uid);

    console.log(`Submitting for step: ${currentStep}. Items:`, items);

    try {
      if (currentStep === 'interests') {
        await updateDoc(userDocRef, {
          interests: arrayUnion(...items),
          lastLoginAt: serverTimestamp() // Also update last login/activity time
        });
        console.log("Interests updated in Firestore."); // Debug log
        setCurrentStep('expertise');
      } else if (currentStep === 'expertise') {
        await updateDoc(userDocRef, {
          expertise: arrayUnion(...items),
          onboardingCompleted: true,
          lastLoginAt: serverTimestamp()
        });
        console.log("Expertise updated and onboardingCompleted set to true in Firestore."); // Debug log
        // Update local userProfile state
        if (userProfile) {
          userProfile.onboardingCompleted = true;
          userProfile.expertise = [...(userProfile.expertise || []), ...items];
        }
        // Refresh user profile from Firestore
        await updateUserProfile(user.uid);
        setCurrentStep('completed');
        // Optionally, show a success message before redirecting
        setMessages(prev => [...prev, {
          id: 'system3',
          sender: 'system',
          text: "Thanks for sharing! You are all set up. Redirecting you now...",
          timestamp: serverTimestamp() as Timestamp
        }]);
        console.log("Redirecting to homepage in 2 seconds..."); // Debug log
        setTimeout(() => router.push('/'), 2000);
      }
    } catch (error) {
      console.error("Error updating profile:", error); // Debug log for errors
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        sender: 'system',
        text: "Sorry, there was an error saving your information. Please try again.",
        timestamp: serverTimestamp() as Timestamp
      }]);
    } finally {
      setInputValue('');
      setSuggestions([]);
      setIsSubmitting(false);
    }
  };

  if (authLoading || (!user && !authError)) {
    return <p>Loading authentication...</p>;
  }

  if (authError) {
    return <p>Error: {authError}. Please <Link href="/login"><a>login</a></Link> again.</p>;
  }

  if (!userProfile || (userProfile.onboardingCompleted && currentStep !== 'completed')) {
    // If profile is not loaded yet OR if onboarding is complete and we are not in the 'completed' step message phase,
    // show loading or redirect. This prevents flicker if redirection is happening.
    return <p>Loading user profile...</p>;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start', // Align to top to see messages first
      minHeight: '100vh',
      background: '#f0f2f5',
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      boxSizing: 'border-box' // Ensure padding doesn't expand beyond 100vh
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        display: 'flex', // Added for flex structure
        flexDirection: 'column', // Stack chat area and input form vertically
        height: 'calc(100vh - 40px)', // Adjust height to fit viewport better, considering padding
        maxHeight: '700px' // Max height for the chat box on larger screens
      }}>
        <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '20px'}}>Time to get you set up!</h2>
        <div style={{
          flexGrow: 1, // Allow chat messages area to grow
          overflowY: 'auto',
          marginBottom: '20px',
          paddingRight: '10px', // For scrollbar spacing
          borderBottom: '1px solid #eee'
        }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              marginBottom: '12px',
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <span style={{
                backgroundColor: msg.sender === 'user' ? '#007bff' : '#e9ecef',
                color: msg.sender === 'user' ? 'white' : '#333',
                padding: '10px 15px',
                borderRadius: '18px',
                maxWidth: '75%',
                lineHeight: '1.4'
              }}>
                {msg.text}
              </span>
            </div>
          ))}
        </div>
        {currentStep !== 'completed' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', marginTop: 'auto' }}> {/* Push form to bottom */}
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={currentStep === 'interests' ? 'Enter interests (e.g., AI, history)' : 'Enter expertise (e.g., Python, design)'}
              style={{
                flexGrow: 1,
                padding: '12px',
                marginRight: '10px',
                borderRadius: '20px',
                border: '1px solid #ccc',
                fontSize: '1rem'
              }}
              disabled={isSubmitting}
            />
            <button type="submit" style={{
              padding: '12px 20px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: '#007bff',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background-color 0.2s'
            }} 
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
            disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Send'}
            </button>
          </form>
        )}
        {suggestions.length > 0 && (
          <div style={{
            marginTop: '10px',
            border: '1px solid #eee',
            borderRadius: '8px',
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            {suggestions.map(s => (
              <div key={s} onClick={() => addSuggestionToInput(s)} style={{
                padding: '10px',
                cursor: 'pointer',
                borderBottom: '1px solid #f7f7f7'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage; 