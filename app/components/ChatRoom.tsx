// app/components/ChatRoom.tsx
import { useState, useEffect, useRef } from "react";
import { doc, collection, addDoc, serverTimestamp,
         onSnapshot, orderBy, query, updateDoc, Timestamp, getDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";          // whatever hook returns {user}
import { db } from "../../lib/firebase";              // your initialized Firestore
import { format } from 'date-fns'; // Import date-fns for timestamp formatting
import Link from 'next/link'; // Added Link import

type ChatRoomProps = { chatId: string };

/** Parse one match-explanation line
    Supports either…
      "Expertise: history (yours) matched Interest: syrian history (theirs)"
    -or- "fashion (yours) <> fashion (theirs)"
    Returns { yoursTopic, theirsTopic, yoursRole, theirsRole }
*/
function parseMatchText(text: string) {
  let yoursTopic: string | null = null;
  let theirsTopic: string | null = null;
  let yoursRole: "expert" | "interest" | null = null;
  let theirsRole: "expert" | "interest" | null = null;

  // --- format A: "Expertise: … matched Interest: …"
  const expRE = /Expertise:\s*([^()]+?)\s*\((yours|theirs)\)/i;
  const intRE = /Interest:\s*([^()]+?)\s*\((yours|theirs)\)/i;
  const expM = text.match(expRE);
  const intM = text.match(intRE);
  if (expM && intM) {
    const [, expTopic, expWhose] = expM;
    const [, intTopic, intWhose] = intM;
    if (expWhose === "yours") {
      yoursTopic = expTopic.trim();
      yoursRole  = "expert";
    } else {
      theirsTopic = expTopic.trim();
      theirsRole  = "expert";
    }
    if (intWhose === "yours") {
      yoursTopic = intTopic.trim();
      yoursRole  = "interest";
    } else {
      theirsTopic = intTopic.trim();
      theirsRole  = "interest";
    }
    return { yoursTopic, theirsTopic, yoursRole, theirsRole };
  }

  // --- format B: "topic (yours) <> topic (theirs)"
  if (text.includes(" <> ")) {
    const [left, right] = text.split(" <> ");
    const partRE = /(.+?)\s*\((yours|theirs)\)/i;
    const l = left.match(partRE);
    const r = right.match(partRE);
    if (l) {
      (l[2] === "yours" ? (yoursTopic = l[1].trim()) : (theirsTopic = l[1].trim()));
    }
    if (r) {
      (r[2] === "yours" ? (yoursTopic = r[1].trim()) : (theirsTopic = r[1].trim()));
    }
    // roles unknown → treat both as "interest"
    yoursRole = yoursRole ?? "interest";
    theirsRole = theirsRole ?? "interest";
  }

  return { yoursTopic, theirsTopic, yoursRole, theirsRole };
}

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
  const [otherUserName, setOtherUserName] = useState<string>("Chat"); // Added state for other user's name
  const [otherUserUID, setOtherUserUID] = useState<string | null>(null); // Added state for other user's UID

  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [isLoadingSystemMessage, setIsLoadingSystemMessage] = useState<boolean>(true);

  /* Effect to fetch match details and set system message */
  useEffect(() => {
    if (!chatId || !user) {
      setIsLoadingSystemMessage(false);
      setOtherUserUID(null); // Reset other user UID
      return;
    }

    const fetchMatchDetails = async () => {
      setIsLoadingSystemMessage(true);
      setOtherUserUID(null); 
      try {
        const chatDocRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatDocRef);

        if (!chatSnap.exists()) {
          setSystemMessage("Chat details not found.");
          setOtherUserName("Chat"); 
          setOtherUserUID(null);
          return;
        }

        const chatData = chatSnap.data();
        const usersInChat = chatData.users as string[];
        if (!usersInChat || usersInChat.length !== 2) {
          setSystemMessage("Invalid chat participants configuration.");
          setOtherUserName("Chat"); 
          setOtherUserUID(null);
          return;
        }

        const currentUserActualUID = user.uid;
        const identifiedOtherUserUID = usersInChat.find(uid => uid !== currentUserActualUID);

        if (!identifiedOtherUserUID) {
          setSystemMessage("Could not identify the other user in this chat.");
          setOtherUserName("Chat"); 
          setOtherUserUID(null);
          return;
        }
        setOtherUserUID(identifiedOtherUserUID); 

        const currentUserDocRef = doc(db, "users", currentUserActualUID);
        const currentUserSnap = await getDoc(currentUserDocRef);
        const currentUserData = currentUserSnap.exists() ? currentUserSnap.data() : null;

        const otherUserDocRef = doc(db, "users", identifiedOtherUserUID);
        const otherUserSnap = await getDoc(otherUserDocRef);
        const otherUserData = otherUserSnap.exists() ? otherUserSnap.data() : null;

        const currentUserDisplayName = currentUserData?.displayName || "You";
        const actualOtherUserDisplayName = otherUserData?.displayName || "Your chat partner";
        setOtherUserName(otherUserData?.displayName || "Chat");


        if (currentUserData && otherUserData) {
          const currentUserInterests: string[] = currentUserData.interests || [];
          const currentUserExpertise: string[] = currentUserData.expertise || [];
          const otherUserInterests: string[] = otherUserData.interests || [];
          const otherUserExpertise: string[] = otherUserData.expertise || [];

          const learningPoints: string[] = [];

          // Current user is interested, other user is expert
          currentUserInterests.forEach(interest => {
            if (otherUserExpertise.includes(interest)) {
              learningPoints.push(`- ${currentUserDisplayName} can learn about "${interest}" from ${actualOtherUserDisplayName}.`);
            }
          });

          // Other user is interested, current user is expert
          otherUserInterests.forEach(interest => {
            if (currentUserExpertise.includes(interest)) {
              learningPoints.push(`- ${actualOtherUserDisplayName} can learn about "${interest}" from ${currentUserDisplayName}.`);
            }
          });
          
          // No need to deduplicate since we want to show both directions of learning
          if (learningPoints.length > 0) {
            const messageBody = learningPoints.join('\n');
            setSystemMessage(
              `Here's some common ground and what you might learn from each other:\n${messageBody}`
            );
          } else {
            // Fallback to original match logic
            let interestedUserDisplayNameFallback = "";
            let knowledgeableUserDisplayNameFallback = "";
            let topic: string | null = null;

            const matchDocRef1 = doc(db, "matches", `${currentUserActualUID}_${identifiedOtherUserUID}`);
            const matchSnap1 = await getDoc(matchDocRef1);

            if (matchSnap1.exists() && matchSnap1.data()?.matchedOn) {
              const matchedOnData = matchSnap1.data()?.matchedOn;
              if (Array.isArray(matchedOnData) && matchedOnData.length > 0) {
                const matchText = matchedOnData[0];
                if (matchText && typeof matchText === 'string') {
                  if (matchText.includes("Expertise:") && matchText.includes("Interest:")) {
                    const [expertise, interest] = matchText.split(" <> ");
                    if (expertise && interest) {
                      topic = `${expertise.split("Expertise: ")[1]?.split(" (yours)")[0] || ''} and ${interest.split("Interest: ")[1]?.split(" (theirs)")[0] || ''}`;
                    }
                  } else {
                    topic = matchText.split(" (yours) <>")[0] || '';
                  }
                }
              } else if (typeof matchedOnData === 'string') {
                if (matchedOnData.includes("Expertise:") && matchedOnData.includes("Interest:")) {
                  const [expertise, interest] = matchedOnData.split(" <> ");
                  if (expertise && interest) {
                    topic = `${expertise.split("Expertise: ")[1]?.split(" (yours)")[0] || ''} and ${interest.split("Interest: ")[1]?.split(" (theirs)")[0] || ''}`;
                  }
                } else {
                  topic = matchedOnData.split(" (yours) <>")[0] || '';
                }
              }
              interestedUserDisplayNameFallback = currentUserDisplayName;
              knowledgeableUserDisplayNameFallback = actualOtherUserDisplayName;
            } else {
              const matchDocRef2 = doc(db, "matches", `${identifiedOtherUserUID}_${currentUserActualUID}`);
              const matchSnap2 = await getDoc(matchDocRef2);
              if (matchSnap2.exists() && matchSnap2.data()?.matchedOn) {
                const matchedOnData = matchSnap2.data()?.matchedOn;
                if (Array.isArray(matchedOnData) && matchedOnData.length > 0) {
                  const matchText = matchedOnData[0];
                  if (matchText && typeof matchText === 'string') {
                    let topic: string | null = null;
                    let finalMsg: string | null = null;

                    if (typeof matchedOnData === "string") {
                      const { yoursTopic, theirsTopic, yoursRole, theirsRole } =
                        parseMatchText(matchedOnData);

                      if (yoursTopic && theirsTopic) {
                        // different topics or different roles → spell out both directions
                        if (yoursTopic !== theirsTopic || yoursRole !== theirsRole) {
                          finalMsg = `${currentUserDisplayName} is ${
                            yoursRole === "expert" ? "knowledgeable about" : "interested in"
                          } "${yoursTopic}" and ${actualOtherUserDisplayName} is ${
                            theirsRole === "expert" ? "knowledgeable about" : "interested in"
                          } "${theirsTopic}".`;
                        } else {
                          // same topic & role → simple overlap message
                          finalMsg = `You both share a passion for "${yoursTopic}". Dive in!`;
                        }
                      }
                    }

                    if (finalMsg) {
                      setSystemMessage(finalMsg);
                    } else {
                      // Generic message if no specific learning points or match topic found
                      setSystemMessage(`You and ${actualOtherUserDisplayName} are now bonnected. Start chatting!`);
                    }
                  }
                }
              }
            }

            if (topic && interestedUserDisplayNameFallback && knowledgeableUserDisplayNameFallback) {
              setSystemMessage(
                `You were matched because ${interestedUserDisplayNameFallback} was interested in "${topic}" that ${knowledgeableUserDisplayNameFallback} knows a lot about.`
              );
            } else {
              // Generic message if no specific learning points or match topic found
              setSystemMessage(`You and ${actualOtherUserDisplayName} are now bonnected. Start chatting!`);
            }
          }
        } else {
          // Message if profile data couldn't be loaded
          setSystemMessage("Could not load profile information to determine mutual interests or expertise.");
        }
      } catch (error) {
        console.error("Error fetching match details for system message:", error);
        // Add more detailed error logging
        if (error instanceof Error) {
          console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            chatId,
            userId: user?.uid
          });
        }
        setSystemMessage("Error loading chat information. Please try refreshing the page.");
      } finally {
        setIsLoadingSystemMessage(false);
      }
    };

    fetchMatchDetails();
  }, [chatId, user]);

  /* 2️⃣ realtime listener */
  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, snap => {
      const allMessages = snap.docs.map(d => ({ id: d.id, ...(d.data() as MessageData) }));
      // Filter messages to only include those from the current user or the other user in the chat
      const filteredMessages = allMessages.filter(
        msg => user && (msg.sender === user.uid || (otherUserUID && msg.sender === otherUserUID))
      );
      setMessages(filteredMessages);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return unsub;
  }, [chatId, user, otherUserUID]);

  /* 3️⃣ send message */
  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      sender: user.uid,
      text: input.trim(),
      timestamp: serverTimestamp(),
      photoURL: user.photoURL,
      displayName: user.displayName
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
        <h2 className="text-xl font-semibold text-gray-800">{otherUserName}</h2>
        <Link href="/dashboard" legacyBehavior>
          <a className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
            Back to Dashboard
          </a>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {isLoadingSystemMessage && (
          <div className="my-2 p-3 text-center text-sm text-gray-500">
            <p>Loading chat information...</p>
          </div>
        )}
        {!isLoadingSystemMessage && systemMessage && (
          <div className="my-2 p-3 bg-gray-100 rounded-lg text-center text-sm text-gray-700 shadow">
            <p style={{ whiteSpace: 'pre-line' }}>{systemMessage}</p>
          </div>
        )}
        {messages.map(m => {
          const isUser = m.sender === user?.uid;
          const timestamp = m.timestamp?.toDate ? format(m.timestamp.toDate(), 'Pp') : 'Sending...';

          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
              <div
                className={`max-w-[70%] p-3 rounded-lg shadow-md ${
                  isUser
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
                }`}
              >
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