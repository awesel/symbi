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
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: '768px', 
        margin: '0 auto', 
        padding: '32px 16px',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #4B2A9D',
            borderTop: '3px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'white', fontSize: '16px' }}>Loading your conversations...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: '768px', 
        margin: '0 auto', 
        padding: '32px 16px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          padding: '24px',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ color: '#FF6B6B', fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ color: 'white', fontSize: '20px', marginBottom: '8px' }}>Oops! Something went wrong</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: '768px', 
        margin: '0 auto', 
        padding: '32px 16px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          padding: '24px',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ color: '#A78BFA', fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h3 style={{ color: 'white', fontSize: '20px', marginBottom: '8px' }}>Please Log In</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>You need to be logged in to view your chats.</p>
        </div>
      </div>
    );
  }

  const totalChats = chats.symbi.length + chats.accepted.length;
  if (totalChats === 0) {
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: '768px', 
        margin: '0 auto', 
        padding: '32px 16px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          padding: '32px',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ color: '#A78BFA', fontSize: '64px', marginBottom: '24px' }}>💭</div>
          <h2 style={{ 
            color: 'white', 
            fontSize: '24px', 
            fontWeight: '600', 
            marginBottom: '16px' 
          }}>No chats yet</h2>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.8)', 
            fontSize: '16px', 
            marginBottom: '32px',
            maxWidth: '400px',
            margin: '0 auto 32px'
          }}>
            Get started by inviting friends or refining your profile to find your perfect learning match!
          </p>
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => alert('Go ask them! You know them better than we do!')}
              style={{ 
                padding: '12px 24px',
                backgroundColor: '#4B2A9D',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(75, 42, 157, 0.2)'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Invite Your Friends
            </button>
            <Link href="/onboarding-again" legacyBehavior>
              <a style={{ 
                padding: '12px 24px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Add More Interests
              </a>
            </Link>
          </div>
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
    <div style={{ 
      width: '100%', 
      maxWidth: '768px', 
      margin: '0 auto',
      padding: '0',
      animation: 'fadeIn 0.3s ease-in'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
        color: 'white',
        fontSize: '22px',
        fontWeight: '600'
      }}>
        <h2>Chats</h2>
        <span style={{
          fontSize: '13px',
          backgroundColor: '#a884ff',
          color: 'white',
          borderRadius: '999px',
          padding: '4px 10px',
          fontWeight: '500'
        }}>
          {totalChats} {totalChats === 1 ? 'chat' : 'chats'}
        </span>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {allChats.map((chat) => {
          const lastSenderToCompare = chat.actualLastSenderId !== undefined ? chat.actualLastSenderId : chat.lastSenderId;
          const isLastMessageNotByUser = lastSenderToCompare && lastSenderToCompare !== user?.uid;
          const chatLink = `/chat/${chat.id}`;
          const displayName = chat.otherUserName ? formatName(chat.otherUserName) : 'Chat';
          
          return (
            <li key={chat.id} style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '16px 24px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }} className="chat-card">
              {chat.matchStatus === 'symbi' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '0',
                  height: '0',
                  borderStyle: 'solid',
                  borderWidth: '0 48px 48px 0',
                  borderColor: 'transparent #4B2A9D transparent transparent',
                  opacity: 0.15
                }} />
              )}
              <Link href={chatLink} legacyBehavior>
                <a style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  width: '100%', 
                  textDecoration: 'none',
                  color: 'inherit'
                }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    marginRight: '16px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#A78BFA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1A202C',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(167, 139, 250, 0.3)'
                  }}>
                    {chat.otherUserPhotoURL ? (
                      <Image
                        src={chat.otherUserPhotoURL}
                        alt={`${displayName}'s profile`}
                        width={48}
                        height={48}
                        style={{ borderRadius: '50%' }}
                      />
                    ) : (
                      <span style={{ fontSize: '18px' }}>{displayName.substring(0, 1)}</span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{ 
                        fontWeight: '600', 
                        fontSize: '16px', 
                        color: '#2d2d2d',
                        marginRight: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {chat.matchStatus === 'symbi' && (
                          <span style={{ color: '#4B2A9D' }}>⭐</span>
                        )}
                        {displayName}
                      </span>
                      {isLastMessageNotByUser && (
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#4B2A9D',
                          marginLeft: '8px',
                          boxShadow: '0 0 8px rgba(75, 42, 157, 0.4)'
                        }} />
                      )}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#777',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%'
                    }}>
                      {chat.lastMessage || 'No messages yet'}
                    </div>
                  </div>

                  <div style={{ 
                    color: '#bbb', 
                    fontSize: '18px',
                    marginLeft: 'auto',
                    paddingLeft: '16px',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0
                  }} className="chevron">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </a>
              </Link>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .chat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.06);
        }

        .chat-card:hover .chevron {
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
};

export default Inbox; 