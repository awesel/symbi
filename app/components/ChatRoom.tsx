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
    Returns { teacherIsMe, topic, learnerIsMe } or null if it doesn't fit. */
    function parseMatchedOn(line: string, currentUserId: string) {
      // Updated regex to capture user IDs instead of 'yours'/'theirs'
      // Pattern 1: Interest → Expertise
      let m = line.match(
        /Interest:\s*([^()]+?)\s*\(([^)]+)\)\s*matched\s*Expertise:\s*([^()]+?)\s*\(([^)]+)\)/i
      );
      if (m) {
        const [, , interestHolderId, expertise, expertiseHolderId] = m;
        return {
          topic: expertise.trim(),
          teacherIsMe: expertiseHolderId === currentUserId,
          learnerIsMe: interestHolderId === currentUserId,
        };
      }
    
      // Pattern 2: Expertise → Interest
      m = line.match(
        /Expertise:\s*([^()]+?)\s*\(([^)]+)\)\s*matched\s*Interest:\s*([^()]+?)\s*\(([^)]+)\)/i
      );
      if (m) {
        const [, expertise, expertiseHolderId, , interestHolderId] = m;
        return {
          topic: expertise.trim(),
          teacherIsMe: expertiseHolderId === currentUserId,
          learnerIsMe: interestHolderId === currentUserId,
        };
      }
    
      // Pattern 3: "topic (userId1) <> topic (userId2)"
      // This pattern assumes the left side is the teacher if it's the current user,
      // and the right side is the learner if it's the current user.
      // Adjust based on actual data structure if this assumption is wrong.
      m = line.match(/(.+?)\s*\(([^)]+)\)\s*<>\s*(.+?)\s*\(([^)]+)\)/i);
      if (m) {
        const [, leftTopic, leftHolderId, rightTopic, rightHolderId] = m;
        // Determine topic based on who is NOT the current user.
        // This assumes the topic of interest is what the *other* person offers.
        let topic = "";
        if (leftHolderId === currentUserId) { // If current user is on the left
          topic = rightTopic.trim();
        } else if (rightHolderId === currentUserId) { // If current user is on the right
          topic = leftTopic.trim();
        } else {
          // Fallback or error: current user ID doesn't match either holder.
          // This might mean the line is not for this user or is malformed.
          // For now, pick left topic as a default if a specific one can't be determined for the user.
          topic = leftTopic.trim();
        }
        return {
          topic: topic,
          teacherIsMe: leftHolderId === currentUserId, // If current user is on left, they are the teacher in this pattern
          learnerIsMe: rightHolderId === currentUserId, // If current user is on right, they are the learner
        };
      }
    
      return null; // unmatched format
    }
    
    /** Build one eloquent sentence out of all parsed lines */
    /** Build a bullet list out of all parsed matchedOn lines */
