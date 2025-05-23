import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Inbox from '../components/Inbox';
import Link from 'next/link';
import SymbiMatchBanner from '../app/components/SymbiMatchBanner';

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
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading profile details...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Head>
        <title>Your Dashboard - Symbi</title>
      </Head>
      
      <header className="dashboard-header">
        <h1 className="welcome-text">
          Welcome, {userProfile?.displayName || user.email}!
        </h1>
      </header>

      <SymbiMatchBanner variant="dashboard" />

      <div className="action-buttons">
        <button 
          className="btn btn-danger"
          onClick={async () => {
            await logOut();
            router.push('/login'); 
          }}
        >
          Log Out
        </button>
        <Link href="/onboarding-again" legacyBehavior>
          <a className="btn btn-success">
            Edit Profile
          </a>
        </Link>
      </div>

      <div className="inbox-container">
        <Inbox />
      </div>
      
      <style jsx>{`
        .dashboard-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .dashboard-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .welcome-text {
          font-size: 2.5rem;
          color: #2d3748;
          font-weight: 700;
          margin: 0;
        }

        .action-buttons {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin: 2rem 0;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
          border: none;
        }

        .btn-danger {
          background-color: #dc3545;
          color: white;
        }

        .btn-danger:hover {
          background-color: #c82333;
          transform: translateY(-1px);
        }

        .btn-success {
          background-color: #28a745;
          color: white;
        }

        .btn-success:hover {
          background-color: #218838;
          transform: translateY(-1px);
        }

        .inbox-container {
          background: #f8f9fa;
          border-radius: 1rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          padding: 1.5rem;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 1rem;
          background-color: #f8f9fa;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e9ecef;
          border-top: 4px solid #28a745;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .dashboard-container {
            padding: 1rem;
          }

          .welcome-text {
            font-size: 2rem;
          }

          .action-buttons {
            flex-direction: column;
            align-items: center;
          }

          .btn {
            width: 100%;
            max-width: 300px;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage; 