/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
// import * as functionsV1 from "firebase-functions";
import Fuse from "fuse.js";

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

  const changedUserCombinedTags = [
    ...(changedUserData.interests || []),
    ...(changedUserData.expertise || []),
  ];

  // Fuse.js setup for interests vs expertise and vice-versa
  const fuseOptions = {
    includeScore: true,
    threshold: 0.0, // We want all results to calculate score, then filter by score >= 80
    minMatchCharLength: 1,
  };

  const batch = admin.firestore().batch();
  const matchesCollection = admin.firestore().collection("matches");
  const chatsCollection = admin.firestore().collection("chats");

  for (const candidate of potentialMatches) {
    if (!candidate.profile || (!candidate.profile.interests?.length && !candidate.profile.expertise?.length)) {
      continue; // Skip candidates with no tags
    }

    const candidateCombinedTags = [
      ...(candidate.profile.interests || []),
      ...(candidate.profile.expertise || []),
    ];

    let score1 = 0;
    if (changedUserData.interests?.length && candidate.profile.expertise?.length) {
      const fuse1 = new Fuse(candidate.profile.expertise, fuseOptions);
      // Fuse search can return an empty array if no matches
      const results1 = changedUserData.interests.flatMap((interest) => fuse1.search(interest));
      if (results1.length > 0) {
        const bestResult1 = results1.reduce((minScoreItem, r) => (r.score ?? 1) < (minScoreItem.score ?? 1) ? r : minScoreItem, { score: 1, item: "", refIndex: -1 });
        score1 = (1 - (bestResult1.score ?? 1)) * 100;
      }
    }

    let score2 = 0;
    if (changedUserData.expertise?.length && candidate.profile.interests?.length) {
      const fuse2 = new Fuse(candidate.profile.interests, fuseOptions);
      const results2 = changedUserData.expertise.flatMap((expertiseItem) => fuse2.search(expertiseItem));
      if (results2.length > 0) {
        const bestResult2 = results2.reduce((minScoreItem, r) => (r.score ?? 1) < (minScoreItem.score ?? 1) ? r : minScoreItem, { score: 1, item: "", refIndex: -1 });
        score2 = (1 - (bestResult2.score ?? 1)) * 100;
      }
    }

    const finalScore = Math.max(score1, score2);

    if (finalScore >= 80) {
      const userA = changedUserId < candidate.id ? changedUserId : candidate.id;
      const userB = changedUserId < candidate.id ? candidate.id : changedUserId;
      const matchId = `${userA}_${userB}`;

      const matchDocRef = matchesCollection.doc(matchId);

      let matchedOnTags: string[] = [];

      // Refined logic for matchedOn tags based on which score was higher and contributed to the match
      if (finalScore === score1 && score1 >= 80 && changedUserData.interests?.length && candidate.profile.expertise?.length) {
        const fuse = new Fuse(candidate.profile.expertise, { ...fuseOptions, threshold: 0.2 });
        changedUserData.interests.forEach((interest) => {
          const results = fuse.search(interest);
          if (results.length > 0 && (results[0].score ?? 1) <= 0.2) {
            matchedOnTags.push(`${interest} (yours) <> ${results[0].item} (theirs)`);
          }
        });
      } else if (finalScore === score2 && score2 >= 80 && changedUserData.expertise?.length && candidate.profile.interests?.length) {
        const fuse = new Fuse(candidate.profile.interests, { ...fuseOptions, threshold: 0.2 });
        changedUserData.expertise.forEach((expertiseItem) => {
          const results = fuse.search(expertiseItem);
          if (results.length > 0 && (results[0].score ?? 1) <= 0.2) {
            matchedOnTags.push(`${expertiseItem} (yours) <> ${results[0].item} (theirs)`);
          }
        });
      }

      if (matchedOnTags.length === 0) {
        const commonTags = changedUserCombinedTags.filter((tag) => candidateCombinedTags.includes(tag));
        if (commonTags.length > 0) {
          matchedOnTags = commonTags;
        } else {
          matchedOnTags = ["Shared interests/expertise"];
        }
      }

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
        const matchData = {
          userA: userA,
          userB: userB,
          score: finalScore,
          matchedOn: matchedOnTags.slice(0, 5),
          chatId: chatIdToPersist, // Will be existing, newly generated, or null if existing was null and no new one needed/created.
          status: "accepted",
          timestamp: FieldValue.serverTimestamp(),
        };

        logger.info("Upserting match object", { matchDetails: { id: matchId, score: finalScore, chatIdValue: chatIdToPersist } });
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

export const getUserChats = onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const uid = request.auth.uid;
  // const data = request.data; // data is not used in this function yet

  try {
    const chatsSnapshot = await admin
      .firestore()
      .collection("chats")
      .where("users", "array-contains", uid)
      .orderBy("lastTimestamp", "desc")
      .get();

    const chats = chatsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { chats };
  } catch (error) {
    logger.error("Error fetching user chats:", error);
    throw new HttpsError(
      "internal",
      "Unable to fetch chats.",
    );
  }
});
