// app/components/ChatRoom.tsx
import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { format } from "date-fns";
import { useRouter } from 'next/router';

interface MatchData {
  partnerName: string;
  partnerFirstName: string;
  partnerExpertise: string | string[];
  learnerName: string;
  learnerFirstName: string;
  learnerExpertise: string | undefined;
  isSymbiMatch: boolean;
  sharedInterests: string[];
  partnerPhotoURL: string;
}

type ChatRoomProps = { chatId: string };

interface MessageData {
  text: string;
  sender: string;
  timestamp: Timestamp | null;
  photoURL?: string;
  displayName?: string;
}

function getMatchId(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export default function ChatRoom({ chatId }: ChatRoomProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<({ id: string } & MessageData)[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [otherName, setOtherName] = useState<string>("Chat partner");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  useEffect(() => {
    if (!chatId || !user) return;
    setLoadingMatch(true);
    (async () => {
      try {
        const chatDocRef = doc(db, "chats", chatId);
        const chatDocSnap = await getDoc(chatDocRef);
        if (!chatDocSnap.exists()) return;
        const chatData = chatDocSnap.data();
        const users = chatData.users as string[];
        const chatPartnerId = users.find(uid => uid !== user.uid);
        if (!chatPartnerId) return;
        
        const matchId = getMatchId(user.uid, chatPartnerId);
        const matchRef = doc(db, "matches", matchId);
        const matchSnap = await getDoc(matchRef);
        if (!matchSnap.exists()) return;
        const match = matchSnap.data();
        
        const userDocRef = doc(db, "users", chatPartnerId);
        const userDocSnap = await getDoc(userDocRef);
        const partnerName = userDocSnap.exists() ? userDocSnap.data().displayName || "Your Match" : "Your Match";
        const partnerPhotoURL = userDocSnap.exists() ? userDocSnap.data().photoURL || "" : "";
        
        setOtherName(partnerName);
        setMatchData({
          partnerName,
          partnerFirstName: match.partnerFirstName || partnerName.split(" ")[0] || "Partner",
          partnerExpertise: match.partnerExpertise || "their expertise",
          learnerName: match.learnerName || user.displayName || "You",
          learnerFirstName: match.learnerFirstName || user.displayName?.split(" ")[0] || "You",
          learnerExpertise: match.learnerExpertise,
          isSymbiMatch: match.isSymbiMatch || false,
          sharedInterests: match.sharedInterests || match.matchedOnTags || [],
          partnerPhotoURL
        });
      } finally {
        setLoadingMatch(false);
      }
    })();
  }, [chatId, user]);

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as MessageData) }))
      );
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return unsub;
  }, [chatId]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      sender: user.uid,
      text: input.trim(),
      timestamp: serverTimestamp(),
      photoURL: user.photoURL,
      displayName: user.displayName,
    });
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: input.trim(),
      lastTimestamp: serverTimestamp(),
    });
    setInput("");
  };

  const partnerExpertiseForPlaceholder = Array.isArray(matchData?.partnerExpertise)
    ? matchData?.partnerExpertise[0]
    : matchData?.partnerExpertise;
  const placeholderText = matchData && matchData.partnerFirstName && partnerExpertiseForPlaceholder
    ? `Ask ${matchData.partnerFirstName} about ${partnerExpertiseForPlaceholder}...`
    : 'Ask your match a question...';

  if (loadingMatch || !matchData) {
    return <div style={{ color: '#fff', textAlign: 'center', padding: '2rem' }}>Loading match details...</div>;
  }

  const currentUserIsLearner = user && matchData.learnerName === user.displayName;
  const emoji = matchData.isSymbiMatch ? '⭐️' : '😎';
  const summary = currentUserIsLearner
    ? `${matchData.partnerName} can teach you about ${matchData.partnerExpertise}`
    : `You can teach ${matchData.partnerName} about ${matchData.learnerExpertise}`;
  const sharedInterests = matchData.sharedInterests.slice(0, 3).join(', ');
  const moreCount = matchData.sharedInterests.length > 3 ? matchData.sharedInterests.length - 3 : 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-blue-900 min-h-screen">
      <header className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <img src={matchData.partnerPhotoURL} className="w-12 h-12 rounded-full bg-brand-purple object-cover" alt={matchData.partnerName} />
          <h2 className="text-xl font-semibold text-white">{matchData.partnerName}</h2>
          <span className="text-2xl ml-2">{emoji}</span>
        </div>
        <button className="ghost-btn border border-brand-purple text-brand-purple px-4 py-2 rounded-lg hover:bg-brand-purple/10 transition" onClick={() => router.push('/dashboard')}>
          ← Dashboard
        </button>
      </header>

      <div className="w-full flex justify-center mt-2 mb-4">
        <div className="match-card bg-surface-100 rounded-card shadow-card px-8 py-6 max-w-xl w-full">
          <h3 className="font-semibold text-white mb-1 text-lg flex items-center gap-2">{emoji} You've been matched!</h3>
          <p className="text-white/90 text-base mb-1">{summary}</p>
          {matchData.isSymbiMatch && (
            <p className="text-white/90 text-base mb-1">
              {matchData.learnerName} can teach {matchData.partnerName} about {matchData.learnerExpertise}
            </p>
          )}
          {sharedInterests && (
            <p className="mt-2 text-xs text-brand-purpleLight">
              Shared Interests: {sharedInterests}{moreCount > 0 && ` +${moreCount} more`}
            </p>
          )}
        </div>
      </div>

      <div className="chat-window flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {messages.map((m) => {
          const mine = m.sender === user?.uid;
          const ts = m.timestamp?.toDate ? format(m.timestamp.toDate(), "HH:mm") : "Sending…";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"} mb-2`}>
              {!mine && m.displayName && (
                <div className="text-xs text-gray-400 mb-1 flex items-center">
                  <span>{m.displayName}</span>
                  {ts !== "Sending…" && <span className="ml-2 text-gray-500">{ts}</span>}
                </div>
              )}
              <div
                className={`bubble max-w-[75%] py-2 px-4 rounded-xl shadow ${mine ? "bg-[#9f74ff] text-white" : "bg-white/10 text-gray-200 received"}`}
              >
                <p className="text-sm leading-relaxed">{m.text}</p>
                {mine && ts !== "Sending…" && (
                   <p className="text-xs mt-0.5 text-purple-200 text-right">{ts}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="chat-input p-3 flex items-center gap-2 bg-transparent w-full"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-xl border-none px-4 py-3 bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-0 resize-none overflow-hidden leading-relaxed text-base"
          placeholder={placeholderText}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="send-btn bg-[#9f74ff] text-white text-xl px-6 py-2 rounded-xl disabled:opacity-50 transition-colors duration-200 hover:bg-[#8e63ee]"
        >
          ➤
        </button>
      </form>
    </div>
  );
} 