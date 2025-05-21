import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase'; // Assuming you have this path
import { useAuth } from '../lib/useAuth'; // Assuming you have this path
import Image from 'next/image'; // Import Image

interface Chat {
  id: string;
  users: string[];
  lastMessage: string | null;
  lastTimestamp: Timestamp | null; // Changed from any
  otherUserName?: string; // To store the other user's name
  otherUserPhotoURL?: string; // To store the other user's photo
}

const Inbox: React.FC = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchChats = async () => {
      setLoading(true);
      setError(null);
      try {
        const chatsRef = collection(db, 'chats');
        const q = query(
          chatsRef,
          where('users', 'array-contains', user.uid),
          orderBy('lastTimestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const chatsData: Chat[] = [];

        for (const chatDoc of querySnapshot.docs) {
          const chat: Partial<Chat> = { id: chatDoc.id, ...chatDoc.data() };
          const otherUserId = chat.users?.find(uid => uid !== user.uid);

          if (otherUserId) {
            try {
              const userDocRef = doc(db, 'users', otherUserId);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                chat.otherUserName = userData.displayName || 'User'; // Adjust field as necessary
                chat.otherUserPhotoURL = userData.photoURL || ''; // Adjust field as necessary
              } else {
                chat.otherUserName = 'Unknown User';
              }
            } catch (userError) {
              console.error('Error fetching user data:', userError);
              chat.otherUserName = 'Error Fetching Name';
            }
          } else {
            chat.otherUserName = 'N/A'; // Should not happen in a 2-user chat
          }
          chatsData.push(chat as Chat);
        }
        setChats(chatsData);
      } catch (err) {
        console.error("Error fetching chats:", err);
        setError("Failed to load chats.");
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [user]);

  if (loading) {
    return <div>Loading chats...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!user) {
    return <div>Please log in to see your chats.</div>;
  }

  if (chats.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>No chats yet.</h2>
        <p>Get started by inviting friends or refining your profile!</p>
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => alert('Go ask them! You know them better than we do!')}
            style={{ marginRight: '10px', padding: '10px 20px', cursor: 'pointer' }}
          >
            Invite Your Friends
          </button>
          <Link href="/onboarding-again" legacyBehavior>
            <a style={{ padding: '10px 20px', textDecoration: 'none', backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: '4px' }}>
              Add More Interests/Expertise
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-container">
      <h2>Inbox</h2>
      <ul className="chat-list">
        {chats.map((chat) => (
          <li key={chat.id} className="chat-preview-card">
            <Link href={`/chat/${chat.id}`} legacyBehavior>
              <a style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="chat-info">
                  <Image 
                    src={chat.otherUserPhotoURL || 'https://via.placeholder.com/50'} 
                    alt={chat.otherUserName || 'User avatar'} 
                    className="avatar" 
                    width={50} height={50} // Added width and height for Next/Image
                    style={{ borderRadius: '50%', marginRight: '15px'}}
                  />
                  <div>
                    <h3>{chat.otherUserName}</h3>
                    <p className="last-message">
                      {chat.lastMessage ? 
                        (chat.lastMessage.length > 30 ? chat.lastMessage.substring(0, 27) + '...' : chat.lastMessage) 
                        : <i>No messages yet</i>}
                    </p>
                  </div>
                </div>
                {chat.lastTimestamp && (
                  <span className="timestamp">
                    {new Date(chat.lastTimestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                  </span>
                )}
              </a>
            </Link>
          </li>
        ))}
      </ul>
      <style>{`
        .inbox-container {
          max-width: 600px;
          margin: 20px auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        .chat-list {
          list-style: none;
          padding: 0;
        }
        .chat-preview-card {
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 10px;
          transition: background-color 0.2s ease-in-out;
        }
        .chat-preview-card:hover {
          background-color: #f9f9f9;
        }
        .chat-preview-card a {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          text-decoration: none;
          color: inherit;
        }
        .chat-info {
          display: flex;
          align-items: center;
        }
        .chat-info h3 {
          margin: 0 0 5px 0;
          font-size: 1.1em;
        }
        .last-message {
          margin: 0;
          font-size: 0.9em;
          color: #555;
        }
        .timestamp {
          font-size: 0.8em;
          color: #777;
          white-space: nowrap;
        }
        .avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          margin-right: 15px;
          object-fit: cover;
        }
      `}</style>
    </div>
  );
};

export default Inbox; 