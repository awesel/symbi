/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
// import * as functionsV1 from "firebase-functions";
import Fuse from "fuse.js";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendUnrespondedMessagesEmail } from "./email";

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Function to slugify tags
const slugify = (tag: string): string => {
  return tag.toLowerCase().replace(/\s+/g, "-");
};

export const incrementTagCount = onDocumentWritten("users/{uid}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  const rawBeforeInterests: string[] = beforeData?.interests || [];
  const rawBeforeExpertise: string[] = beforeData?.expertise || [];
  const rawAfterInterests: string[] = afterData?.interests || [];
  const rawAfterExpertise: string[] = afterData?.expertise || [];

  // Helper to process tags: trim, slugify, then filter empty slugs
  const getProcessedSlugs = (tags: string[]): string[] => {
    return tags
      .map((tag) => tag.trim()) // Trim whitespace
      .map(slugify) // Slugify
      .filter((slug) => slug !== ""); // Filter out any empty slugs
  };

  const sluggedBeforeInterests = getProcessedSlugs(rawBeforeInterests);
  const sluggedBeforeExpertise = getProcessedSlugs(rawBeforeExpertise);
  const sluggedAfterInterests = getProcessedSlugs(rawAfterInterests);
  const sluggedAfterExpertise = getProcessedSlugs(rawAfterExpertise);

  const beforeTags = new Set([...sluggedBeforeInterests, ...sluggedBeforeExpertise]);
  const afterTags = new Set([...sluggedAfterInterests, ...sluggedAfterExpertise]);

  if (beforeTags.size === 0 && afterTags.size === 0 && !event.data?.before.exists && event.data?.after.exists) {
    // This condition specifically targets new user creation with no tags.
    // For updates from some tags to no tags, or deletion, we still need to proceed.
    logger.info("New user created with no tags. No tag counts to update.");
    return;
  }

  const db = admin.firestore();
  const batch = db.batch();
  let batchHasOperations = false;

  // Tags added
  for (const tag of afterTags) {
    const tagRef = db.collection("tags_used").doc(tag);
    const isNewTagForUser = !beforeTags.has(tag);

    const currentSluggedInterests = new Set(sluggedAfterInterests);
    const currentSluggedExpertise = new Set(sluggedAfterExpertise);

    const isInterest = currentSluggedInterests.has(tag);
    const isExpertise = currentSluggedExpertise.has(tag);

    if (isNewTagForUser) {
      const newType = new Set<string>();
      if (isInterest) newType.add("interest");
      if (isExpertise) newType.add("expertise");

      batch.set(tagRef, {
        tag: tag,
        count: FieldValue.increment(1),
        type: Array.from(newType),
      }, { merge: true });
      batchHasOperations = true;
    } else {
      // Tag already existed for this user. Check if its global type needs updating.
      const tagDocSnapshot = await tagRef.get(); // Renamed to avoid conflict
      const existingTypesFromDb: string[] = tagDocSnapshot.data()?.type || [];
      const newTypeSet = new Set(existingTypesFromDb);
      let typesChanged = false;

      if (isInterest && !existingTypesFromDb.includes("interest")) {
        newTypeSet.add("interest");
        typesChanged = true;
      }
      if (isExpertise && !existingTypesFromDb.includes("expertise")) {
        newTypeSet.add("expertise");
        typesChanged = true;
      }

      if (typesChanged) {
        batch.update(tagRef, { type: Array.from(newTypeSet) });
        batchHasOperations = true;
      }
    }
  }

  // Tags removed
  for (const tag of beforeTags) {
    if (!afterTags.has(tag)) {
      const tagRef = db.collection("tags_used").doc(tag);
      const tagDoc = await tagRef.get(); // Keep as is, it's a different scope
      if (tagDoc.exists) { // Check existence before trying to access data
        const currentCount = tagDoc.data()?.count;
        if (typeof currentCount === "number" && currentCount > 0) {
          batch.update(tagRef, { count: FieldValue.increment(-1) });
          batchHasOperations = true;
        } else if (typeof currentCount === "number" && currentCount <= 0) {
          // If count is already 0 or less, ensure it's set to 0.
          // This also handles the case where count might be undefined or not a number.
          if (currentCount !== 0) { // Avoid unnecessary write if already 0
            batch.update(tagRef, { count: 0 });
            batchHasOperations = true;
          }
        }
        // Note: Type array is not modified on removal here.
      }
    }
  }

  if (batchHasOperations) {
    try {
      await batch.commit();
      logger.info("Tag counts updated successfully.");
    } catch (error) {
      logger.error("Error updating tag counts:", error);
    }
  } else {
    logger.info("No batch operations to commit for tag counts.");
  }
});

