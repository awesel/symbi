const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
// Ensure your FIRESTORE_EMULATOR_HOST environment variable is set
// e.g., FIRESTORE_EMULATOR_HOST="localhost:8080" or FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"

let db;
try {
  admin.initializeApp({
    projectId: "awesel-common-ground", // Align with emulator UI
  });
  db = admin.firestore();
  console.log(
    "Firebase Admin SDK initialized for Firestore emulator with project ID: awesel-common-ground."
  );
} catch (error) {
  if (error.code === "app/duplicate-app") {
    console.log("Firebase Admin SDK already initialized. Using existing app.");
    db = admin.firestore();
  } else {
    console.error("Firebase Admin SDK initialization error:", error);
    process.exit(1);
  }
}

const users = [
  {
    uid: "alice_uid",
    email: "alice@stanford.edu",
    displayName: "Alice Wonderland",
    bio: "Curiouser and curiouser.",
    interests: ["Machine Learning", "Quantum Computing", "Sci-Fi Novels"],
    expertise: ["Python Programming", "Data Analysis", "Academic Writing"],
    createdAt: admin.firestore.Timestamp.now(),
    lastActive: admin.firestore.Timestamp.now(),
  },
  {
    uid: "bob_uid",
    email: "bob@stanford.edu",
    displayName: "Bob The Builder",
    bio: "Can we fix it? Yes, we can!",
    interests: ["Data Analysis", "Photography", "Sustainable Living"],
    expertise: [
      "Machine Learning",
      "JavaScript Development",
      "Project Management",
    ],
    createdAt: admin.firestore.Timestamp.now(),
    lastActive: admin.firestore.Timestamp.now(),
  },
  {
    uid: "charlie_uid",
    email: "charlie@stanford.edu",
    displayName: "Charlie Brown",
    bio: "Good grief!",
    interests: ["JavaScript Development", "Graphic Design", "Ancient History"],
    expertise: [
      "Photography",
      "User Interface Design",
      "Quantum Computing Research",
    ],
    createdAt: admin.firestore.Timestamp.now(),
    lastActive: admin.firestore.Timestamp.now(),
  },
];

async function seedUsers() {
  if (!db) {
    console.error("Firestore database instance is not available.");
    return;
  }
  const usersCollection = db.collection("users");
  const batch = db.batch();

  console.log("Starting to seed users...");

  for (const user of users) {
    const userRef = usersCollection.doc(user.uid);
    batch.set(userRef, user);
    console.log(
      `Preparing to seed user: ${user.displayName} (UID: ${user.uid})`
    );
  }

  try {
    await batch.commit();
    console.log(`Successfully seeded ${users.length} users.`);
  } catch (error) {
    console.error("Error seeding users:", error);
  }
}

seedUsers()
  .then(() => {
    console.log("Seeding script finished.");
    // admin.app().delete(); // Optional: clean up the app if script is run standalone repeatedly
  })
  .catch((error) => {
    console.error("Unhandled error in seeding script:", error);
  });
