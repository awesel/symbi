import * as nodemailer from "nodemailer";
// import * as functions from "firebase-functions";
// import * as dotenv from "dotenv";
// dotenv.config(); // Load .env into process.env

// Default values, can be overridden by environment variables
const DEFAULT_EMAIL_FROM = "\"Symbi\" <no-reply@symbi.club>";
const DEFAULT_APP_URL = "https://symbi.club";

const DO_NOT_SEND_LIST: string[] = [
  "rycereyn@stanford.edu",
];

let transporterInstance: nodemailer.Transporter | null = null;

/**
 * Gets or creates a nodemailer transporter instance using environment variables
 * @return {nodemailer.Transporter} A configured nodemailer transporter
 * @throws {Error} If EMAIL_USER or EMAIL_PASS environment variables are missing
 */
function getTransporter(): nodemailer.Transporter {
  if (transporterInstance) {
    return transporterInstance;
  }

  const { EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("CRITICAL: Missing EMAIL_USER or EMAIL_PASS environment variables for nodemailer transporter. Ensure secrets are set and deployed correctly.");
    throw new Error("Missing EMAIL_USER or EMAIL_PASS for email service.");
  }

  transporterInstance = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return transporterInstance;
}

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
  const {
    EMAIL_FROM = DEFAULT_EMAIL_FROM,
    APP_URL = DEFAULT_APP_URL,
  } = process.env;

  if (DO_NOT_SEND_LIST.includes(userEmail.toLowerCase())) {
    console.log(`Skipping email to ${userEmail} as it is on the do-not-send list.`);
    return;
  }

  const transporter = getTransporter();

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
          <a href="${APP_URL}/chat/${chat.chatId}">Reply now</a>
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
    from: EMAIL_FROM,
    to: userEmail,
    bcc: "awesel@stanford.edu",
    subject: subjectLine,
    html: emailContent,
  });
}
