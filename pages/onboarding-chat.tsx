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
    let newAnswers = { ...answers };
    
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
      display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 600, background: 'white', border: '1px solid #ddd', borderRadius: 8, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', maxHeight: 700 }}>
        <h2 style={{ textAlign: 'center', color: '#333', marginBottom: 20 }}>Welcome to Symbi!</h2>
        <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: 20, paddingRight: 10, borderBottom: '1px solid #eee' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: 12, display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <span style={{ backgroundColor: msg.sender === 'user' ? '#007bff' : '#e9ecef', color: msg.sender === 'user' ? 'white' : '#333', padding: '10px 15px', borderRadius: 18, maxWidth: '75%', lineHeight: '1.4' }}>
                {msg.text}
              </span>
            </div>
          ))}
        </div>
        {error && (
          <div style={{ color: '#dc3545', marginBottom: 10, textAlign: 'center' }}>
            {error}
          </div>
        )}
        {/* Input for each step except availability/completed */}
        {stepIdx < 4 && !waitingForResponse && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', marginTop: 'auto' }}>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={SYSTEM_PROMPTS[stepIdx].step === 'interests' ? 'Enter interests (e.g., hiking, coding)' : SYSTEM_PROMPTS[stepIdx].step === 'skillsWanted' ? 'Enter skills you want to learn' : 'Enter hot takes'}
              style={{ flexGrow: 1, padding: 12, marginRight: 10, borderRadius: 20, border: '1px solid #ccc', fontSize: '1rem' }}
              disabled={isSubmitting}
            />
            <button type="submit" style={{ padding: '12px 20px', borderRadius: 20, border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer', fontSize: '1rem', transition: 'background-color 0.2s' }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Send'}
            </button>
          </form>
        )}
        {/* Autosuggestions */}
        {suggestions.length > 0 && (
          <div style={{ marginTop: 10, border: '1px solid #eee', borderRadius: 8, maxHeight: 150, overflowY: 'auto' }}>
            {suggestions.map(s => (
              <div key={s} onClick={() => addSuggestionToInput(s)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #f7f7f7' }}>
                {s}
              </div>
            ))}
          </div>
        )}
        {/* Availability grid */}
        {stepIdx === 4 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 10, fontWeight: 600 }}>Select your availability:</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th></th>
                  {AVAIL_DAYS.map(day => <th key={day} style={{ padding: 4, fontWeight: 500 }}>{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {AVAIL_BLOCKS.map(block => (
                  <tr key={block}>
                    <td style={{ fontWeight: 500 }}>{block}</td>
                    {AVAIL_DAYS.map(day => (
                      <td key={day} style={{ textAlign: 'center', padding: 4 }}>
                        <button
                          type="button"
                          style={{
                            width: 28, height: 28, borderRadius: 8, border: '1px solid #ccc', background: (availability[day] || []).includes(block) ? '#007bff' : '#fff', color: (availability[day] || []).includes(block) ? 'white' : '#333', cursor: 'pointer', fontWeight: 600
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
      </div>
    </div>
  );
};

export default OnboardingChat; 