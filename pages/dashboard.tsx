import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import DiscoverTile from '../components/DiscoverTile';
import { db } from '../lib/firebase'; // Assuming firebase is used for data fetching
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore'; // Assuming firestore is used
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

  // Fallback skills if not enough real data
  const FALLBACK_SKILLS: SkillData[] = [
    { skill: 'Graphic Design' },
    { skill: 'Creative Writing' },
    { skill: 'Data Analysis' },
    { skill: 'Public Speaking' },
    { skill: 'Web Development' },
    { skill: 'Digital Marketing' },
  ];

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
         // Optionally, clear skills while waiting, or show a loading state handled by the JSX
         // setDisplayedSkills([]); 
         return;
      }

      setSkillsLoading(true);
      try {
        const usersRef = collection(db, 'users');
        // Fetch users excluding the current one
        const q = query(usersRef, where('uid', '!=', user.uid));
        const querySnapshot = await getDocs(q);

        const allOtherUserSkills: SkillData[] = [];
        querySnapshot.forEach(doc => {
          const userData = doc.data();
          // Assuming skills are stored in a 'skills' field as an array of objects like { name: string, type: 'know' | 'learn' }
          // Filter for skills they 'know'
          if (userData.skills && Array.isArray(userData.skills)) {
            userData.skills.forEach((skillItem: any) => {
              if (skillItem.name && skillItem.type === 'know') { // Assuming 'type' indicates if they 'know' or 'want to learn'
                allOtherUserSkills.push({
                  skill: skillItem.name,
                });
              }
            });
          }
        });

        // Filter out skills the current user already has as interests
        const filteredSkills = allOtherUserSkills.filter(otherSkill =>
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

        // Combine unique skills from others and fallback skills, then filter by user interests and select 4
        const allPotentialSkills = [...uniqueSkills, ...FALLBACK_SKILLS];

        const finalFilteredSkills = allPotentialSkills.filter(skill =>
           !userInterests.some(userInterest => userInterest === skill.skill)
        );

        // Remove duplicates from the combined and filtered list
        const finalUniqueSkillsMap = new Map<string, SkillData>();
        finalFilteredSkills.forEach(skill => {
          if (!finalUniqueSkillsMap.has(skill.skill)) {
            finalUniqueSkillsMap.set(skill.skill, skill);
          }
        });
        const finalUniqueSkills = Array.from(finalUniqueSkillsMap.values());

        // Select up to 4 random skills from the final unique list
        const shuffledFinalSkills = finalUniqueSkills.sort(() => 0.5 - Math.random());
        let selectedFinalSkills = shuffledFinalSkills.slice(0, 4);

        // If less than 4 skills are selected, supplement with fallback skills that are NOT in user interests
        if (selectedFinalSkills.length < 4) {
           const remainingSlots = 4 - selectedFinalSkills.length;
           const existingSkillNames = new Set(selectedFinalSkills.map(s => s.skill));
           const fallbackSupplementFiltered = FALLBACK_SKILLS.filter(fallbackSkill =>
            !existingSkillNames.has(fallbackSkill.skill) &&
            !userInterests.some(userInterest => userInterest === fallbackSkill.skill) // Strictly filter fallback by user interests
          ).slice(0, remainingSlots);
           selectedFinalSkills = [...selectedFinalSkills, ...fallbackSupplementFiltered];
        }

        setDisplayedSkills(selectedFinalSkills);

      } catch (error) {
        console.error('Error fetching skills:', error);
        // Fallback in case of error, filtered strictly by user interests
        const fallbackOnErr = FALLBACK_SKILLS.filter(fallbackSkill =>
           !userInterests.some(userInterest => userInterest === fallbackSkill.skill)
        ).slice(0, 4);
        setDisplayedSkills(fallbackOnErr);

      } finally {
        setSkillsLoading(false);
      }
    };

    // Fetch skills when user, userProfile, or userInterests change
    // Explicitly check that userProfile and userInterests are not undefined before calling fetchAndSetSkills
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

      {/* Left Sidebar - Simplified */}
      <div className="w-64 bg-white text-gray-800 flex flex-col shadow-lg">{/* Sidebar container with light background */}
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
           <Link href="/onboarding-again" legacyBehavior><a className="p-2 rounded hover:bg-gray-100 flex items-center text-gray-700"><span className="mr-3">📄</span>Edit Profile</a></Link>{/* Edit Profile Link */}
           {/* Log Out Button styled as a link */}
           <button
             className="p-2 rounded hover:bg-gray-100 flex items-center text-gray-700 w-full text-left"
             onClick={async () => {
               await logOut();
               router.push('/login');
             }}
           >
             <span className="mr-3">🚪</span>Log Out
           </button>{/* Log Out Button */}
        </nav>

        {/* Chats Section (Inbox) */}
        <div className="flex-grow overflow-y-auto p-4 border-t border-gray-200">{/* Container for scrollable chats */}
          {/* <h3 className="text-lg font-semibold text-gray-900 mb-3">Chats</h3> */}{/* Chats Title */}
          <Inbox />{/* Integrated Inbox component */}
        </div>
      </div>

      {/* Main Content Area - Discover Feed */}
      <div className="flex-1 p-10">{/* Main content area with padding */}

        <div className="w-full max-w-4xl mx-auto">{/* Container to center content */}

          {/* Discover Feed Header */}
          <div className="mb-8 text-center">{/* Centered text */}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover other people's skills</h1>
            <p className="text-lg text-gray-600">See what your classmates know—and what they're excited to learn.</p>
          </div>

          {/* "What is a Symbi Match?" Section */}
          <div className="bg-purple-100 border border-purple-300 rounded-lg p-4 mb-8 shadow-sm text-center">{/* Styled banner/box with centered text */}
            <h2 className="text-lg font-semibold text-purple-800 mb-2">What's a Symbi Match?</h2>{/* Title */}
            <p className="text-purple-700 leading-relaxed mb-3">⭐ Symbi Matches are mutual learning connections. You and another student both have something to learn—and something to teach.</p>{/* Body */}
            <div className="bg-purple-200 rounded-md p-3 text-purple-900 text-sm">{/* Example box */}
              <p><span className="font-semibold">John knows:</span> AI art<br/><span className="font-semibold">Wants to learn:</span> Photography</p>
              <p className="mt-2"><span className="font-semibold">Maya knows:</span> Photography<br/><span className="font-semibold">Wants to learn:</span> AI art</p>
              <p className="mt-2 font-semibold">⭐ That's a Symbi Match.</p>
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
    </div> // End of Main container for 2-column layout
  );
};

export default DashboardPage;