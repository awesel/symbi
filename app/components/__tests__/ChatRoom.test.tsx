import { render, screen } from '@testing-library/react';
import ChatRoom from '../ChatRoom';
import { useAuth } from '../../../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

// Mock the auth context
jest.mock('../../../contexts/AuthContext');
jest.mock('../../../lib/firebase', () => ({
  db: {},
}));

describe('ChatRoom', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user1', displayName: 'Test User' }
    });
  });

  it('shows date separator between messages from different days', () => {
    const messages = [
      {
        id: '1',
        text: 'Message 1',
        sender: 'user1',
        timestamp: Timestamp.fromDate(new Date('2024-03-20T10:00:00')),
      },
      {
        id: '2',
        text: 'Message 2',
        sender: 'user2',
        timestamp: Timestamp.fromDate(new Date('2024-03-21T10:00:00')),
      }
    ];

    render(<ChatRoom chatId="test-chat" />);
    
    // Mock the messages state
    const messageElements = screen.getAllByText(/Message \d/);
    expect(messageElements).toHaveLength(2);
    
    // Check for date separator
    const dateSeparator = screen.getByText('March 21, 2024');
    expect(dateSeparator).toBeInTheDocument();
  });
}); 