import React from 'react';

interface DiscoverTileProps {
  skill: string;
  // context?: string; // Context can be optional or removed if not used
  onAddInterest: (skill: string) => void;
  isAdded: boolean;
  // Add prop for gradient color or style if needed
}

const DiscoverTile: React.FC<DiscoverTileProps> = ({ skill, /*context,*/ onAddInterest, isAdded }) => {
  // const [showTooltip, setShowTooltip] = useState(false);

  // Function to remove leading emojis and whitespace
  const cleanSkillTitle = (title: string): string => {
    // Regex to match leading emojis and whitespace
    const emojiRegex = /^(\p{Emoji}\s*)+/u;
    return title.replace(emojiRegex, '').trim();
  };

  const displayedSkill = cleanSkillTitle(skill);

  return (
    <div className="bg-white rounded-lg shadow-md p-6" style={{ borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', background: 'linear-gradient(to bottom right, #ffdbd1, #ffbfbf)' }}>{/* Example gradient */}
      <h3 className="text-lg font-bold text-gray-900 mb-2">{displayedSkill}</h3>{/* Skill Title without emoji */}
      {/* Removed Contextual sentence */}
      {/* <p className="text-sm text-gray-700 mb-4">{context}</p> */}
      <button
        onClick={() => onAddInterest(skill)}
        disabled={isAdded}
        className={`w-full text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors duration-200 ease-in-out ${isAdded ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
      >
        {isAdded ? 'Added' : '➕ Add to My Interests'}
      </button>
    </div>
  );
};

export default DiscoverTile; 