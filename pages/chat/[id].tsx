import React from 'react';
import { useRouter } from 'next/router';
import ChatRoom from '../../app/components/ChatRoom';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import { useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Consistent styling for messages
const MESSAGE_CONTAINER_CLASSES = "flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4";
const MESSAGE_TEXT_CLASSES = "text-lg text-gray-700";
const LINK_CLASSES = "mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-base font-medium";

const ChatPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, error, authReady } = useAuth();
  // const [isSymbiMatch, setIsSymbiMatch] = useState(false);

  useEffect(() => {
    const fetchMatchStatus = async () => {
      if (!id || !user) return;

      try {
        if (user && typeof id === 'string') {
          // Check if a match document exists with userA = currentUser and userB = chatPartnerId
          const qUserA = query(collection(db, 'matches'), where('userA', '==', user.uid), where('userB', '==', id));
          // const matchSnapshot = await getDocs(qUserA);
          await getDocs(qUserA);

          // Similarly, check if a match document exists with userA = chatPartnerId and userB = currentUser
          // const isSymbiMatch = router.pathname.startsWith('/symbi');
        }
      } catch (err) {
        console.error('Error fetching match status:', err);
      }
    };

    if (authReady) {
      fetchMatchStatus();
    }
  }, [id, user, authReady]);

  if (!authReady) {
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-blue-900 py-6">
      <ChatRoom chatId={id} />
    </div>
  );
};

export default ChatPage; 