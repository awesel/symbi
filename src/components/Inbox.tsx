import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Match {
  id: string;
  user: {
    displayName: string;
    photoURL: string;
  };
  lastMessage?: {
    text: string;
    timestamp: number;
  };
}

const Inbox: React.FC = () => {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // TODO: Implement fetching matches from Firebase
    // This is a placeholder for demonstration
    setMatches([]);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-white/20 rounded w-3/4"></div>
          <div className="h-4 bg-white/20 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Your Matches</h2>
        <p className="text-white/60">No matches yet. Start exploring to find your perfect match!</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Your Matches</h2>
      <div className="space-y-4">
        {matches.map((match) => (
          <Link
            key={match.id}
            href={`/chat/${match.id}`}
            className="block p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <Image
                src={match.user.photoURL}
                alt={match.user.displayName}
                className="w-12 h-12 rounded-full"
                width={48}
                height={48}
              />
              <div className="flex-1">
                <h3 className="text-white font-medium">{match.user.displayName}</h3>
                {match.lastMessage && (
                  <p className="text-white/60 text-sm truncate">{match.lastMessage.text}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Inbox; 