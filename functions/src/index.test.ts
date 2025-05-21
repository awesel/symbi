import * as admin from "firebase-admin";
import fft from "firebase-functions-test";
import { incrementTagCount } from "./index"; // Adjust path if your structure is different
// import { FeaturesList } from 'firebase-functions-test/lib/features';
// import {Change, firestore} from 'firebase-functions/v2';
// import {DocumentSnapshot} from 'firebase-admin/firestore';
// import { Timestamp } from "firebase-admin/firestore";

// IMPORTANT: Set this *before* admin.initializeApp() is called implicitly by importing index.ts
// if your index.ts initializes admin. This ensures admin SDK in tests uses the emulator.
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080"; // Default Firestore emulator host and port

// Initialize firebase-functions-test. Since you have the emulator running,
// we don't need to mock configuration, but we do need to point to the right project
// if it's not the default. For local emulator, this is usually fine.
const testEnv = fft(); // Offline mode is default, but for Firestore triggers, online is better with emulators

// Helper to create a minimal DocumentSnapshot mock that fft can serialize
// const makeMinimalSnapshot = (data: any, refPath: string): firestore.DocumentSnapshot => {
//   const id = refPath.split('/').pop() || '';
//   if (data === null || typeof data === 'undefined') {
//     return {
//       exists: false,
//       id: id,
//       ref: admin.firestore().doc(refPath),
//       data: () => undefined,
//       get: (fieldPath: string) => undefined, // basic mock for get
//       createTime: admin.firestore.Timestamp.now(), // Mock if needed
//       updateTime: admin.firestore.Timestamp.now(), // Mock if needed
//       readTime: admin.firestore.Timestamp.now(),   // Mock if needed
//     } as unknown as firestore.DocumentSnapshot;
//   }
//   return {
//     exists: true,
//     id: id,
//     ref: admin.firestore().doc(refPath),
//     data: () => data,
//     get: (fieldPath: string) => data[fieldPath], // basic mock for get
//     createTime: admin.firestore.Timestamp.now(),
//     updateTime: admin.firestore.Timestamp.now(),
//     readTime: admin.firestore.Timestamp.now(),
//   } as unknown as firestore.DocumentSnapshot;
// };

// Helper to make a Change object for onDocumentWritten triggers
// const makeChange = (beforeData: any, afterData: any, refPath: string): Change<firestore.DocumentSnapshot> => {
//   return {
//     before: makeMinimalSnapshot(beforeData, refPath),
//     after: makeMinimalSnapshot(afterData, refPath),
//   };
// };

// Helper to make the data structure that firebase-functions-test uses to create
// the Change<DocumentSnapshot> for the wrapped function.
// It expects plain data for `before` and `after`.
const makeChangeData = (beforeData: any, afterData: any): { before: any, after: any } => {
  return {
    before: beforeData,
    after: afterData,
  };
};

