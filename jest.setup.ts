import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";

jest.setTimeout(10000);

let testEnv: RulesTestEnvironment;

export const getTestEnv = () => {
  if (!testEnv) {
    throw new Error("Test environment not initialized. Ensure beforeAll has run.");
  }
  return testEnv;
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-project-1234", // Replace with your project ID
    firestore: {
      rules: readFileSync(resolve(__dirname, "firestore.rules"), "utf8"),
      host: "localhost",
      port: 8080, // Make sure this matches your firestore.json emulator port
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Helper function to get a Firestore instance for a specific user
export const getFirestoreAsUser = (auth?: { uid: string; email?: string }) => {
  if (!testEnv) {
    throw new Error("Test environment not initialized. Ensure beforeAll has run.");
  }
  if (auth) {
    return testEnv.authenticatedContext(auth.uid, { email: auth.email }).firestore();
  }
  return testEnv.unauthenticatedContext().firestore();
};

// Pre-defined contexts for Alice and Bob
export const alice = { uid: "alice", email: "alice@example.com" };
export const bob = { uid: "bob", email: "bob@example.com" };
