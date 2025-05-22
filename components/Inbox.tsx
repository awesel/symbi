import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase'; // Assuming you have this path
import { useAuth } from '../lib/useAuth'; // Assuming you have this path
import Image from 'next/image'; // Import Image

interface Match {
  id: string;
  userA: string;
  userB: string;
  chatId: string;
  status: string;
  // Add other match fields if needed by inbox logic, e.g., lastTimestamp for sorting?
  // For now, assuming we sort by chat's lastTimestamp later.
}

interface Chat {
  id: string;
  users: string[];
  lastMessage: string | null;
  lastTimestamp: Timestamp | null;
  otherUserName?: string;
  otherUserPhotoURL?: string;
  matchStatus?: string;
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

    const fetchChatsFromMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const matchesRef = collection(db, 'matches');
        // Query for matches where user is userA OR userB
        const qUserA = query(
          matchesRef,
          where('userA', '==', user.uid),
          where('status', 'in', ['accepted', 'symbi']) // Ensure match is active or symbi
        );
        const qUserB = query(
          matchesRef,
          where('userB', '==', user.uid),
          where('status', 'in', ['accepted', 'symbi']) // Ensure match is active or symbi
        );

        const [querySnapshotUserA, querySnapshotUserB] = await Promise.all([
          getDocs(qUserA),
          getDocs(qUserB),
        ]);

        const userMatches: Match[] = [];
        const matchIds = new Set<string>(); // To avoid duplicates if a user is somehow userA and userB in a bugged match doc

        querySnapshotUserA.forEach((matchDoc) => {
          if (!matchIds.has(matchDoc.id)) {
            userMatches.push({ id: matchDoc.id, ...matchDoc.data() } as Match);
            matchIds.add(matchDoc.id);
          }
        });

        querySnapshotUserB.forEach((matchDoc) => {
          if (!matchIds.has(matchDoc.id)) {
            userMatches.push({ id: matchDoc.id, ...matchDoc.data() } as Match);
            matchIds.add(matchDoc.id);
          }
        });

        if (userMatches.length === 0) {
          setChats([]);
          setLoading(false);
          return;
        }

        const chatsDataPromises = userMatches.map(async (match) => {
          if (!match.chatId) {
            console.warn(`Match ${match.id} is missing a chatId.`);
            return null; // Skip if no chatId
          }
          try {
            const chatDocRef = doc(db, 'chats', match.chatId);
            const chatDocSnap = await getDoc(chatDocRef);

            if (chatDocSnap.exists()) {
              const chatData = { 
                id: chatDocSnap.id, 
                ...chatDocSnap.data(),
                matchStatus: match.status
              } as Partial<Chat>;
              const otherUserId = match.userA === user.uid ? match.userB : match.userA;

              if (otherUserId) {
                const userDocRef = doc(db, 'users', otherUserId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  const userData = userDocSnap.data();
                  chatData.otherUserName = userData.displayName || 'Computer';
                  chatData.otherUserPhotoURL = userData.photoURL || '';
                } else {
                  chatData.otherUserName = 'Unknown User';
                }
              } else {
                chatData.otherUserName = 'N/A';
              }
              return chatData as Chat;
            }
            return null; // Chat doc doesn't exist
          } catch (chatError) {
            console.error(`Error fetching chat ${match.chatId} for match ${match.id}:`, chatError);
            return null;
          }
        });

        const resolvedChatsData = (await Promise.all(chatsDataPromises))
          .filter(chat => chat !== null) as Chat[];

        // Sort chats: symbi matches first, then by lastTimestamp, descending
        resolvedChatsData.sort((a, b) => {
          const aIsSymbi = a.matchStatus === 'symbi';
          const bIsSymbi = b.matchStatus === 'symbi';

          if (aIsSymbi && !bIsSymbi) {
            return -1; // a comes first
          }
          if (!aIsSymbi && bIsSymbi) {
            return 1; // b comes first
          }

          // If both are symbi or both are not, sort by lastTimestamp
          if (a.lastTimestamp && b.lastTimestamp) {
            return b.lastTimestamp.toMillis() - a.lastTimestamp.toMillis();
          }
          if (a.lastTimestamp) return -1; // a comes first if b has no timestamp
          if (b.lastTimestamp) return 1;  // b comes first if a has no timestamp
          return 0; // no timestamps or same status, order doesn't matter for this comparison pass
        });

        setChats(resolvedChatsData);

      } catch (err) {
        console.error("Error fetching chats from matches:", err);
        setError("Failed to load chats.");
      } finally {
        setLoading(false);
      }
    };

    fetchChatsFromMatches();
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
                    <h3>
                      {chat.otherUserName}
                      {chat.matchStatus === 'symbi' && <span style={{ marginLeft: '8px', color: 'gold' }}>⭐</span>}
                    </h3>
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