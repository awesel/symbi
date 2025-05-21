import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Updated import
import { useRouter } from 'next/router';

const LoginPage: React.FC = () => {
  const { user, userProfile, error, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userProfile) {
      if (userProfile.onboardingCompleted) {
        router.push('/'); // Or your main app page e.g. /chat
      } else {
        router.push('/onboarding');
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading || (user && userProfile)) {
    // Show loading or blank screen while redirecting
    return <p>Loading...</p>;
  }

  // If user is logged in, redirect to a dashboard or home page
  // For now, let's assume you want to redirect to '/'
  if (user) {
    router.push('/'); // Or your desired authenticated route
    return null; // Return null to prevent rendering anything while redirecting
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f0f2f5',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '10px', fontSize: '24px', color: '#333' }}>Welcome to Common Ground</h1>
        <p style={{ marginBottom: '30px', fontSize: '16px', color: '#555' }}>Please sign in with your Stanford email to continue.</p>
        {error && <p style={{ color: 'red', marginBottom: '20px' }}>{error}</p>}
        <button 
          onClick={signInWithGoogle} 
          style={{
            padding: '12px 25px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage; 