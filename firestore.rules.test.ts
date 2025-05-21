import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { alice, bob, getFirestoreAsUser, getTestEnv } from "./jest.setup"; // Assuming jest.setup.ts is in the same directory
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: "awesel-common-ground" });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Create Bob's profile before each test for read/update tests
  const bobDb = getFirestoreAsUser(bob);
  await setDoc(doc(bobDb, `users/${bob.uid}`), { bio: "Bob's initial bio", email: bob.email });

  // Create Alice's profile before each test for her own update tests
  const aliceDb = getFirestoreAsUser(alice);
  await setDoc(doc(aliceDb, `users/${alice.uid}`), { bio: "Alice's initial bio", email: alice.email });
});

describe("Firestore Security Rules for /users", () => {
  test("alice reads bob's profile -> allow", async () => {
    const aliceDb = getFirestoreAsUser(alice);
    const bobProfileRef = doc(aliceDb, `users/${bob.uid}`);
    await assertSucceeds(getDoc(bobProfileRef));
  });

  test("alice updates bob.bio -> deny", async () => {
    const aliceDb = getFirestoreAsUser(alice);
    const bobProfileRef = doc(aliceDb, `users/${bob.uid}`);
    await assertFails(updateDoc(bobProfileRef, { bio: "Alice trying to update Bob's bio" }));
  });

  test("alice updates alice.bio -> allow", async () => {
    const aliceDb = getFirestoreAsUser(alice);
    const aliceProfileRef = doc(aliceDb, `users/${alice.uid}`);
    await assertSucceeds(updateDoc(aliceProfileRef, { bio: "Alice updating her own bio" }));
  });
});

describe("Chat Security Rules", () => {
  it("should allow a user in the chat to read the chat", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
    });
    await assertSucceeds(getDoc(doc(alice.firestore(), "chats/chat123")));
  });

  it("should deny a user not in the chat from reading the chat", async () => {
    const eve = testEnv.authenticatedContext("eve");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
    });
    await assertFails(getDoc(doc(eve.firestore(), "chats/chat123")));
  });

  it("should allow a user in the chat to write to the chat", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
    });
    await assertSucceeds(updateDoc(doc(alice.firestore(), "chats/chat123"), { name: "New Chat Name" }));
  });

  it("should deny a user not in the chat from writing to the chat", async () => {
    const eve = testEnv.authenticatedContext("eve");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
    });
    await assertFails(updateDoc(doc(eve.firestore(), "chats/chat123"), { name: "New Chat Name" }));
  });

  it("should allow a user in the chat to read messages", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
      await setDoc(doc(context.firestore(), "chats/chat123/messages/message123"), { text: "Hello", sender: "alice", users: ["alice", "bob"] });
    });
    await assertSucceeds(getDoc(doc(alice.firestore(), "chats/chat123/messages/message123")));
  });

  it("should deny a user not in the chat from reading messages", async () => {
    const eve = testEnv.authenticatedContext("eve");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
      await setDoc(doc(context.firestore(), "chats/chat123/messages/message123"), { text: "Hello", sender: "alice", users: ["alice", "bob"]});
    });
    await assertFails(getDoc(doc(eve.firestore(), "chats/chat123/messages/message123")));
  });

  it("should allow a user in the chat to write messages", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
    });
    await assertSucceeds(setDoc(doc(alice.firestore(), "chats/chat123/messages/message456"), { text: "Hi there", sender: "alice", timestamp: serverTimestamp(), users: ["alice", "bob"] }));
  });

  it("should deny a user not in the chat from writing messages", async () => {
    const eve = testEnv.authenticatedContext("eve");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chats/chat123"), { users: ["alice", "bob"] });
    });
    await assertFails(setDoc(doc(eve.firestore(), "chats/chat123/messages/message456"), { text: "Hi there", sender: "eve", timestamp: serverTimestamp(), users: ["alice", "bob"] }));
  });
}); 