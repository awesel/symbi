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
    render(<ChatRoom chatId="test-chat" />);
    
    // Mock the messages state
    const messageElements = screen.getAllByText(/Message \d/);
    expect(messageElements).toHaveLength(2);
    
    // Check for date separator
    const dateSeparator = screen.getByText('March 21, 2024');
    expect(dateSeparator).toBeInTheDocument();
  });
}); 