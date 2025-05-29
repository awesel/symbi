import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, doc, getDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
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
  lastSenderId?: string; // This might be stale or missing
  actualLastSenderId?: string; // To be populated from the messages subcollection
  otherUserName?: string;
  otherUserPhotoURL?: string;
  matchStatus?: string;
}

interface GroupedChats {
  symbi: Chat[];
  accepted: Chat[];
}

const Inbox: React.FC = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<GroupedChats>({ symbi: [], accepted: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatName = (fullName: string): string => {
    const words = fullName.trim().split(/\s+/);
    if (words.length === 1) return words[0];
    const firstName = words[0];
    const lastName = words[words.length - 1];
    return `${firstName} ${lastName[0]}.`;
  };

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
          setChats({ symbi: [], accepted: [] });
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
                matchStatus: match.status,
                // lastSenderId: chatDocSnap.data()?.lastSenderId // We will fetch this fresh
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

              // Fetch the last message from the subcollection to get the actual lastSenderId
              const messagesRef = collection(db, 'chats', match.chatId, 'messages');
              const lastMessageQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
              const lastMessageSnapshot = await getDocs(lastMessageQuery);

              if (!lastMessageSnapshot.empty) {
                const lastMessageData = lastMessageSnapshot.docs[0].data();
                chatData.actualLastSenderId = lastMessageData.sender;
                // Optionally, update lastMessage and lastTimestamp from this actual last message if needed
                // chatData.lastMessage = lastMessageData.text;
                // chatData.lastTimestamp = lastMessageData.timestamp;
              } else {
                // No messages in the chat, so no last sender.
                // Or handle as per your app's logic if chat.lastMessage/lastTimestamp from parent doc is preferred here.
                chatData.actualLastSenderId = undefined; 
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

        // Sort chats: no messages first, then by lastTimestamp
        resolvedChatsData.sort((a, b) => {
          const isAwaitingResponseA = a.lastSenderId === user.uid && a.lastTimestamp !== null;
          const isAwaitingResponseB = b.lastSenderId === user.uid && b.lastTimestamp !== null;

          const aHasNoMessages = !a.lastTimestamp;
          const bHasNoMessages = !b.lastTimestamp;

          // Prioritize chats where current user sent the last message and is awaiting response
          if (isAwaitingResponseA && !isAwaitingResponseB) return -1;
          if (!isAwaitingResponseA && isAwaitingResponseB) return 1;

          // Then prioritize chats with no messages
          if (aHasNoMessages && !bHasNoMessages) return -1;
          if (!aHasNoMessages && bHasNoMessages) return 1;

          // For all other cases (both awaiting response, both no messages, or neither), sort by last timestamp
          if (a.lastTimestamp && b.lastTimestamp) {
            return b.lastTimestamp.toMillis() - a.lastTimestamp.toMillis(); // Most recent first
          }

          // Fallback, though ideally not reached if data is consistent
          return 0;
        });

        // Group chats by status
        const groupedChats: GroupedChats = {
          symbi: resolvedChatsData.filter(chat => chat.matchStatus === 'symbi'),
          accepted: resolvedChatsData.filter(chat => chat.matchStatus !== 'symbi')
        };

        setChats(groupedChats);

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

  const totalChats = chats.symbi.length + chats.accepted.length;
  if (totalChats === 0) {
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

  // Combine and sort chats before rendering
  const allChats = [...chats.symbi, ...chats.accepted].sort((a, b) => {
    const isAwaitingResponseA = a.lastSenderId === user.uid && a.lastTimestamp !== null;
    const isAwaitingResponseB = b.lastSenderId === user.uid && b.lastTimestamp !== null;

    const aHasNoMessages = !a.lastTimestamp;
    const bHasNoMessages = !b.lastTimestamp;

    // Prioritize chats where current user sent the last message and is awaiting response
    if (isAwaitingResponseA && !isAwaitingResponseB) return -1;
    if (!isAwaitingResponseA && isAwaitingResponseB) return 1;

    // Then prioritize chats with no messages
    if (aHasNoMessages && !bHasNoMessages) return -1;
    if (!aHasNoMessages && bHasNoMessages) return 1;

    // For all other cases (both awaiting response, both no messages, or neither), sort by last timestamp
    if (a.lastTimestamp && b.lastTimestamp) {
      return b.lastTimestamp.toMillis() - a.lastTimestamp.toMillis(); // Most recent first
    }

    // Fallback, though ideally not reached if data is consistent
    return 0;
  });

  return (
    <div className="inbox-container">
      {/* Combined Chat List */}
      {allChats.length > 0 && <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">Chats</h3>}{/* Chats Title - Conditionally rendered and centered */}
      <ul className="space-y-3 px-4 pt-4"> {/* Use the existing chat-list styling */}
        {allChats.map((chat) => {
          // Use actualLastSenderId if available, otherwise fallback to the potentially stale one (or handle as needed)
          const lastSenderToCompare = chat.actualLastSenderId !== undefined ? chat.actualLastSenderId : chat.lastSenderId;
          const isLastMessageNotByUser = lastSenderToCompare && lastSenderToCompare !== user?.uid;
          const chatLink = chat.matchStatus === 'symbi' ? `/symbi-chat/${chat.id}` : `/chat/${chat.id}`;
          const displayName = chat.otherUserName ? formatName(chat.otherUserName) : 'Chat';
          
          return (
            <li key={chat.id} className="bg-white shadow overflow-hidden rounded-md">
              <Link href={chatLink} legacyBehavior>
                <a className="block hover:bg-gray-50">
                  <div className="flex items-center px-4 py-4 sm:px-6">
                    <div className="flex-shrink-0">
                      {chat.otherUserPhotoURL ? (
                        <Image
                          src={chat.otherUserPhotoURL}
                          alt={`${displayName}'s profile`}
                          width={40} // Adjust size as needed
                          height={40} // Adjust size as needed
                          className="rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">{displayName.substring(0, 1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between ml-4">
                      <div>
                        <div className="text-sm font-medium text-indigo-600 truncate">
                          {chat.matchStatus === 'symbi' && '⭐ '}
                          {displayName}
                          {isLastMessageNotByUser && (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {chat.lastMessage || 'No messages yet'}
                        </p>
                      </div>
                      <div className="ml-5 flex-shrink-0">
                        {/* Chevron or other indicator */}
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </a>
              </Link>
            </li>
          );
        })}
      </ul>
      <style>{`
        .inbox-container {
          max-width: none; /* Remove max-width */
          margin: 0; /* Remove margin */
          padding: 0; /* Remove padding */
          font-family: Arial, sans-serif;
        }
        .chat-list {
          list-style: none;
          padding: 0; /* Ensure padding is 0 as we added padding to the ul */
        }
        .chat-list .awaiting-response-indicator {
          border: 2px solid #39ff14; /* Neon green border */
          background-color: rgba(57, 255, 20, 0.2); /* Semi-transparent neon green highlight (rgba of #39ff14 with 0.2 opacity) */
        }
      `}</style>
    </div>
  );
};

export default Inbox; 