describe("incrementTagCount Cloud Function", () => {
  const db = admin.firestore();
  const wrappedIncrementTagCount = testEnv.wrap(incrementTagCount) as any;

  // Clean up Firestore emulator before and after tests
  beforeEach(async () => {
    await testEnv.firestore.clearFirestoreData({ projectId: process.env.GCLOUD_PROJECT || "demo-project" }); // Use your project ID
  });

  afterAll(async () => {
    testEnv.cleanup();
    // Explicitly terminate Firestore to help with cleanup
    if (db && typeof db.terminate === "function") {
      await db.terminate();
    }
    // Delete the Firebase admin app to allow Jest to exit cleanly
    await admin.app().delete();
  });

  const getTagDoc = async (slug: string) => {
    const doc = await db.collection("tags_used").doc(slug).get();
    return doc.data();
  };

  test("should increment count for new interest and expertise tags", async () => {
    const userId = "user123";
    const beforeData = null; // New user
    const afterData = {
      interests: ["AI Ethics", "Quantum Computing"],
      expertise: ["AI Ethics", "Web Development"],
    };
    // The event object passed to the wrapped function needs `data` (with before/after plain objects)
    // and `params` for any wildcards in the document path.
    const eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    const aiEthicsTag = await getTagDoc("ai-ethics");
    expect(aiEthicsTag).toBeDefined();
    expect(aiEthicsTag?.count).toBe(1);
    expect(aiEthicsTag?.tag).toBe("ai-ethics");
    expect(aiEthicsTag?.type).toEqual(expect.arrayContaining(["interest", "expertise"]));
    expect(aiEthicsTag?.type.length).toBe(2);

    const quantumTag = await getTagDoc("quantum-computing");
    expect(quantumTag).toBeDefined();
    expect(quantumTag?.count).toBe(1);
    expect(quantumTag?.tag).toBe("quantum-computing");
    expect(quantumTag?.type).toEqual(["interest"]);

    const webDevTag = await getTagDoc("web-development");
    expect(webDevTag).toBeDefined();
    expect(webDevTag?.count).toBe(1);
    expect(webDevTag?.tag).toBe("web-development");
    expect(webDevTag?.type).toEqual(["expertise"]);
  });

  test("should update counts when tags are added and removed", async () => {
    const userId = "user456";
    // Initial state: user has 'ai-ethics' as interest
    await db.collection("users").doc(userId).set({ interests: ["AI Ethics"], expertise: [] });
    await db.collection("tags_used").doc("ai-ethics").set({ tag: "ai-ethics", count: 1, type: ["interest"] });
    await db.collection("tags_used").doc("climate-tech").set({ tag: "climate-tech", count: 1, type: ["expertise"] }); // Another existing tag

    const beforeData = { interests: ["AI Ethics"], expertise: [] };
    const afterData = {
      interests: ["Climate Tech"], // Removed 'AI Ethics', Added 'Climate Tech'
      expertise: ["Data Science"], // Added 'Data Science'
    };
    const eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    const aiEthicsTag = await getTagDoc("ai-ethics");
    expect(aiEthicsTag?.count).toBe(0); // Decremented
    // Type array is not modified on removal in current implementation
    expect(aiEthicsTag?.type).toEqual(expect.arrayContaining(["interest"]));

    const climateTechTag = await getTagDoc("climate-tech");
    expect(climateTechTag?.count).toBe(2); // Incremented existing tag
    expect(climateTechTag?.type).toEqual(expect.arrayContaining(["expertise", "interest"]));
    expect(climateTechTag?.type.length).toBe(2);

    const dataScienceTag = await getTagDoc("data-science");
    expect(dataScienceTag?.count).toBe(1); // New tag
    expect(dataScienceTag?.type).toEqual(["expertise"]);
  });

  test("should clamp tag count at 0 when removed", async () => {
    const userId = "user789";
    // Initial state: user has 'testing-library' as interest, count is 1
    await db.collection("users").doc(userId).set({ interests: ["Testing Library"], expertise: [] });
    await db.collection("tags_used").doc("testing-library").set({ tag: "testing-library", count: 1, type: ["interest"] });

    const beforeData = { interests: ["Testing Library"], expertise: [] };
    const afterData = { interests: [], expertise: [] }; // Removed 'Testing Library'
    const eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    const testingTag = await getTagDoc("testing-library");
    expect(testingTag?.count).toBe(0);

    // Try to decrement again (simulating another user removing or a bug)
    // This requires the tag to exist with count 0 for the function logic to hit the clamp
    const anotherUserId = "userABC";
    await db.collection("users").doc(anotherUserId).set({ interests: ["Testing Library"], expertise: [] }); // User has it
    await db.collection("tags_used").doc("testing-library").update({ count: 1 }); // Reset count for simulation

    // Test the specific clamping logic inside the function if a tag is already at 0
    // This part of the test ensures if the function tries to decrement a 0-count tag, it stays 0.
    await db.collection("tags_used").doc("already-zero").set({ tag: "already-zero", count: 0, type: ["interest"] });
    const userWithZeroTag = "userZero";
    const beforeDataZero = { interests: ["Already Zero"], expertise: [] };
    const afterDataZero = { interests: [], expertise: [] }; // removing it
    const eventDataZero = makeChangeData(beforeDataZero, afterDataZero);
    await wrappedIncrementTagCount({ data: eventDataZero, params: { uid: userWithZeroTag } });

    const alreadyZeroTag = await getTagDoc("already-zero");
    expect(alreadyZeroTag?.count).toBe(0);
  });

  test("should handle user creation with no tags", async () => {
    const userId = "userNoTags";
    const beforeData = null;
    const afterData = { interests: [], expertise: [] };
    const eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    // No documents should be created in tags_used
    const snapshot = await db.collection("tags_used").get();
    expect(snapshot.empty).toBe(true);
  });

  test("should handle user deletion by decrementing tags", async () => {
    const userId = "userToDelete";
    // Initial state: user has 'to-delete-1' and 'to-delete-2'
    await db.collection("users").doc(userId).set({ interests: ["To Delete 1"], expertise: ["To Delete 2"] });
    await db.collection("tags_used").doc("to-delete-1").set({ tag: "to-delete-1", count: 1, type: ["interest"] });
    await db.collection("tags_used").doc("to-delete-2").set({ tag: "to-delete-2", count: 2, type: ["expertise"] }); // count > 1

    const beforeData = { interests: ["To Delete 1"], expertise: ["To Delete 2"] };
    const afterData = null; // User document deleted
    const eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    const tag1 = await getTagDoc("to-delete-1");
    expect(tag1?.count).toBe(0);

    const tag2 = await getTagDoc("to-delete-2");
    expect(tag2?.count).toBe(1);
  });

  test("type field should correctly accumulate interest and expertise", async () => {
    const userId = "userTypeTest";
    // 1. Add as interest
    let beforeData: any = null;
    let afterData: any = { interests: ["Type Test Tag"], expertise: [] };
    let eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    let tag = await getTagDoc("type-test-tag");
    expect(tag?.count).toBe(1);
    expect(tag?.type).toEqual(["interest"]);

    // 2. Update user: add the same tag as expertise (still an interest)
    beforeData = afterData;
    afterData = { interests: ["Type Test Tag"], expertise: ["Type Test Tag"] };
    eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: userId } });

    // Scenario: Tag exists from another user as 'interest'. This user adds it as 'expertise'.
    await db.collection("tags_used").doc("type-test-tag-2").set({ tag: "type-test-tag-2", count: 1, type: ["interest"] });
    const दूसरेUserId = "userTypeTestOther"; // using a different userId to avoid conflict
    beforeData = { interests: [], expertise: [] }; // This user has no tags
    afterData = { interests: [], expertise: ["Type Test Tag 2"] }; // Adds it as expertise
    eventData = makeChangeData(beforeData, afterData);
    await wrappedIncrementTagCount({ data: eventData, params: { uid: दूसरेUserId } });

    tag = await getTagDoc("type-test-tag-2");
    expect(tag?.count).toBe(2); // Incremented
    expect(tag?.type).toEqual(expect.arrayContaining(["interest", "expertise"]));
    expect(tag?.type.length).toBe(2);
  });
});

// Ensure you have @types/jest for Jest type definitions
// You might need to adjust the project ID in clearFirestoreData
// Run tests with: npm test (or yarn test) in the functions directory
// Ensure your Firebase emulator is running for Firestore: firebase emulators:start --only firestore
