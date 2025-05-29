import React, { useState } from 'react';
import { useRouter } from 'next/router';

const MOCKED_TAGS = [
  'machine learning', 'deep learning', 'artificial intelligence', 'Pixar deep cuts', 'K-pop fan edits',
  'Cardboard crafts', 'Lamine Yamal', 'web development', 'anime', 'kpop', 'indie music', 'film analysis',
  'sci-fi', 'fantasy', 'marvel', 'star wars', 'harry potter', 'video essays',
];

const SYSTEM_PROMPTS = [
  {
    step: 'welcome',
    text: "Welcome to Symbi! I'm here to help you get started. Let's learn a bit about you so we can match you with the right people."
  },
  {
    step: 'interests',
    text: "What are your interests? Select up to 5 tags or enter your own topics."
  },
  {
    step: 'skillsWanted',
    text: "Which skills would you like to learn? Select up to 5 tags or enter your own topics."
  },
  {
    step: 'hotTakes',
    text: "Share 1-5 fun 'hot take' statements about yourself."
  },
  {
    step: 'availability',
    text: "When are you usually free each week? Select your available time slots."
  }
];

const AVAIL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AVAIL_BLOCKS = ['Morning', 'Afternoon', 'Evening'];

const OnboardingChat: React.FC = () => {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [messages, setMessages] = useState([
    { id: 'system-0', sender: 'system', text: SYSTEM_PROMPTS[0].text }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState({
    interests: [] as string[],
    skillsWanted: [] as string[],
    hotTakes: [] as string[],
    availability: {} as Record<string, string[]>,
  });
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  // Autosuggest for interests/skillsWanted
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (['interests', 'skillsWanted'].includes(SYSTEM_PROMPTS[stepIdx].step)) {
      const lastWord = value.split(/[, ]+/).pop()?.toLowerCase() || '';
      if (lastWord.length > 1) {
        setSuggestions(
          MOCKED_TAGS.filter(tag =>
            tag.toLowerCase().startsWith(lastWord) &&
            !value.toLowerCase().split(/[, ]+/).includes(tag.toLowerCase())
          ).slice(0, 5)
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
    currentTags.pop();
    currentTags.push(suggestion);
    setInputValue(currentTags.join(', ') + ', ');
    setSuggestions([]);
  };

  // Handle chat input submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;
    
    // Input validation
    const currentStep = SYSTEM_PROMPTS[stepIdx].step;
    const tags = inputValue.split(',').map(s => s.trim()).filter(Boolean);
    
    if (currentStep === 'interests' || currentStep === 'skillsWanted') {
      if (tags.length === 0) {
        setError('Please select at least one tag');
        return;
      }
      if (tags.length > 5) {
        setError('You can select up to 5 tags');
        return;
      }
    } else if (currentStep === 'hotTakes') {
      if (tags.length === 0) {
        setError('Please share at least one hot take');
        return;
      }
      if (tags.length > 5) {
        setError('You can share up to 5 hot takes');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    let nextStepIdx = stepIdx;
    const newAnswers = { ...answers };
    
    if (currentStep === 'interests') {
      newAnswers.interests = tags;
      nextStepIdx++;
    } else if (currentStep === 'skillsWanted') {
      newAnswers.skillsWanted = tags;
      nextStepIdx++;
    } else if (currentStep === 'hotTakes') {
      newAnswers.hotTakes = tags;
      nextStepIdx++;
    }
    
    setAnswers(newAnswers);
    setInputValue('');
    setSuggestions([]);
    setIsSubmitting(false);
    
    if (nextStepIdx < SYSTEM_PROMPTS.length) {
      setWaitingForResponse(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: `system-${nextStepIdx}`, sender: 'system', text: SYSTEM_PROMPTS[nextStepIdx].text }]);
        setStepIdx(nextStepIdx);
        setWaitingForResponse(false);
      }, 1000);
    } else {
      setWaitingForResponse(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: 'system-done', sender: 'system', text: 'Thank you for completing your profile! Redirecting you to your dashboard...' }]);
        setTimeout(() => router.push('/dashboard'), 1800);
      }, 1000);
    }
  };

  // Handle availability grid
  const handleToggleBlock = (day: string, block: string) => {
    setAvailability(prev => {
      const prevBlocks = prev[day] || [];
      const newBlocks = prevBlocks.includes(block)
        ? prevBlocks.filter(b => b !== block)
        : [...prevBlocks, block];
      return { ...prev, [day]: newBlocks };
    });
  };

  const handleAvailabilitySubmit = () => {
    setAnswers(a => ({ ...a, availability }));
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: '[Availability Selected]' }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: 'system-done', sender: 'system', text: 'Thank you for completing your profile! Redirecting you to your dashboard...' }]);
      setTimeout(() => router.push('/dashboard'), 1800);
    }, 1000);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#202123', fontFamily: 'Arial, sans-serif', padding: 20,
      color: '#e0e0e0', // Lighter text color for dark background
    }}>
      <div style={{
        width: '100%%',
        maxWidth: 768, // Increased max width to better match the image
        background: '#343541', // Darker background for the chat container
        border: '1px solid #555', // Slightly lighter border
        borderRadius: 8,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', // More prominent shadow
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 40px)',
        maxHeight: 800, // Adjusted max height
        overflow: 'hidden', // Hide scrollbar for main container
      }}>
        <div style={{
          flexGrow: 1,
          overflowY: 'auto', // Keep scroll for messages
          marginBottom: 20,
          paddingRight: 10,
          paddingLeft: 10, // Add padding for message alignment
          // Removed borderBottom as it's not in the image
        }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              marginBottom: 15, // Increased space between messages
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              wordBreak: 'break-word', // Prevent long words from overflowing
            }}>
              <span style={{
                backgroundColor: msg.sender === 'user' ? '#007bff' : '#444654', // Blue for user, darker grey for system
                color: msg.sender === 'user' ? 'white' : '#e0e0e0', // White text for user, light grey for system
                padding: '12px 16px', // Adjusted padding
                borderRadius: 20, // More rounded corners
                maxWidth: '75%%',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap', // Preserve line breaks in text
              }}>
                {msg.text}
              </span>
            </div>
          ))}
          {/* Add a loading indicator if waiting for response */}
          {waitingForResponse && (
             <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'flex-start' }}>
               <span style={{ backgroundColor: '#444654', color: '#e0e0e0', padding: '12px 16px', borderRadius: 20, maxWidth: '75%%', lineHeight: '1.5', fontStyle: 'italic' }}>
                 Typing...
               </span>
             </div>
          )}
        </div>
        {error && (
          <div style={{ color: '#ff6b6b', marginBottom: 10, textAlign: 'center' }}>
            {error}
          </div>
        )}
        {/* Input for each step except availability/completed */}
        {stepIdx < 4 && !waitingForResponse && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', marginTop: 'auto', alignItems: 'center' }}>
            {/* Add paperclip icon placeholder */}
            <div style={{ color: '#888', fontSize: 24, marginRight: 10 }}>📎</div>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={'Message ChatGPT'} // Updated placeholder text
              style={{
                flexGrow: 1,
                padding: 12,
                marginRight: 10,
                borderRadius: 20,
                border: 'none', // Remove border
                backgroundColor: '#444654', // Dark background for input
                color: '#e0e0e0', // Light text color
                fontSize: '1rem',
                outline: 'none', // Remove outline on focus
                paddingLeft: 15, // Add padding to the left
              }}
              disabled={isSubmitting}
            />
            <button type="submit" style={{
              padding: '12px 15px', // Adjusted padding for icon-like button
              borderRadius: 20,
              border: 'none',
              backgroundColor: '#1e90ff', // Blue send button
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background-color 0.2s',
              display: 'flex', // Use flex to center content (if icon added later)
              alignItems: 'center',
              justifyContent: 'center',
            }} disabled={isSubmitting}>
              {/* Using text for now, could be replaced with an icon */}
              {isSubmitting ? '...' : '▲'} {/* Use triangle up for send icon look */}
            </button>
          </form>
        )}
        {/* Autosuggestions */}
        {suggestions.length > 0 && (
          <div style={{ marginTop: 10, border: '1px solid #555', borderRadius: 8, maxHeight: 150, overflowY: 'auto', background: '#343541' }}>
            {suggestions.map(s => (
              <div key={s} onClick={() => addSuggestionToInput(s)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #555', color: '#e0e0e0' }}>
                {s}
              </div>
            ))}
          </div>
        )}
        {/* Availability grid (kept for functionality, hidden if not step 4) */}
        {stepIdx === 4 && (
          <div style={{ marginTop: 20, color: '#e0e0e0' }}>
            <div style={{ marginBottom: 10, fontWeight: 600 }}>Select your availability:</div>
            <table style={{ borderCollapse: 'collapse', width: '100%%', color: '#e0e0e0' }}>
              <thead>
                <tr>
                  <th style={{ padding: 4, fontWeight: 500 }}></th> {/* Empty header for row titles */}
                  {AVAIL_DAYS.map(day => <th key={day} style={{ padding: 4, fontWeight: 500 }}>{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {AVAIL_BLOCKS.map(block => (
                  <tr key={block}>
                    <td style={{ fontWeight: 500, padding: '4px 8px' }}>{block}</td> {/* Padding for row titles */}
                    {AVAIL_DAYS.map(day => (
                      <td key={day} style={{ textAlign: 'center', padding: 4 }}>
                        <button
                          type="button"
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: '1px solid #ccc', background: (availability[day] || []).includes(block) ? '#007bff' : '#fff', color: (availability[day] || []).includes(block) ? 'white' : '#333', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' // Slightly larger buttons
                          }}
                          onClick={() => handleToggleBlock(day, block)}
                        >
                          {block[0]}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={handleAvailabilitySubmit} style={{ marginTop: 18, padding: '10px 24px', borderRadius: 20, border: 'none', backgroundColor: '#007bff', color: 'white', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
              Save Availability
            </button>
          </div>
        )}

        {/* Disclaimer Text */}
        {!waitingForResponse && stepIdx < 5 && ( // Show disclaimer until the final completion message
           <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#888', marginTop: 15 }}>
             ChatGPT can make mistakes. Consider checking important information.
           </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingChat; 