import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import DiscoverTile from '../components/DiscoverTile';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import Inbox from '../components/Inbox'; // Import Inbox component to display chats

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

        // Sort by count (popularity) and select top 4
        const sortedSkills = uniqueSkills.sort((a, b) => {
          const countA = querySnapshot.docs.find(doc => doc.data().tag === a.skill)?.data().count || 0;
          const countB = querySnapshot.docs.find(doc => doc.data().tag === b.skill)?.data().count || 0;
          return countB - countA;
        });

        const selectedSkills = sortedSkills.slice(0, 4);
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
    <div className="flex min-h-screen" style={{ background: 'linear-gradient(to bottom, #f2f0ff, #e2d7f7)' }}>{/* Main container with new background gradient and flex layout */}
      <Head>
        <title>Your Dashboard - Symbi</title>
      </Head>

      {isMobile ? (
        // Mobile View: Inbox, Controls, and Symbi Match Explanation
        <div className="w-full p-4 flex flex-col">
          {/* Profile Section (Minimal for Mobile) */}
          <div className="p-4 border-b border-gray-200 flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-lg font-semibold mr-3">
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
          <div className="bg-purple-100 border border-purple-300 rounded-lg p-4 mb-6 shadow-sm text-center">
            <h2 className="text-lg font-semibold text-purple-800 mb-2">What&apos;s a Symbi Match?</h2>
            <p className="text-purple-700 leading-relaxed text-sm">⭐ Symbi Matches are mutual learning connections. You and another student both have something to learn—and something to teach.</p>
          </div>

          <div className="flex-grow overflow-y-auto">
            <Inbox />
          </div>
        </div>
      ) : (
        // Desktop View: Original Two-Column Layout
        <>
          {/* Left Sidebar - Simplified */}
          <div className="w-1/2 text-gray-800 flex flex-col shadow-lg" style={{ background: 'linear-gradient(to bottom, #f2f0ff, #e2d7f7)' }}>{/* Sidebar container with light background */}
            {/* Profile Section */}
            <div className="p-4 border-b border-gray-200 flex items-center">
              {/* Profile Picture/Initials */}
              <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-lg font-semibold mr-3">
                {userProfile?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
              {/* User Name */}
              <span className="text-lg font-semibold text-gray-900">{userProfile?.displayName || user.email}</span>
            </div>

            {/* Simplified Menu Options */}
            <nav className="flex flex-col p-4 space-y-2">
               <Link 
                 href="/onboarding-again"
                 className="p-3 rounded-lg bg-white hover:bg-purple-50 flex items-center text-gray-800 border border-purple-200 shadow-sm transition-colors"
               >
                 <span className="mr-3">📄</span>Edit Profile
               </Link>
               <button
                 className="p-3 rounded-lg bg-white hover:bg-purple-50 flex items-center text-gray-800 border border-purple-200 shadow-sm transition-colors w-full text-left"
                 onClick={async () => {
                   await logOut();
                   router.push('/login');
                 }}
               >
                 <span className="mr-3">🚪</span>Log Out
               </button>
            </nav>

            {/* Chats Section (Inbox) */}
            <div className="flex-grow overflow-y-auto p-4 border-t border-gray-200">{/* Container for scrollable chats */}
              {/* <h3 className="text-lg font-semibold text-gray-900 mb-3">Chats</h3> */}{/* Chats Title */}
              <Inbox />{/* Integrated Inbox component */}
            </div>
          </div>

          {/* Main Content Area - Discover Feed */}
          <div className="w-1/2 p-10">{/* Main content area with padding */}

            <div className="w-full max-w-4xl mx-auto">{/* Container to center content */}

              {/* Discover Feed Header */}
              <div className="mb-8 text-center">{/* Centered text */}
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover other people&apos;s skills</h1>
                <p className="text-lg text-gray-600">See what your classmates know—and what they&apos;re excited to learn.</p>
              </div>

              {/* "What is a Symbi Match?" Section */}
              <div className="bg-purple-100 border border-purple-300 rounded-lg p-4 mb-8 shadow-sm text-center">{/* Styled banner/box with centered text */}
                <h2 className="text-lg font-semibold text-purple-800 mb-2">What&apos;s a Symbi Match?</h2>{/* Title */}
                <p className="text-purple-700 leading-relaxed mb-3">⭐ Symbi Matches are mutual learning connections. You and another student both have something to learn—and something to teach.</p>{/* Body */}
                <div className="bg-purple-200 rounded-md p-3 text-purple-900 text-sm">{/* Example box */}
                  <p><span className="font-semibold">John knows:</span> AI art<br/><span className="font-semibold">Wants to learn:</span> Photography</p>
                  <p className="mt-2"><span className="font-semibold">Maya knows:</span> Photography<br/><span className="font-semibold">Wants to learn:</span> AI art</p>
                  <p className="mt-2 font-semibold">⭐ That&apos;s a Symbi Match.</p>
                </div>
                 {/* Optional: Add a "View all Symbi Matches" button here if needed */}
              </div>

              {/* Discover Skill Tiles Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">{/* Grid for 2 tiles per row on desktop, 1 on mobile */}
                {skillsLoading ? (
                  <div className="col-span-full text-center text-gray-600">Loading skills...</div>
                ) : (
                  displayedSkills.map((skillData) => (
                    <DiscoverTile
                      key={skillData.skill} // Using skill name as key
                      skill={skillData.skill}
                      onAddInterest={addSkillToInterests}
                      isAdded={userInterests.includes(skillData.skill)} // Pass if the skill is already an interest
                    />
                  ))
                )}
              </div>

              {/* Search Bar Placeholder */}

            </div>{/* End of centered content container */}
          </div>{/* End of Main Content Area */}
        </>
      )}
    </div> // End of Main container for 2-column layout
  );
};

export default DashboardPage;