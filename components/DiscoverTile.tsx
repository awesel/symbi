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
    const emojiRegex = /^(\p{Emoji}\s*)+/u;
    return title.replace(emojiRegex, '').trim();
  };

  const displayedSkill = cleanSkillTitle(skill);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '16px 24px',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
      fontSize: '16px',
      transition: 'all 0.2s ease',
      minWidth: 0
    }} className="skill-card">
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        minWidth: 0,
        flex: 1
      }}>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>💡</span>
        <span style={{ 
          fontWeight: '600', 
          color: '#222',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {displayedSkill}
        </span>
      </div>
      
      <button
        onClick={() => onAddInterest(skill)}
        disabled={isAdded}
        style={{
          backgroundColor: isAdded ? '#E2E8F0' : '#9f74ff',
          border: 'none',
          borderRadius: '10px',
          padding: '6px 12px',
          color: isAdded ? '#64748B' : 'white',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isAdded ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          marginLeft: '12px'
        }}
        onMouseOver={(e) => {
          if (!isAdded) {
            e.currentTarget.style.backgroundColor = '#b28cf6';
          }
        }}
        onMouseOut={(e) => {
          if (!isAdded) {
            e.currentTarget.style.backgroundColor = '#9f74ff';
          }
        }}
      >
        {isAdded ? 'Added' : '+ Add'}
      </button>
      <style jsx>{`
        .skill-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  );
};

export default DiscoverTile; 