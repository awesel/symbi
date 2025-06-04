import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Timestamp } from 'firebase/firestore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Stats {
  totalMatches: number;
  totalMessages: number;
  totalUsers: number;
  mostActiveChat: {
    id: string;
    messageCount: number;
  };
}

interface ChatData {
  id: string;
  users: string[];
  lastMessage: string;
  lastTimestamp: Timestamp | null;
  messageCount: number;
  messages: Array<{
    text: string;
    sender: string;
    timestamp: Timestamp | null;
  }>;
}

const ModeratorPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [chats, setChats] = useState<ChatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesPerUser, setMessagesPerUser] = useState<{ [key: string]: number }>({});
  const [messagesPerChat, setMessagesPerChat] = useState<{ [key: string]: number }>({});
  const [chatsPerUser, setChatsPerUser] = useState<{ [key: string]: number }>({});
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch all users first to get their names
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const userNamesMap: { [key: string]: string } = {};
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          userNamesMap[doc.id] = userData.displayName?.split(' ')[0] || userData.email?.split('@')[0] || 'Unknown User';
        });
        setUserNames(userNamesMap);

        // Fetch all chats
        const chatsSnapshot = await getDocs(collection(db, 'chats'));
        const chatsData: ChatData[] = [];
        const userMessageCounts: { [key: string]: number } = {};
        const chatMessageCounts: { [key: string]: number } = {};
        const userChatCounts: { [key: string]: number } = {};

        for (const chatDoc of chatsSnapshot.docs) {
          const chatData = chatDoc.data();
          const messagesSnapshot = await getDocs(collection(db, `chats/${chatDoc.id}/messages`));
          const messageCount = messagesSnapshot.size;

          // Update message counts per user
          messagesSnapshot.forEach((msgDoc) => {
            const msgData = msgDoc.data();
            const senderId = msgData.sender;
            userMessageCounts[senderId] = (userMessageCounts[senderId] || 0) + 1;
          });

          // Update chat counts per user
          chatData.users.forEach((userId: string) => {
            userChatCounts[userId] = (userChatCounts[userId] || 0) + 1;
          });

          chatMessageCounts[chatDoc.id] = messageCount;

          // Get all messages for this chat
          const messages = messagesSnapshot.docs.map(msgDoc => {
            const data = msgDoc.data();
            return {
              text: data.text || '',
              sender: data.sender || 'Unknown',
              timestamp: data.timestamp || null
            };
          }).sort((a, b) => {
            // Sort by timestamp, handling null cases
            if (!a.timestamp) return -1;
            if (!b.timestamp) return 1;
            return a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime();
          });

          chatsData.push({
            id: chatDoc.id,
            users: chatData.users || [],
            lastMessage: chatData.lastMessage || '',
            lastTimestamp: chatData.lastTimestamp || null,
            messageCount,
            messages
          });
        }

        // Calculate total messages
        const totalMessages = Object.values(userMessageCounts).reduce((a, b) => a + b, 0);

        // Find most active chat
        const mostActiveChat = Object.entries(chatMessageCounts)
          .reduce((max, [id, count]) => count > max.messageCount ? { id, messageCount: count } : max, { id: '', messageCount: 0 });

        setStats({
          totalMatches: chatsData.length,
          totalMessages,
          totalUsers: usersSnapshot.size,
          mostActiveChat,
        });

        setChats(chatsData);
        setMessagesPerUser(userMessageCounts);
        setMessagesPerChat(chatMessageCounts);
        setChatsPerUser(userChatCounts);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  const messagesPerUserData = {
    labels: Object.entries(messagesPerUser)
      .sort(([, a], [, b]) => b - a)
      .map(([label]) => label),
    datasets: [
      {
        label: 'Messages per User',
        data: Object.entries(messagesPerUser)
          .sort(([, a], [, b]) => b - a)
          .map(([, value]) => value),
        backgroundColor: 'rgba(159, 116, 255, 0.5)',
      },
    ],
  };

  const messagesPerChatData = {
    labels: Object.entries(messagesPerChat)
      .sort(([, a], [, b]) => b - a)
      .map(([label]) => label),
    datasets: [
      {
        label: 'Messages per Chat',
        data: Object.entries(messagesPerChat)
          .sort(([, a], [, b]) => b - a)
          .map(([, value]) => value),
        backgroundColor: 'rgba(116, 159, 255, 0.5)',
      },
    ],
  };

  const chatsPerUserData = {
    labels: Object.entries(chatsPerUser)
      .sort(([, a], [, b]) => b - a)
      .map(([label]) => label),
    datasets: [
      {
        label: 'Chats per User',
        data: Object.entries(chatsPerUser)
          .sort(([, a], [, b]) => b - a)
          .map(([, value]) => value),
        backgroundColor: 'rgba(116, 255, 159, 0.5)',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Moderator Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Total Matches</h2>
          <p className="text-2xl">{stats?.totalMatches}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Total Messages</h2>
          <p className="text-2xl">{stats?.totalMessages}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Total Users</h2>
          <p className="text-2xl">{stats?.totalUsers}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Most Active Chat</h2>
          <p className="text-2xl">{stats?.mostActiveChat.messageCount} messages</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Messages per User</h2>
          <Bar options={chartOptions} data={{
            ...messagesPerUserData,
            labels: messagesPerUserData.labels.map(id => userNames[id] || id)
          }} />
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Messages per Chat</h2>
          <Bar options={chartOptions} data={messagesPerChatData} />
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Chats per User</h2>
          <Bar options={chartOptions} data={{
            ...chatsPerUserData,
            labels: chatsPerUserData.labels.map(id => userNames[id] || id)
          }} />
        </div>
      </div>

      {/* Chat List */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">All Chats</h2>
        <div className="space-y-4">
          {chats
            .sort((a, b) => b.messageCount - a.messageCount)
            .map((chat) => (
            <div key={chat.id} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="font-semibold">Chat ID: {chat.id}</p>
                  <p className="text-sm text-gray-400">
                    Users: {chat.users.map(userId => userNames[userId] || userId).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">Messages: {chat.messageCount}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-gray-300">All Messages:</p>
                {chat.messages && chat.messages.length > 0 ? (
                  chat.messages.map((msg, index) => (
                    <div key={index} className="bg-gray-600 p-2 rounded">
                      <p className="text-sm text-gray-300">
                        From: {userNames[msg.sender] || msg.sender}
                      </p>
                      <p className="text-sm">{msg.text}</p>
                      <p className="text-xs text-gray-400">
                        {msg.timestamp?.toDate?.()?.toLocaleString() || 'No timestamp'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No messages in this chat</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModeratorPage; 