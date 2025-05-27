import * as nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface UnrespondedChat {
  chatId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageTime: Date;
}

/**
 * Formats a date into a human-readable time ago string
 * @param {Date} date - The date to format
 * @return {string} A string like "2 hours ago" or "3 days ago"
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} days ago`;
}

/**
 * Sends an email to a user about their unresponded messages
 * @param {string} userEmail - The email address of the user
 * @param {UnrespondedChat[]} unrespondedChats - Array of chats with unresponded messages
 */
export async function sendUnrespondedMessagesEmail(
  userEmail: string,
  unrespondedChats: UnrespondedChat[]
) {
  const emailContent = `
    <h2>You have unresponded messages!</h2>
    <p>You have ${unrespondedChats.length} conversations waiting for your response:</p>
    <ul>
      ${unrespondedChats.map((chat) => `
        <li>
          <strong>${chat.otherUserName}</strong> sent you a message ${formatTimeAgo(chat.lastMessageTime)}:
          <br/>
          "${chat.lastMessage}"
          <br/>
          <a href="${process.env.APP_URL}/chat/${chat.chatId}">Reply now</a>
        </li>
      `).join("")}
    </ul>
    <p style="margin-top: 20px; font-size: 12px; color: #666;">
      To unsubscribe from these notifications, text "Unsubscribe ${userEmail}" to 3109139060
    </p>
  `;

  let subjectLine: string;
  if (unrespondedChats.length === 1) {
    subjectLine = `${unrespondedChats[0].otherUserName} wants to learn from you on Symbi!`;
  } else {
    subjectLine = `${unrespondedChats.length} people have sent you messages on Symbi!`;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: userEmail,
    bcc: "awesel@stanford.edu",
    subject: subjectLine,
    html: emailContent,
  });
}
