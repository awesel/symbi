import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import DiscoverTile from '../components/DiscoverTile';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import Inbox from '../components/Inbox'; // Import Inbox component to display chats
import styles from '../styles/Dashboard.module.css';

// import SymbiMatchBanner from '../app/components/SymbiMatchBanner';

interface SkillData {
  skill: string;
  context?: string; // Make context optional if it's not always present or used
}

const DashboardPage: React.FC = () => {
  const { user, userProfile, loading, logOut } = useAuth();
  const router = useRouter();
  const [displayedSkills, setDisplayedSkills] = useState<SkillData[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [userInterests, setUserInterests] = useState<string[]>([]); // State to hold current user's interests
  const [isMobile, setIsMobile] = useState(false);

  // Effect to detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // Using 768px as a common breakpoint for mobile/tablet
    };
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch user profile and interests
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user && userProfile && !userProfile.onboardingCompleted) {
      router.push('/onboarding');
    }

    if (userProfile?.interests && Array.isArray(userProfile.interests)) {
      setUserInterests(userProfile.interests);
    } else {
      setUserInterests([]);
    }

  }, [user, userProfile, loading, router]);

  // Fetch and filter skills from other users
  useEffect(() => {
    const fetchAndSetSkills = async () => {
      // Only proceed if user and userProfile are loaded and userInterests state is initialized (not undefined)
      if (!user || !userProfile || userInterests === undefined) {
         setSkillsLoading(false);
         return;
      }

      setSkillsLoading(true);
      try {
        // Fetch tags from tags_used collection
        const tagsRef = collection(db, 'tags_used');
        const querySnapshot = await getDocs(tagsRef);

        const allTags: SkillData[] = [];
        querySnapshot.forEach(doc => {
          const tagData = doc.data();
          if (tagData.tag && tagData.count > 0) {
            allTags.push({
              skill: tagData.tag,
              context: tagData.type?.includes('expertise') ? 'expertise' : 'interest'
            });
          }
        });

        // Filter out skills the current user already has as interests
        const filteredSkills = allTags.filter(otherSkill =>
          !userInterests.some(userInterest => userInterest === otherSkill.skill)
        );

        // Remove duplicates by skill name
        const uniqueSkillsMap = new Map<string, SkillData>();
        filteredSkills.forEach(skill => {
          if (!uniqueSkillsMap.has(skill.skill)) {
            uniqueSkillsMap.set(skill.skill, skill);
          }
        });
        const uniqueSkills = Array.from(uniqueSkillsMap.values());

        // Sort by count (popularity) and select top 3
        const sortedSkills = uniqueSkills.sort((a, b) => {
          const countA = querySnapshot.docs.find(doc => doc.data().tag === a.skill)?.data().count || 0;
          const countB = querySnapshot.docs.find(doc => doc.data().tag === b.skill)?.data().count || 0;
          return countB - countA;
        });

        const selectedSkills = sortedSkills.slice(0, 3);
        setDisplayedSkills(selectedSkills);

      } catch (error) {
        console.error('Error fetching skills:', error);
        setDisplayedSkills([]);
      } finally {
        setSkillsLoading(false);
      }
    };

    // Fetch skills when user, userProfile, or userInterests change
    if (user && userProfile !== undefined && userInterests !== undefined) {
       fetchAndSetSkills();
    }
  }, [user, userProfile, userInterests]); // Re-run when user, userProfile, or userInterests change

  // Function to add a skill to the current user's interests
  const addSkillToInterests = async (skillToAdd: string) => {
    if (!user || !userProfile || userInterests.includes(skillToAdd)) {
      return; // Don't add if no user, profile, or skill already exists
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      // Update the interests array. Assuming 'interests' is a simple array of strings.
      // Use arrayUnion to add the skill without duplicates and without overwriting existing data.
      await updateDoc(userDocRef, {
        interests: arrayUnion(skillToAdd)
      });

      // Update local state to reflect the change immediately
      setUserInterests([...userInterests, skillToAdd]);

    } catch (error) {
      console.error('Error adding skill to interests:', error);
      // Handle error (e.g., show a message to the user)
    }
  };

  if (loading || !user || (userProfile && !userProfile.onboardingCompleted)) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading profile details...</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #2D1B69 0%, #4B2A9D 100%)', minHeight: '100vh' }}>
      <Head>
        <title>Your Dashboard - Symbi</title>
      </Head>

      {isMobile ? (
        // Mobile View: Inbox, Controls, and Symbi Match Explanation
        <div className="w-full p-4 flex flex-col">
          {/* Profile Section (Minimal for Mobile) */}
          <div className="p-4 border-b border-gray-200 flex items-center mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold mr-3" style={{ backgroundColor: '#A78BFA', color: '#1A202C' }}>
              {userProfile?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-lg font-semibold text-gray-900">{userProfile?.displayName || user.email}</span>
          </div>

          {/* Simplified Menu Options */}
          <nav className="flex flex-col p-4 space-y-2 mb-4 border-b border-gray-200">
            <Link href="/onboarding-again" legacyBehavior><a className="p-2 rounded hover:bg-gray-100 flex items-center text-gray-700"><span className="mr-3">📄</span>Edit Profile</a></Link>
            <button
              className="p-2 rounded hover:bg-gray-100 flex items-center text-gray-700 w-full text-left"
              onClick={async () => {
                await logOut();
                router.push('/login');
              }}
            >
              <span className="mr-3">🚪</span>Log Out
            </button>
          </nav>

          {/* "What is a Symbi Match?" Section - Brief for Mobile */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '16px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            lineHeight: '1.4',
            width: '100%',
            maxWidth: '850px',
            margin: '0 auto 24px'
          }}>
            <div style={{ color: 'white' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>✨</span>
              <strong>What&apos;s a Symbi Match?</strong> A Symbi Match happens when you and another classmate can both teach and learn.<br/><br/>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div>
                  <strong>John</strong>: AI Art <span style={{ fontSize: '16px', marginLeft: '4px' }}>🎨</span> → wants Photography <span style={{ fontSize: '16px', marginLeft: '4px' }}>📸</span>
                </div>
                <span style={{ fontSize: '24px', color: '#dcd6f5' }}>↔️</span>
                <div>
                  <strong>Maya</strong>: Photography <span style={{ fontSize: '16px', marginLeft: '4px' }}>📸</span> → wants AI Art <span style={{ fontSize: '16px', marginLeft: '4px' }}>🎨</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto">
            <Inbox />
          </div>
        </div>
      ) : (
        // Desktop View: Single-Column Layout
        <div style={{ 
          width: '100%',
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Discover Feed Header */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '40px', fontWeight: '700', color: 'white', textAlign: 'center', margin: 0 }}>
              Discover other people&apos;s skills
            </h1>
            <p style={{ textAlign: 'center', fontSize: '18px', color: '#dcd6f5', marginTop: '8px' }}>
              See what your classmates know—and what they&apos;re excited to learn.
            </p>
          </div>

          {/* "What is a Symbi Match?" Section */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '16px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            lineHeight: '1.4',
            width: '100%',
            maxWidth: '850px',
            margin: '0 auto'
          }}>
            <div style={{ color: 'white' }}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>✨</span>
              <strong>What&apos;s a Symbi Match?</strong> A Symbi Match happens when you and another classmate can both teach and learn.<br/><br/>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div>
                  <strong>John</strong>: AI Art <span style={{ fontSize: '16px', marginLeft: '4px' }}>🎨</span> → wants Photography <span style={{ fontSize: '16px', marginLeft: '4px' }}>📸</span>
                </div>
                <span style={{ fontSize: '24px', color: '#dcd6f5' }}>↔️</span>
                <div>
                  <strong>Maya</strong>: Photography <span style={{ fontSize: '16px', marginLeft: '4px' }}>📸</span> → wants AI Art <span style={{ fontSize: '16px', marginLeft: '4px' }}>🎨</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skills Grid Header */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'white', margin: '0 0 16px 0' }}>
              Explore What You Can Learn
            </h2>
          </div>

          {/* Skills Grid */}
          <div style={{ 
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            maxWidth: '900px',
            margin: '0 auto'
          }}>
            {skillsLoading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '24px',
                color: 'white',
                gridColumn: '1 / -1'
              }}>
                Loading skills...
              </div>
            ) : displayedSkills.length > 0 ? (
              displayedSkills.map(skillData => (
                <DiscoverTile
                  key={skillData.skill}
                  skill={skillData.skill}
                  onAddInterest={addSkillToInterests}
                  isAdded={userInterests.includes(skillData.skill)}
                />
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '24px',
                color: 'white',
                gridColumn: '1 / -1'
              }}>
                No skills to display at the moment.
              </div>
            )}
          </div>

          {/* Inbox Component */}
          <div style={{ marginTop: '40px' }}>
            <Inbox />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;