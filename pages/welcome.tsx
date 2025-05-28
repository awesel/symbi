import React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

const WelcomePage: React.FC = () => {
  const router = useRouter();
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, Arial, sans-serif',
      padding: 24
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        padding: 48,
        textAlign: 'center',
        maxWidth: 400
      }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: '#3B82F6', marginBottom: 8 }}>Symbi</div>
        <div style={{ fontSize: 18, color: '#374151', marginBottom: 32 }}>Stanford's playful social app for finding your people.</div>
        <button
          style={{
            width: '100%',
            padding: '14px 0',
            fontSize: 18,
            fontWeight: 700,
            background: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            marginBottom: 16,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onClick={() => router.push('/signup')}
        >
          Create Account
        </button>
        <button
          style={{
            width: '100%',
            padding: '14px 0',
            fontSize: 18,
            fontWeight: 700,
            background: '#10B981',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            marginBottom: 16,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onClick={() => router.push('/login')}
        >
          Log In
        </button>
        <div style={{ margin: '16px 0', color: '#6B7280', fontSize: 14 }}>or</div>
        <button
          style={{
            width: '100%',
            padding: '12px 0',
            fontSize: 16,
            fontWeight: 600,
            background: '#fff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 22, height: 22 }} />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default WelcomePage; 