import React from 'react';
import Link from 'next/link';

interface SymbiMatchBannerProps {
  variant?: 'chat' | 'dashboard';
}

const SymbiMatchBanner: React.FC<SymbiMatchBannerProps> = ({ variant = 'chat' }) => {
  if (variant === 'dashboard') {
    return (
      <div className="bg-gradient-to-r from-amber-100 to-yellow-100 p-4 rounded-lg shadow-sm mb-4 max-w-2xl mx-auto">
        <div className="flex items-center">
          <span className="text-amber-500 text-2xl mr-2">⭐</span>
          <div>
            <h3 className="text-amber-800 font-semibold">Looking for Symbiotic Matches?</h3>
            <p className="text-amber-700 text-sm">
              Symbi matches (marked with a ⭐) are special connections where both people have things to learn from each other.
              <Link href="/onboarding-again" className="text-amber-900 underline ml-1">
                Add more interests and expertise
              </Link> to increase your chances of finding these valuable matches!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-100 to-yellow-100 p-4 rounded-lg shadow-sm mb-4 max-w-2xl mx-auto">
      <div className="flex items-center">
        <span className="text-amber-500 text-2xl mr-2">⭐</span>
        <div>
          <h3 className="text-amber-800 font-semibold">Symbiotic Match!</h3>
          <p className="text-amber-700 text-sm">
            This is a special "symbi" match because both of you have things to learn from each other. 
            These matches are rare and valuable - we recommend prioritizing conversations with your starred matches!
          </p>
        </div>
      </div>
    </div>
  );
};

export default SymbiMatchBanner; 