interface UserProfileData {
  interests: string[];
  expertise: string[];
  // Add other fields if needed for matching, though current logic only uses these
}

// Function to generate matches
export const generateMatches = onDocumentWritten("users/{uid}", async (event) => {
  const changedUserSnapshot = event.data?.after;
  const changedUserId = event.params.uid;

  if (!changedUserSnapshot?.exists) {
    logger.log(`User ${changedUserId} deleted, skipping match generation.`);
    // Optionally, handle match cleanup if a user is deleted.
    return;
  }

  const changedUserData = changedUserSnapshot.data() as UserProfileData;
  if (!changedUserData || (!changedUserData.interests?.length && !changedUserData.expertise?.length)) {
    logger.log(`User ${changedUserId} has no interests or expertise, skipping match generation.`);
    return;
  }

  const allUsersRef = admin.firestore().collection("users");
  const allUsersSnapshot = await allUsersRef.get();

  const potentialMatches: { id: string; profile: UserProfileData }[] = [];
  allUsersSnapshot.forEach((doc) => {
    if (doc.id !== changedUserId) {
      potentialMatches.push({ id: doc.id, profile: doc.data() as UserProfileData });
    }
  });

  if (!potentialMatches.length) {
    logger.log("No other users found to match with.");
    return;
  }

  // Fuse.js setup for interests vs expertise and vice-versa
  const fuseOptions = {
    includeScore: true,
    threshold: 0.2, // Adjusted threshold for fuzzy matching
    minMatchCharLength: 1,
    isCaseSensitive: false,
  };

  const batch = admin.firestore().batch();
  const matchesCollection = admin.firestore().collection("matches");
  const chatsCollection = admin.firestore().collection("chats");

  const stillValidCandidateIds = new Set<string>(); // Keep track of valid matches

  // Normalize tags for the changed user once
  const changedUserInterestsLower = (changedUserData.interests || []).map((t) => t.toLowerCase());
  const changedUserExpertiseLower = (changedUserData.expertise || []).map((t) => t.toLowerCase());

  for (const candidate of potentialMatches) {
    if (!candidate.profile || (!candidate.profile.interests?.length && !candidate.profile.expertise?.length)) {
      continue; // Skip candidates with no tags
    }

    // Normalize tags for the candidate user
    const candidateInterestsLower = (candidate.profile.interests || []).map((t) => t.toLowerCase());
    const candidateExpertiseLower = (candidate.profile.expertise || []).map((t) => t.toLowerCase());

    let score1 = 0;
    let bestPair1: { score: number; interest: string; expertise: string } | null = null;

    if (changedUserInterestsLower.length && candidateExpertiseLower.length) {
      const fuseExpertise = new Fuse(candidateExpertiseLower, fuseOptions);
      let currentBestFuseScore1 = 1.0;

      for (const interest of changedUserInterestsLower) {
        const results = fuseExpertise.search(interest);
        if (results.length > 0) {
          const bestMatchInExpertiseForThisInterest = results.reduce(
            (min, r) => ((r.score ?? 1) < (min.score ?? 1) ? r : min),
            { score: 1.0, item: "", refIndex: -1 }
          );

          if ((bestMatchInExpertiseForThisInterest.score ?? 1) < currentBestFuseScore1) {
            currentBestFuseScore1 = bestMatchInExpertiseForThisInterest.score ?? 1;
            // Store original casing for display/logging if needed, but match on lowercased
            // For simplicity, we'll use the lowercased versions directly for now.
            // If original casing is needed for finalMatchedOnTags, retrieve original tags by index or map.
            // For now, bestPair stores the items as found by Fuse (which were lowercased inputs)
            bestPair1 = {
              score: currentBestFuseScore1,
              interest: interest, // This is already from changedUserInterestsLower
              expertise: bestMatchInExpertiseForThisInterest.item, // This is from candidateExpertiseLower
            };
          }
        }
      }
      if (bestPair1) {
        score1 = (1 - bestPair1.score) * 100;
      }
    }

    let score2 = 0;
    let bestPair2: { score: number; expertise: string; interest: string } | null = null;

    if (changedUserExpertiseLower.length && candidateInterestsLower.length) {
      const fuseInterests = new Fuse(candidateInterestsLower, fuseOptions);
      let currentBestFuseScore2 = 1.0;

      for (const expertiseItem of changedUserExpertiseLower) {
        const results = fuseInterests.search(expertiseItem);
        if (results.length > 0) {
          const bestMatchInInterestsForThisExpertise = results.reduce(
            (min, r) => ((r.score ?? 1) < (min.score ?? 1) ? r : min),
            { score: 1.0, item: "", refIndex: -1 }
          );

          if ((bestMatchInInterestsForThisExpertise.score ?? 1) < currentBestFuseScore2) {
            currentBestFuseScore2 = bestMatchInInterestsForThisExpertise.score ?? 1;
            bestPair2 = {
              score: currentBestFuseScore2,
              expertise: expertiseItem, // This is from changedUserExpertiseLower
              interest: bestMatchInInterestsForThisExpertise.item, // This is from candidateInterestsLower
            };
          }
        }
      }
      if (bestPair2) {
        score2 = (1 - bestPair2.score) * 100;
      }
    }

    const finalScore = Math.max(score1, score2);

    if (finalScore >= 80) {
      stillValidCandidateIds.add(candidate.id); // Add candidate to set of valid matches

      const userA = changedUserId < candidate.id ? changedUserId : candidate.id;
      const userB = changedUserId < candidate.id ? candidate.id : changedUserId;
      const matchId = `${userA}_${userB}`;

      const matchDocRef = matchesCollection.doc(matchId);

      // ---- START OF MODIFIED SECTION FOR MATCH STATUS AND TAGS ----
      const finalMatchedOnTagsOutput: string[] = [];
      let determinedMatchStatus: string;

      // score1: changedUser's interests vs candidate's expertise
      // score2: changedUser's expertise vs candidate's interests
      const changedUserLikesCandidateExpertise = score1 >= 80 && bestPair1?.interest && bestPair1?.expertise;
      const candidateLikesChangedUserExpertise = score2 >= 80 && bestPair2?.expertise && bestPair2?.interest;

      const isSymbi = changedUserLikesCandidateExpertise && candidateLikesChangedUserExpertise;

      if (isSymbi) {
        determinedMatchStatus = "symbi";
        // Add descriptions for both directions of the match
        const desc1 = `Interest: ${bestPair1!.interest} (${changedUserId}) matched Expertise: ${bestPair1!.expertise} (${candidate.id})`;
        finalMatchedOnTagsOutput.push(desc1);
        const desc2 = `Expertise: ${bestPair2!.expertise} (${changedUserId}) matched Interest: ${bestPair2!.interest} (${candidate.id})`;
        // Add second description only if it's meaningfully different (e.g., not just swapped terms of the same underlying pair)
        if (desc1.toLowerCase() !== desc2.toLowerCase()) {
          finalMatchedOnTagsOutput.push(desc2);
        }
      } else if (changedUserLikesCandidateExpertise && score1 >= score2) { // score1 is the primary or equal reason
        determinedMatchStatus = "accepted";
        const desc1 = `Interest: ${bestPair1!.interest} (${changedUserId}) matched Expertise: ${bestPair1!.expertise} (${candidate.id})`;
        finalMatchedOnTagsOutput.push(desc1);
      } else if (candidateLikesChangedUserExpertise) { // score2 is the primary or only reason
        determinedMatchStatus = "accepted";
        const desc2 = `Expertise: ${bestPair2!.expertise} (${changedUserId}) matched Interest: ${bestPair2!.interest} (${candidate.id})`;
        finalMatchedOnTagsOutput.push(desc2);
      } else {
        // This case implies finalScore >= 80, but neither of the specific conditions above were met
        // (e.g. bestPair1 or bestPair2 was null, or some other edge case).
        // Default to "accepted" status; tags will be handled by the generic fallback.
        determinedMatchStatus = "accepted";
      }

      // Fallback for cases where status is determined (e.g., "accepted") but no specific tags were generated
      if (finalMatchedOnTagsOutput.length === 0 && finalScore >= 80) {
        logger.warn(`Match ${matchId} (score: ${finalScore}, status: ${determinedMatchStatus}) couldn't form specific matchedOnTags. Defaulting.`);
        finalMatchedOnTagsOutput.push("Strong interest/expertise alignment");
      }
      // ---- END OF MODIFIED SECTION FOR MATCH STATUS AND TAGS ----

      const matchDocSnapshot = await matchDocRef.get();
      let chatIdToPersist: string | null = null;
      let needsChatCreation = false;
      let newChatCreationFailed = false; // Flag to track chat creation failure

      if (!matchDocSnapshot.exists) {
        logger.log(`Match ${matchId} is new.`);
        needsChatCreation = true;
      } else {
        chatIdToPersist = matchDocSnapshot.data()?.chatId || null;
        if (!chatIdToPersist) {
          logger.log(`Match ${matchId} exists but is missing a chatId.`);
          needsChatCreation = true;
        } else {
          logger.log(`Match ${matchId} exists with chatId ${chatIdToPersist}. Preserving it.`);
        }
      }

      if (needsChatCreation) {
        const newChatRef = chatsCollection.doc(); // Generate new chat ID
        const generatedChatId = newChatRef.id;

        if (generatedChatId) {
          chatIdToPersist = generatedChatId;
          logger.log(`Successfully generated new chat ID ${chatIdToPersist} for match ${matchId}.`);

          batch.set(newChatRef, {
            users: [userA, userB],
            createdAt: FieldValue.serverTimestamp(),
            lastMessage: null,
            lastTimestamp: null,
          });

          const systemMessageRef = newChatRef.collection("messages").doc();
          batch.set(systemMessageRef, {
            sender: "system",
            text: "You've been matched based on shared interests!",
            timestamp: FieldValue.serverTimestamp(),
          });
          logger.log(`Scheduled creation of new chat ${chatIdToPersist} for match ${matchId}.`);
        } else {
          logger.error(`CRITICAL: Failed to generate new chat ID for match ${matchId}. Firestore's doc().id returned null/undefined.`);
          newChatCreationFailed = true;
          // chatIdToPersist remains as it was (null if new match, or null from existing doc)
        }
      }

      if (newChatCreationFailed) {
        logger.error(`Skipping upsert of match ${matchId} because new chat ID generation failed.`);
      } else {
        // Retrieve original casing for display in matchedOn
        // This requires mapping back from the lowercased tags used in matching to original tags.
        // For simplicity, we will keep using the matched (lowercased) tags in finalMatchedOnTags.
        // If preserving original casing is critical, this part needs more sophisticated handling.
        // For now, the matchedOn tags will be lowercased if they came from Fuse results.

        const matchData = {
          userA: userA,
          userB: userB,
          score: finalScore,
          matchedOn: finalMatchedOnTagsOutput.slice(0, 5), // MODIFIED to use new tags array
          chatId: chatIdToPersist,
          status: determinedMatchStatus, // MODIFIED to use determined status
          timestamp: FieldValue.serverTimestamp(),
        };

        logger.info("Upserting match object", { matchDetails: { id: matchId, score: finalScore, status: determinedMatchStatus, chatIdValue: chatIdToPersist } }); // MODIFIED to log new status
        batch.set(matchDocRef, matchData, { merge: true });
      }
    }
  }

  try {
    await batch.commit();
    logger.log("Match generation batch committed successfully.");
  } catch (error) {
    logger.error("Error committing match generation batch:", error);
  }
});

