import React from 'react';

interface DiscoverTileProps {
  skill: string;
  onAddInterest: (skill: string) => void;
  isAdded: boolean;
}

const DiscoverTile: React.FC<DiscoverTileProps> = ({ skill, onAddInterest, isAdded }) => {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-all duration-200">
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold text-white mb-2">{skill}</h3>
        <div className="mt-auto">
          <button
            onClick={() => onAddInterest(skill)}
            disabled={isAdded}
            className={`w-full py-2 px-4 rounded-lg transition-colors ${
              isAdded
                ? 'bg-green-500/50 text-white cursor-not-allowed'
                : 'bg-brand-purple text-white hover:bg-brand-purple/90'
            }`}
          >
            {isAdded ? 'Added to Interests' : 'Add to Interests'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscoverTile; 