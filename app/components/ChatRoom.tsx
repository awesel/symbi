// app/components/ChatRoom.tsx
import { useState, useEffect, useRef } from "react";
import { doc, collection, addDoc, serverTimestamp,
         onSnapshot, orderBy, query, updateDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";          // whatever hook returns {user}
import { db } from "../../lib/firebase";              // your initialized Firestore
import { format } from 'date-fns'; // Import date-fns for timestamp formatting
import Link from 'next/link'; // Added Link import

type ChatRoomProps = { chatId: string };

interface MessageData {
  text: string;
  sender: string;
  timestamp: Timestamp | null;
  photoURL?: string; // Add photoURL for user avatar
  displayName?: string; // Add displayName for user name
}

export default function ChatRoom({ chatId }: ChatRoomProps) {
  /* 1️⃣ local state */
  const [messages, setMessages] = useState<{ id: string; text: string; sender: string; timestamp: Timestamp | null; photoURL?: string; displayName?: string; }[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();       // assumes .uid

  /* 2️⃣ realtime listener */
  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as MessageData) })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return unsub;
  }, [chatId]);

  /* 3️⃣ send message */
  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      sender: user.uid,
      text: input.trim(),
      timestamp: serverTimestamp(),
      photoURL: user.photoURL, // Add user photoURL
      displayName: user.displayName // Add user displayName
    });
    /* 3a update chat metadata */
    const chatDoc = doc(db, "chats", chatId);
    await updateDoc(chatDoc, {
      lastMessage: input.trim(),
      lastTimestamp: serverTimestamp()
    });
    setInput("");
  };

  /* 4️⃣ render */
  return (
    <div className="flex flex-col h-[85vh] max-h-[720px] w-full max-w-2xl mx-auto bg-white shadow-xl rounded-lg">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Chat</h2>
        <Link href="/dashboard" legacyBehavior>
          <a className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
            Back to Dashboard
          </a>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {messages.map(m => {
          const isUser = m.sender === user?.uid;
          const timestamp = m.timestamp?.toDate ? format(m.timestamp.toDate(), 'Pp') : 'Sending...';
          const senderName = isUser ? (user?.displayName || 'You') : (m.displayName || 'User');

          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
              <div
                className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                  isUser
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
                }`}
              >
                <p className="font-bold text-sm mb-1">{senderName}</p>
                <p className="text-sm">{m.text}</p>
                <p className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-500'} text-right`}>
                  {timestamp}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-4 border-t border-gray-200 flex items-center gap-3 bg-gray-50"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Type a message…"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
} 