function buildTeachingSentence(
  lines: string[],
  meName: string,
  themName: string,
  currentUserId: string
) {
  const bullets: string[] = [];

  for (const line of lines) {
    const parsed = parseMatchedOn(line, currentUserId);
    if (!parsed) continue;

    const teacher = parsed.teacherIsMe ? meName : themName;
    const learner = parsed.learnerIsMe ? meName : themName;
    // Ensure that the sentence makes sense if teacher or learner is not the current user or the other user.
    // This can happen if a parsed line refers to a different set of users (edge case)
    // or if teacherIsMe and learnerIsMe are both false.
    if (parsed.teacherIsMe || parsed.learnerIsMe) {
        bullets.push(`- ${teacher} can teach ${learner} about ${parsed.topic}`);
    } else {
        // Fallback for a line that doesn't directly involve "me" as teacher or learner,
        // but still describes a teaching relationship about a topic.
        // This might need refinement based on how such lines should be presented.
        // For now, we'll assume the names passed (meName, themName) are still relevant contextually
        // if the parser implies a third-party relationship (e.g. "PersonA can teach PersonB about TopicX")
        // However, given the current parsing logic, this 'else' might be less common.
        // bullets.push(`- Regarding ${parsed.topic}, ${themName} and another user have a teaching dynamic.`);
        // Or, if lines are always about me/them:
        // logger.warn("Parsed line where current user is neither teacher nor learner:", line, parsed);
    }
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

  const [otherName, setOtherName] = useState<string>("Chat");

  const [sysMsg, setSysMsg] = useState<string | null>(null);
  const [loadingSysMsg, setLoadingSysMsg] = useState(true);

  /* ──────────────── fetch meta & system message ──────────────── */
  useEffect(() => {
    if (!chatId || !user) return;

    let unsubscribeMatchListener: (() => void) | undefined;

    const setupChat = async () => {
      setLoadingSysMsg(true);
      try {
        /* 1️⃣  who's in the chat? */
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (!chatSnap.exists()) throw new Error("Chat not found");
        const users = (chatSnap.data().users as string[]) ?? [];
        if (users.length !== 2) throw new Error("Bad chat users array");

        const me = user.uid;
        const them = users.find((u) => u !== me);
        if (!them) throw new Error("Other user not found");

        /* 2️⃣  load their display name */
        const themSnap = await getDoc(doc(db, "users", them));
        setOtherName(themSnap.exists() ? themSnap.data().displayName ?? "Chat partner" : "Chat partner");
        const currentUserDisplayName = user.displayName ?? "You";
        const actualOtherUserDisplayName =
          themSnap.exists()
            ? (themSnap.data().displayName ?? "Your chat partner")
            : "Your chat partner";

        /* 3️⃣  load match explanation (now with real-time listener) */
        const matchId = getMatchId(me, them);
        const matchRef = doc(db, "matches", matchId);

        unsubscribeMatchListener = onSnapshot(matchRef, (matchSnap) => {
          if (matchSnap.exists()) {
            const { matchedOn = [], status } = matchSnap.data();

            if (Array.isArray(matchedOn) && matchedOn.length > 0) {
              const sentence = buildTeachingSentence(
                matchedOn,
                currentUserDisplayName,
                actualOtherUserDisplayName,
                me
              );
              if (sentence) {
                setSysMsg(sentence);
              } else {
                // Fallback if buildTeachingSentence returns empty despite matchedOn having items
                setSysMsg(
                  status === "symbi"
                    ? "You have been bonnected due to symbiotic synergy!"
                    : "You've been bonnected."
                );
              }
            } else { // matchedOn is empty or not an array with length
              if (status === "stale_interest") {
                setSysMsg("This chat was originally matched based on interests or expertise that have since changed. You can continue chatting or start a new conversation based on current interests!");
              } else if (status === "symbi") {
                setSysMsg("You have been bonnected due to symbiotic synergy!");
              } else {
                setSysMsg("You've been bonnected. Start chatting!"); // Generic fallback
              }
            }
          } else {
            setSysMsg("You've been matched! Start chatting."); // Match document doesn't exist
          }
          setLoadingSysMsg(false);
        }, (error) => {
          console.error("Error listening to match document:", error);
          setSysMsg("Unable to load match details. Start chatting anyway!");
          setLoadingSysMsg(false);
        });

      } catch (err) {
        console.error(err);
        setSysMsg("Unable to load chat details. Start chatting anyway!");
        setLoadingSysMsg(false);
      }
    };

    setupChat();

    // Cleanup listener on component unmount or when dependencies change
    return () => {
      if (unsubscribeMatchListener) {
        unsubscribeMatchListener();
      }
    };
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
    <div className="flex flex-col h-screen bg-gray-900 w-full max-w-3xl mx-auto">
      {/* header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-100">{otherName}</h2>
        <Link href="/dashboard" legacyBehavior>
          <a className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium">
            Back to Dashboard
          </a>
        </Link>
      </div>

      {/* message list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2" style={{ scrollbarWidth: 'none' }}>
        {loadingSysMsg && (
          <div className="my-2 p-3 text-center text-sm text-gray-400">Loading chat information…</div>
        )}
        {!loadingSysMsg && sysMsg && (
          <div className="my-2 p-4 bg-gray-700 rounded-lg text-center text-sm text-gray-300 shadow-md whitespace-pre-line">
            {sysMsg}
          </div>
        )}

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
                className={`max-w-[75%] py-2 px-4 rounded-full shadow ${
                  mine
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-200"
                }`}
              >
                <p className="text-sm leading-relaxed">{m.text}</p>
                {mine && ts !== "Sending…" && (
                   <p className="text-xs mt-0.5 text-blue-200 text-right">{ts}</p>
                )}
              </div>
              {/* Reactions/options placeholder removed */}
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
        className="p-3 border border-gray-600 rounded-xl flex items-center gap-2 bg-gray-800 mx-4 mb-4 w-full max-w-xl"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border-none rounded-full px-4 py-3 bg-gray-700 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-0 resize-none overflow-hidden leading-relaxed text-base"
          placeholder='Example : &quot;Explain quantum computing in simple terms&quot;'>
        </input>
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-green-600 text-white p-3 rounded-lg disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  );
}