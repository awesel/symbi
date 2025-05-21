import React from 'react';
import { useRouter } from 'next/router';
import ChatRoom from '../../app/components/ChatRoom';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

// Consistent styling for messages
const MESSAGE_CONTAINER_CLASSES = "flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4";
const MESSAGE_TEXT_CLASSES = "text-lg text-gray-700";
const LINK_CLASSES = "mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-base font-medium";

const ChatPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div className={MESSAGE_CONTAINER_CLASSES}>
        <p className={MESSAGE_TEXT_CLASSES}>Loading session...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={MESSAGE_CONTAINER_CLASSES}>
        <p className={MESSAGE_TEXT_CLASSES}>Access Denied. Please log in to view chats.</p>
        <Link href="/login" className={LINK_CLASSES}>
          Go to Login
        </Link>
      </div>
    );
  }

  if (!id || typeof id !== 'string') {
    return (
      <div className={MESSAGE_CONTAINER_CLASSES}>
        <p className={MESSAGE_TEXT_CLASSES}>Invalid Chat ID.</p>
        <Link href="/dashboard" className={LINK_CLASSES}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 py-6">
      <ChatRoom chatId={id} />
    </div>
  );
};

export default ChatPage; 