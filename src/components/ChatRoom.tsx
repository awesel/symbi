import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';

interface MatchData {
  id: string;
  user1: string;
  user2: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

interface MessageData {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
}

interface ChatRoomProps {
  chatId: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ chatId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !chatId) return;

    // Fetch match data
    const fetchMatchData = async () => {
      try {
        const matchDoc = await getDoc(doc(db, 'matches', chatId));
        if (matchDoc.exists()) {
          setMatchData(matchDoc.data() as MatchData);
        }
      } catch (error) {
        console.error('Error fetching match data:', error);
      }
    };

    // Set up real-time messages listener
    const q = query(
      collection(db, `matches/${chatId}/messages`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages: MessageData[] = [];
      snapshot.forEach((doc) => {
        newMessages.push({ id: doc.id, ...doc.data() } as MessageData);
      });
      setMessages(newMessages);
      setLoading(false);
    });

    fetchMatchData();

    return () => unsubscribe();
  }, [chatId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    try {
      const messageData = {
        text: newMessage.trim(),
        senderId: user.uid,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, `matches/${chatId}/messages`), messageData);

      // Update last message in match document
      await updateDoc(doc(db, 'matches', chatId), {
        lastMessage: {
          text: newMessage.trim(),
          timestamp: serverTimestamp(),
        },
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Chat Header */}
      <div className="bg-white/10 backdrop-blur-lg p-4 border-b border-white/10">
        <h1 className="text-xl font-semibold text-white">Chat</h1>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === user?.uid ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.senderId === user?.uid
                  ? 'bg-brand-purple text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              <p>{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-white/10">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-purple"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatRoom; 