// Define an interface for the expected data structure if getUserChats were to use request.data
// interface GetUserChatsData {
//   // Define fields if you expect any specific data from the client
//   someProperty?: string;
// }

interface ChatDocumentData {
  users: string[];
  createdAt: admin.firestore.Timestamp;
  lastMessage: string | null;
  lastTimestamp: admin.firestore.Timestamp | null;
  // Add any other fields that are expected in chat documents
}

interface ChatWithStatus extends ChatDocumentData {
  id: string;
  matchStatus: string;
}

interface GroupedChats {
  symbi: ChatWithStatus[];
  accepted: ChatWithStatus[];
}

export const getUserChats = onCall(async (request: CallableRequest<unknown>) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const uid = request.auth.uid;

  try {
    // First, fetch all matches involving the user to get their status
    const matchesAsUserAPromise = admin.firestore().collection("matches").where("userA", "==", uid).get();
    const matchesAsUserBPromise = admin.firestore().collection("matches").where("userB", "==", uid).get();

    const [matchesAsUserASnapshot, matchesAsUserBSnapshot] = await Promise.all([
      matchesAsUserAPromise,
      matchesAsUserBPromise,
    ]);

    const matchStatusMap = new Map<string, string>(); // <chatId, status>
    matchesAsUserASnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.chatId) {
        matchStatusMap.set(data.chatId, data.status || "accepted");
      }
    });
    matchesAsUserBSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.chatId && !matchStatusMap.has(data.chatId)) { // Avoid overwriting if userA query already got it
        matchStatusMap.set(data.chatId, data.status || "accepted");
      }
    });

    // Then, fetch all chats where the user is a participant
    const chatsSnapshot = await admin
      .firestore()
      .collection("chats")
      .where("users", "array-contains", uid)
      .get();

    const chats: ChatWithStatus[] = chatsSnapshot.docs.map((doc) => ({
      id: doc.id,
      matchStatus: matchStatusMap.get(doc.id) || "accepted", // Add match status to chat object
      ...(doc.data() as ChatDocumentData), // Explicitly cast to ChatDocumentData
    }));

    // Group chats by status
    const groupedChats: GroupedChats = {
      symbi: [],
      accepted: [],
    };

    // Sort each chat by lastTimestamp before grouping
    chats.sort((a, b) => {
      const lastTimestampA = (a.lastTimestamp as admin.firestore.Timestamp)?.toMillis() || 0;
      const lastTimestampB = (b.lastTimestamp as admin.firestore.Timestamp)?.toMillis() || 0;
      return lastTimestampB - lastTimestampA; // Descending order
    });

    // Group chats into their respective arrays
    chats.forEach((chat) => {
      if (chat.matchStatus === "symbi") {
        groupedChats.symbi.push(chat);
      } else {
        groupedChats.accepted.push(chat);
      }
    });

    return { chats: groupedChats };
  } catch (error) {
    logger.error("Error fetching user chats:", error);
    throw new HttpsError(
      "internal",
      "Unable to fetch chats.",
    );
  }
});

