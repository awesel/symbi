// app/components/ChatRoom.tsx
import { useState, useEffect, useRef } from "react";
import { doc, collection, addDoc, serverTimestamp,
         onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/useAuth";          // whatever hook returns {user}
import { db } from "@/lib/firebase";              // your initialized Firestore

type ChatRoomProps = { chatId: string };

export default function ChatRoom({ chatId }: ChatRoomProps) {
  /* 1️⃣ local state */
  const [messages, setMessages] = useState<{id:string;text:string;sender:string}[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();       // assumes .uid

  /* 2️⃣ realtime listener */
  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return unsub;
  }, [chatId]);

  /* 3️⃣ send message */
  const sendMessage = async () => {
    if (!input.trim()) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      sender: user!.uid,
      text: input.trim(),
      timestamp: serverTimestamp()
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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id}
               className={`max-w-[75%] px-3 py-2 rounded-xl shadow
                           ${m.sender===user!.uid
                             ? "ml-auto bg-blue-500 text-white"
                             : "mr-auto bg-gray-200"}`}>
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={e => {e.preventDefault(); sendMessage();}}
            className="p-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder="Type a message…"
        />
        <button type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-xl">
          Send
        </button>
      </form>
    </div>
  );
} 