import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Image from 'next/image';
import styles from '../styles/Home.module.css';

const LoginPage: React.FC = () => {
  const { user, userProfile, loading: authLoading, signInWithGoogle } = useAuth();
  const router = useRouter();

  // State to manage checklist item checked status
  const [checklistItems, setChecklistItems] = useState([
    { text: '3D printing custom designs', checked: true },
    { text: 'Freestyle wrapping', checked: true },
    { text: 'Website design', checked: false },
    { text: 'Shooting film photography', checked: false },
    { text: 'F1 driving', checked: false },
    { text: 'Ocean robotics', checked: false },
    { text: 'Cooking steaks', checked: false },
  ]);

  // Function to handle checklist item click
  const handleChecklistItemClick = (index: number) => {
    setChecklistItems(prevItems =>
      prevItems.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Redirect logged in and onboarded users to dashboard
  useEffect(() => {
    if (!authLoading && user && userProfile?.onboardingCompleted) {
      router.push('/dashboard');
    }
  }, [authLoading, user, userProfile, router]);

  if (authLoading) {
    return <p>Loading...</p>;
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Symbi - Connect and Learn</title>
        <meta name="description" content="Connect with Stanford peers for mutual learning and growth." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.mainContent}>
        <section className={styles.heroSection}>
          <Image src="/images/newsymbilogo.png" alt="New Symbi Logo" width={40} height={40} className={styles.heroLogoIcon} />
          
          <h1 className={styles.heroTitle}>Symbi</h1>
          <p className={styles.heroSubtitle}>
            Made to meet curious people.
            <br className="hidden sm:inline"/> Learn from others and share your passions.
          </p>

          <div className={styles.heroCTAForm}>
            <button 
              onClick={signInWithGoogle}
              className={styles.heroCTAButton}
              disabled={authLoading}
            >
              Sign in with Stanford Email
            </button>
          </div>

          <div className={styles.heroSignUpContainer}>
             <p className={styles.heroSignUpText}>Don&apos;t have an account?</p>
             <button 
               onClick={signInWithGoogle}
               className={styles.heroSignUpLink}
             >
               Sign Up
             </button>
          </div>

          <div className={styles.trustBadgeContainer}>
             <div className={styles.avatarPlaceholder}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://i.pravatar.cc/150?img=3" alt="User Avatar" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://i.pravatar.cc/150?img=8" alt="User Avatar" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://i.pravatar.cc/150?img=1" alt="User Avatar" />
             </div>
            <p className={styles.trustBadge}>
              Join 250+ people already onboard
            </p>
          </div>
        </section>

        <div className={styles.horizontalSectionsContainer}>
          <section className={styles.culturalForesightSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Add Your Interests 🎯</h2>
              <p className={styles.sectionContent}>
                Choose what you're curious to explore and share what you're expertise.
              </p>
            </div>
            
            <div className={styles.innerChecklistSection}>
              <div className={styles.interestsChecklist}>
                 {checklistItems.map((item, index) => (
                   <div
                     key={index}
                     className={`${styles.checklistItem} ${item.checked ? styles.checked : ''}`}
                     onClick={() => handleChecklistItemClick(index)}
                   >
                     {item.text}
                   </div>
                 ))}
              </div>
            </div>
          </section>

          <section className={styles.experienceInnovationSection}>
             <div className={styles.sectionContentContainer}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Get Matched 🔁</h2>
                  <p className={styles.sectionContent}>
                    Find classmates who share your interests—or want to learn from you.
                  </p>
                </div>
                <Image
                  src="/images/people image.png"
                  alt="People being matched"
                  width={350}
                  height={200}
                  className={styles.sectionImage}
                />
             </div>
          </section>

          <section className={styles.narrativeSystemsSection}>
            <div className={styles.sectionContentContainer}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Talk to Peers 💬</h2>
                  <p className={styles.sectionContent}>
                    Emmuage your matches. Everyone&apos;s here to share, ask, and learn.
                  </p>
                </div>
               <Image
                 src="/images/conversation.png"
                 alt="People conversing on phone"
                 width={350}
                 height={300}
                 className={styles.sectionImage}
               />
            </div>
          </section>

          <section className={styles.conceptIncubationSection}>
             <div className={styles.sectionContentContainer}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Meet Up IRL 📍</h2>
                  <p className={styles.sectionContent}>
                    When your chat wraps up, we&apos;ll suggest a time to meet in person.
                  </p>
                </div>
               <Image
                 src="/images/meetup.png"
                 alt="People meeting up in person"
                 width={350}
                 height={180}
                 className={styles.sectionImage}
               />
             </div>
          </section>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Symbi. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LoginPage; 