export const checkUnrespondedMessages = onSchedule({
  schedule: "40 17 * * *", // Changed from "30 15 * * *"
  timeZone: "America/Los_Angeles",
  // secrets: ["EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM", "APP_URL"], // Temporarily removed for deployment
}, async () => {
  const db = admin.firestore();
  const usersSnapshot = await db.collection("users").get();

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();

    if (!userData.email) continue;

    // Get all chats where user is a participant
    const chatsSnapshot = await db.collection("chats")
      .where("users", "array-contains", userId)
      .get();

    const unrespondedChats = [];

    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const lastMessage = await db.collection("chats")
        .doc(chatDoc.id)
        .collection("messages")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      if (lastMessage.empty) continue;

      const lastMessageData = lastMessage.docs[0].data();
      const lastMessageTime = lastMessageData.timestamp.toDate();

      // If last message is from other user
      if (lastMessageData.sender !== userId) {
        const otherUserId = chatData.users.find((id: string) => id !== userId);
        const otherUserDoc = await db.collection("users").doc(otherUserId).get();
        const otherUserName = otherUserDoc.data()?.displayName || "Someone";

        unrespondedChats.push({
          chatId: chatDoc.id,
          otherUserName,
          lastMessage: lastMessageData.text,
          lastMessageTime,
        });
      }
    }

    if (unrespondedChats.length > 0) {
      try {
        await sendUnrespondedMessagesEmail(userData.email, unrespondedChats);
        logger.info(`Sent unresponded messages email to ${userData.email}`);
      } catch (error) {
        logger.error(`Failed to send email to ${userData.email}:`, error);
      }
    }
  }
});

