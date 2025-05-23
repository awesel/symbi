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
import Link from "next/link";

/** Parse one `matchedOn` line coming from Firestore.  
    Returns { teacherIsMe, topic, learnerIsMe } or null if it doesn’t fit. */
    function parseMatchedOn(line: string) {
      // — pattern 1: Interest → Expertise —
      let m = line.match(
        /Interest:\s*([^()]+?)\s*\((yours|theirs)\)\s*matched\s*Expertise:\s*([^()]+?)\s*\((yours|theirs)\)/i
      );
      if (m) {
        const [, interest, interestWhose, expertise, expertiseWhose] = m;
        return {
          topic: expertise.trim(),
          teacherIsMe: expertiseWhose === "yours",
          learnerIsMe: interestWhose === "yours",
        };
      }
    
      // — pattern 2: Expertise → Interest —
      m = line.match(
        /Expertise:\s*([^()]+?)\s*\((yours|theirs)\)\s*matched\s*Interest:\s*([^()]+?)\s*\((yours|theirs)\)/i
      );
      if (m) {
        const [, expertise, expertiseWhose, interest, interestWhose] = m;
        return {
          topic: expertise.trim(),
          teacherIsMe: expertiseWhose === "yours",
          learnerIsMe: interestWhose === "yours",
        };
      }
    
      // — pattern 3: "topic (yours) <> topic (theirs)" —
      m = line.match(/(.+?)\s*\((yours|theirs)\)\s*<>\s*(.+?)\s*\((yours|theirs)\)/i);
      if (m) {
        const [, leftTopic, leftWhose, rightTopic, rightWhose] = m;
        return {
          topic: leftWhose === "yours" ? rightTopic.trim() : leftTopic.trim(),
          teacherIsMe: leftWhose === "yours",
          learnerIsMe: rightWhose === "yours",
        };
      }
    
      return null; // unmatched format
    }
    
    /** Build one eloquent sentence out of all parsed lines */
    /** Build a bullet list out of all parsed matchedOn lines */
function buildTeachingSentence(
  lines: string[],
  meName: string,
  themName: string
) {
  const bullets: string[] = [];

  for (const line of lines) {
    const parsed = parseMatchedOn(line);
    if (!parsed) continue;

    const teacher = parsed.teacherIsMe ? meName : themName;
    const learner = parsed.learnerIsMe ? meName : themName;
    bullets.push(`- ${teacher} can teach ${learner} about ${parsed.topic}`);
  }

  // collapse duplicates if necessary
  return [...new Set(bullets)].join("\n");
}

type ChatRoomProps = { chatId: string };

interface MessageData {
  text: string;
  sender: string;
  timestamp: Timestamp | null;
  photoURL?: string;
  displayName?: string;
}

/** Returns the Firestore match-document ID in canonical order */
function getMatchId(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export default function ChatRoom({ chatId }: ChatRoomProps) {
  /* ──────────────── local state ──────────────── */
  const { user } = useAuth();
  // an *array* of messages, not a single message
  const [messages, setMessages] = useState<
  ({ id: string } & MessageData)[]
  >([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [otherUid, setOtherUid] = useState<string | null>(null);
  const [otherName, setOtherName] = useState<string>("Chat");

  const [sysMsg, setSysMsg] = useState<string | null>(null);
  const [loadingSysMsg, setLoadingSysMsg] = useState(true);

  /* ──────────────── fetch meta & system message ──────────────── */
  useEffect(() => {
    if (!chatId || !user) return;

    (async () => {
      setLoadingSysMsg(true);
      try {
        /* 1️⃣  who’s in the chat? */
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (!chatSnap.exists()) throw new Error("Chat not found");
        const users = (chatSnap.data().users as string[]) ?? [];
        if (users.length !== 2) throw new Error("Bad chat users array");

        const me = user.uid;
        const them = users.find((u) => u !== me);
        if (!them) throw new Error("Other user not found");
        setOtherUid(them);

        /* 2️⃣  load their display name */
        const themSnap = await getDoc(doc(db, "users", them));
        setOtherName(themSnap.exists() ? themSnap.data().displayName ?? "Chat partner" : "Chat partner");
        // — names for the sentence builder —
        const currentUserDisplayName = user.displayName ?? "You";
        const actualOtherUserDisplayName =
          themSnap.exists()
            ? (themSnap.data().displayName ?? "Your chat partner")
            : "Your chat partner";

        /* 3️⃣  load match explanation straight from back-end */
        const matchId = getMatchId(me, them);
        const matchSnap = await getDoc(doc(db, "matches", matchId));

        if (matchSnap.exists()) {
          const { matchedOn = [], status } = matchSnap.data();
        
          if (Array.isArray(matchedOn) && matchedOn.length) {
            const sentence = buildTeachingSentence(
              matchedOn,
              currentUserDisplayName,
              actualOtherUserDisplayName
            );
        
            // If we parsed at least one teaching pair, show it
            if (sentence) {
              setSysMsg(sentence);
            } else {
              // still fall back—rare edge-case
              setSysMsg(
                status === "symbi"
                  ? "You both share interests and expertise—perfect synergy!"
                  : "You’ve been matched on complementary interests."
              );
            }
          } else {
            // matchedOn empty → fallback
            setSysMsg(
              status === "symbi"
                ? "You both share interests and expertise—perfect synergy!"
                : "You’ve been matched on complementary interests."
            );
          }
        } else {
          setSysMsg("You’ve been matched! Start chatting.");
        }
      } catch (err) {
        console.error(err);
        setSysMsg("Unable to load match details. Start chatting anyway!");
      } finally {
        setLoadingSysMsg(false);
      }
    })();
  }, [chatId, user]);

  /* ──────────────── realtime listener ──────────────── */
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

  /* ──────────────── send message ──────────────── */
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

  /* ──────────────── render ──────────────── */
  return (
    <div className="flex flex-col h-[85vh] max-h-[720px] w-full max-w-2xl mx-auto bg-white shadow-xl rounded-lg">
      {/* header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">{otherName}</h2>
        <Link href="/dashboard" legacyBehavior>
          <a className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
            Back to Dashboard
          </a>
        </Link>
      </div>

      {/* message list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {loadingSysMsg && (
          <div className="my-2 p-3 text-center text-sm text-gray-500">Loading chat information…</div>
        )}
        {!loadingSysMsg && sysMsg && (
          <div className="my-2 p-3 bg-gray-100 rounded-lg text-center text-sm text-gray-700 shadow whitespace-pre-line">
            {sysMsg}
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender === user?.uid;
          const ts = m.timestamp?.toDate ? format(m.timestamp.toDate(), "Pp") : "Sending…";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} mb-2`}>
              <div
                className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                  mine
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
                }`}
              >
                <p className="text-sm">{m.text}</p>
                <p className={`text-xs mt-1 ${mine ? "text-blue-200" : "text-gray-500"} text-right`}>{ts}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-4 border-t border-gray-200 flex items-center gap-3 bg-gray-50"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
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