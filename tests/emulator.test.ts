import {
  initializeTestEnvironment,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

let env: any;

beforeAll(async () => {
  env = await initializeTestEnvironment({
  projectId: 'demo-project',
  firestore: {
    host: 'localhost',
    port: 8080,
    rules: readFileSync('firestore.rules', 'utf8'),
  },
});
});

afterAll(async () => {
  if (env) await env.cleanup();
});

test('write to /users/test_user should succeed if authed as test_user', async () => {
  const context = env.authenticatedContext('test_user');
  const db = context.firestore();

  await assertSucceeds(
    setDoc(doc(db, 'users/test_user'), {
      email: 'test@stanford.edu',
      interests: ['ai'],
      expertise: ['poetry'],
      createdAt: new Date(),
      lastActive: new Date(),
    }),
  );
});