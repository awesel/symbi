import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Link from 'next/link';
import Head from 'next/head';

const DiscoverPage: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [suggestedInterests, setSuggestedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchSuggestedInterests = async () => {
      if (!userProfile?.interests) return;

      try {
        // Get all users except current user
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '!=', user?.uid));
        const querySnapshot = await getDocs(q);

        // Collect all unique interests from other users
        const allInterests = new Set<string>();
        querySnapshot.forEach(doc => {
          const userData = doc.data();
          if (userData.interests) {
            userData.interests.forEach((interest: string) => {
              // Only add interests that the current user doesn't have
              if (userProfile?.interests && !userProfile.interests.includes(interest)) {
                allInterests.add(interest);
              }
            });
          }
        });

        // Convert to array and sort alphabetically
        const sortedInterests = Array.from(allInterests).sort();
        setSuggestedInterests(sortedInterests);
      } catch (error) {
        console.error('Error fetching suggested interests:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile) {
      fetchSuggestedInterests();
    }
  }, [userProfile, user]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Head>
        <title>Discover Interests - Symbi</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Discover New Interests</h1>
          <p className="text-gray-600 mb-6">
            Here are some interests from other users that you might want to explore. 
            Adding these to your profile can help you find more meaningful connections!
          </p>

          {suggestedInterests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No new interests to discover at the moment.</p>
              <Link href="/onboarding-again" className="text-blue-600 hover:text-blue-800">
                Add more interests to your profile
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestedInterests.map((interest, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800">{interest}</span>
                    <Link
                      href="/onboarding-again"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Add
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage; 