import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
// import { useRouter } from 'next/router'; // This was already correctly commented out or removed
import Image from 'next/image';
import styles from '../styles/Home.module.css'; // Import the CSS module

const HomePage: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  // const router = useRouter(); // This was already correctly commented out or removed

  // useEffect(() => { ... }); // This was already correctly removed

  if (authLoading) { // Simplified loading state
    return <p>Loading...</p>;
  }

  let buttonHref = "/login";
  let buttonText = "Sign In";
  let buttonClassName = styles.signInButton; // Use CSS module class

  if (user) {
    if (userProfile?.onboardingCompleted) {
      buttonHref = "/dashboard";
      buttonText = "Go to My Dashboard";
      buttonClassName = styles.dashboardButton; // Use CSS module class
    } else {
      // User exists but onboarding not completed (or userProfile still loading)
      buttonHref = "/onboarding";
      buttonText = "Complete Onboarding";
      buttonClassName = styles.onboardingButton; // Use CSS module class
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Symbi - Connect and Learn</title>
        <meta name="description" content="Connect with Stanford peers for mutual learning and growth." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <Image src="/images/symbi_logo.png" alt="Symbi Logo" width={100} height={40} className={styles.logo} />
        <Link href={buttonHref} legacyBehavior>
          {/* Apply base navButton style and dynamic button color style */}
          <a className={`${styles.navButton} ${buttonClassName}`}>
            {buttonText}
          </a>
        </Link>
      </header>

      <main className={styles.mainContent}>
        <section className={styles.section}>
          <h1>Your classmates are world-class experts. Learn from them on Symbi.</h1>
          <p>
          We connects Stanford students based on their interests, so you can talk to experts in your curiosity face-to-face. Skip the Google search or AI chatbot—have a real conversation with someone right around the corner.

          </p>
        </section>

        <section className={styles.section}>
          <h1>How it Works</h1>
          <ol className={styles.howItWorksList}>
            <li>
              Sign in with your Stanford email.
            </li>
            <li>
              Enter what you are curious about, and what you know a lot about.
            </li>
            <li>
              You will get matches based on who you can learn from and who can learn from you. Some will be Symbi matches, meaning you both want to learn from each other.
            </li>
            <li>
              Chat with them on this website, or grab lunch! You are within a mile of each other :) Remember your name is associated with what you say—be kind.</li>
          </ol>
        </section>

        {/* The Rules section below will be removed 
        <section className={styles.section}>
          <h1>Rules</h1>
          <ol className={styles.rulesList}>
            <li>
              We require Stanford emails. It is our simple heuristic for verifying identity and proximity. If you&apos;re nearby and want to join our community, just ask!
            </li>
            <li>
              Mutualism. This platform works best when you&apos;re both a teacher and a learner.
            </li>
            <li>
              IRL first. Since we're all in the same place, why not meet in person? Grab lunch with your matches!
            </li>
          </ol>
        </section>
        */}
      </main>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Symbi. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage; 