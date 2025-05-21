import Head from 'next/head';
import Link from 'next/link';
import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto, arial, sans-serif', padding: '20px', textAlign: 'center' }}>
      <Head>
        <title>Symbi - Connect and Learn</title>
        <meta name="description" content="Connect with Stanford peers for mutual learning and growth." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px' }}>
        <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>Symbi</div>
        <Link href="/login" legacyBehavior>
          <a style={{ textDecoration: 'none', color: 'white', backgroundColor: '#0070f3', padding: '10px 20px', borderRadius: '5px', fontSize: '1em' }}>
            Sign In
          </a>
        </Link>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto' }}>
        <section style={{ marginBottom: '40px' }}>
          <h1>Vision</h1>
          <p style={{ lineHeight: '1.6', fontSize: '1.1em' }}>
            If you have a question, you might turn to Google and find articles written by your peers—or ask ChatGPT, an algorithm built by your classmates. But why not talk to the people around you? There&apos;s someone within a mile who&apos;s an expert in your curiosity. Meet them on Symbi.
          </p>
        </section>

        <section>
          <h1>Rules</h1>
          <ol style={{ lineHeight: '1.6', fontSize: '1.1em', paddingLeft: '20px', display: 'inline-block', textAlign: 'left' }}>
            <li style={{ marginBottom: '10px' }}>
              We require Stanford emails. It is our simple heuristic for verifying identity and proximity. If you&apos;re nearby and want to join our community, just ask!
            </li>
            <li style={{ marginBottom: '10px' }}>
              Mutualism. This platform works best when you&apos;re both a teacher and a learner.
            </li>
            <li>
              In-person first. We can&apos;t force anyone to grab a meal—but what makes Symbi better than emailing an expert is the chance to sit down face-to-face.
            </li>
          </ol>
        </section>
      </main>

      <footer style={{ marginTop: '50px', textAlign: 'center', color: '#777' }}>
        <p>&copy; {new Date().getFullYear()} Symbi. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage; 