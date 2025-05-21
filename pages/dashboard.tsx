import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Inbox from '../components/Inbox';
import Link from 'next/link';

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2.5em', color: '#333', marginBottom: '10px', textAlign: 'center' }}>Welcome, {userProfile?.displayName || user.email}!</h1>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '30px', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
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
        <Link href="/onboarding-again" legacyBehavior>
          <a style={{
            padding: '12px 25px',
            fontSize: '1.1em',
            color: 'white',
            backgroundColor: '#28a745',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            Edit Profile
          </a>
        </Link>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <Inbox />
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