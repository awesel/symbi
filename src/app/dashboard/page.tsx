'use client';

import { useState } from 'react';
import Link from 'next/link';
import DiscoverTile from '../../components/DiscoverTile';
import Inbox from '../../components/Inbox';
import { useAuth } from '../../contexts/AuthContext';

const DashboardPage = () => {
  const { user, logOut } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [displayedSkills, setDisplayedSkills] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);

  const filters = [
    { id: 'all', label: 'All Matches' },
    { id: 'symbi', label: 'Symbi Matches' },
    { id: 'accepted', label: 'Accepted Matches' },
  ];

  const firstName = user?.displayName?.split(' ')[0] || 'User';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Profile Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src={user?.photoURL || '/default-avatar.png'}
              alt="Profile"
              className="w-16 h-16 rounded-full border-2 border-brand-purple"
            />
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {firstName}</h1>
              <p className="text-white/60">Discover and connect with like-minded individuals</p>
            </div>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/profile/edit"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              <span>Edit Profile</span>
            </Link>
            <button
              onClick={logOut}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v3a1 1 0 102 0V9z" clipRule="evenodd" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeFilter === filter.id
                  ? 'bg-brand-purple text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white/60'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Suggested Skills */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-6">Suggested Skills</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayedSkills.map((skill) => (
                <DiscoverTile
                  key={skill}
                  skill={skill}
                  onAddInterest={(skill) => {/* TODO: Implement add interest */}}
                  isAdded={false}
                />
              ))}
            </div>
          </div>

          {/* Inbox */}
          <div>
            <Inbox />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 