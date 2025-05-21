import { Timestamp } from 'firebase/firestore';

export interface UserDoc {
  email: string;
  displayName: string;
  bio: string;
  interests: string[];
  expertise: string[];
  createdAt: Timestamp;
  lastActive: Timestamp;
}

export interface TagDoc {
  tag: string;
  count: number;
  type: Array<'interest' | 'expertise'>;
}

export interface MatchDoc {
  userA: string;
  userB: string;
  score: number;
  matchedOn: string[];
  chatId: string | null;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: Timestamp;
}

export interface ChatDoc {
  users: [string, string];
  lastMessage: string;
  lastTimestamp: Timestamp;
  createdAt: Timestamp;
}

export interface MessageDoc {
  sender: string;
  text: string;
  timestamp: Timestamp;
}

export interface ReportDoc {
  reporter: string;
  reportedUser: string;
  reason: string;
  chatId?: string;
  timestamp: Timestamp;
}

// Type-only test
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const u: UserDoc = {
  email: 'test@example.com',
  displayName: 'Test User',
  bio: 'This is a test bio.',
  interests: ['coding', 'testing'],
  expertise: ['typescript', 'firebase'],
  createdAt: Timestamp.now(),
  lastActive: Timestamp.now(),
}; 