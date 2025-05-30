'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ChatRoom from '../../components/ChatRoom';
import { useAuth } from '../../../contexts/AuthContext';
import Link from 'next/link';

const messageContainerClass = 'flex flex-col space-y-4 p-4';
const messageTextClass = 'text-white/90';
const messageLinkClass = 'text-brand-purple hover:text-brand-purple/80';

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!params.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Chat</h1>
          <p className="text-white/60 mb-6">The chat you're looking for doesn't exist.</p>
          <Link href="/dashboard" className={messageLinkClass}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <ChatRoom chatId={params.id} />
    </div>
  );
} 