import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Inbox from '../components/Inbox';

const DashboardPage: React.FC = () => {
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
    // Added a check to ensure userProfile is not null before accessing onboardingCompleted
    // This also handles the case where user is loaded but userProfile is still loading.
    return <p>Loading user data...</p>;
  }

  // Ensure userProfile is loaded before trying to display its properties
  if (!userProfile) {
    return <p>Loading profile details...</p>;
  }

  return (
    <div className="container" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Your Dashboard - Symbi</title>
      </Head>
      <header style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2.5em', color: '#333', marginBottom: '10px' }}>Welcome, {userProfile?.displayName || user.email}!</h1>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button 
          style={{ 
            padding: '12px 25px', 
            fontSize: '1.1em', 
            color: 'white', 
            backgroundColor: '#dc3545',
            border: 'none', 
            borderRadius: '5px', 
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onClick={async () => {
            await logOut();
            router.push('/login'); 
          }} 
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
        >
          Log Out
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <Inbox />
      </div>
      
      <p style={{ marginBottom: '20px', fontSize: '1.1em', textAlign: 'center' }}>This is your main dashboard.</p>
      <p style={{ marginBottom: '10px', textAlign: 'center' }}>Your UID: {user.uid}</p>
      
      <div className="profile-section" style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '20px' }}>
        <h2 style={{ marginTop: '0', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Your Profile:</h2>
        <p><strong>Email:</strong> {userProfile.email}</p>
        <p><strong>Onboarding Completed:</strong> {userProfile.onboardingCompleted ? 'Yes' : 'No'}</p>
        <p><strong>Interests:</strong> {userProfile.interests?.join(', ') || 'Not set'}</p>
        <p><strong>Expertise:</strong> {userProfile.expertise?.join(', ') || 'Not set'}</p>
      </div>
      
      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        // Add other component-specific styles if needed
      `}</style>
    </div>
  );
};

export default DashboardPage; 