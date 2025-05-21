import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

const HomePage: React.FC = () => {
  const { user, userProfile, loading, logOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user && userProfile && !userProfile.onboardingCompleted) {
      router.push('/onboarding');
    }
  }, [user, userProfile, loading, router]);

  if (loading || !user || (userProfile && !userProfile.onboardingCompleted)) {
    return <p>Loading...</p>;
  }

  return (
    <div className="container">
      <h1>Welcome, {userProfile?.displayName || user.email}!</h1>
      <p>This is the main application page after successful login and onboarding.</p>
      <p>Your UID: {user.uid}</p>
      {userProfile && (
        <div className="profile-section">
          <h2>Your Profile:</h2>
          <p><strong>Email:</strong> {userProfile.email}</p>
          <p><strong>Onboarding Completed:</strong> {userProfile.onboardingCompleted ? 'Yes' : 'No'}</p>
          <p><strong>Interests:</strong> {userProfile.interests?.join(', ') || 'Not set'}</p>
          <p><strong>Expertise:</strong> {userProfile.expertise?.join(', ') || 'Not set'}</p>
        </div>
      )}
      <button 
        className="button button-logout"
        onClick={async () => {
          await logOut();
          router.push('/login'); // Ensure redirect after logout
        }} 
      >
        Log Out
      </button>
    </div>
  );
};

export default HomePage; 