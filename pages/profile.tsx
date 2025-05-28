import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const AVAIL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AVAIL_BLOCKS = ['Morning', 'Afternoon', 'Evening'];

const ProfilePage: React.FC = () => {
  const { user, userProfile, loading: authLoading, error: authError } = useAuth();
  const [editing, setEditing] = useState({
    interests: false,
    expertise: false,
    skillsWanted: false,
    hotTakes: false,
    displayName: false,
    photoURL: false,
    availability: false,
  });
  const [editValue, setEditValue] = useState('');
  const [localProfile, setLocalProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (userProfile) {
      setLocalProfile({
        displayName: userProfile.displayName || '',
        photoURL: userProfile.photoURL || '',
        interests: userProfile.interests || [],
        expertise: userProfile.expertise || [],
        skillsWanted: userProfile.skillsWanted || [],
        hotTakes: userProfile.hotTakes || [],
        availability: userProfile.availability || {},
      });
    }
  }, [userProfile]);

  if (authLoading || !user || !userProfile || !localProfile) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading profile...</div>;
  }
  if (authError) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>Error: {authError}</div>;
  }

  // Only allow editing for current user
  const isEditable = true;

  // Tag chip input for editing
  const handleEditTags = (field: keyof typeof localProfile) => {
    setEditing(e => ({ ...e, [field]: true }));
    setEditValue((localProfile[field] || []).join(', '));
  };
  const handleSaveTags = async (field: keyof typeof localProfile) => {
    const newTags = editValue.split(',').map(s => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { [field]: newTags });
      setLocalProfile((p: any) => ({ ...p, [field]: newTags }));
      setEditing(e => ({ ...e, [field]: false }));
      setEditValue('');
      setError(null);
    } catch (err) {
      setError('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  // Hot takes editing
  const handleEditHotTakes = () => {
    setEditing(e => ({ ...e, hotTakes: true }));
    setEditValue((localProfile.hotTakes || []).join(' | '));
  };
  const handleSaveHotTakes = async () => {
    const newHotTakes = editValue.split('|').map(s => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { hotTakes: newHotTakes });
      setLocalProfile((p: any) => ({ ...p, hotTakes: newHotTakes }));
      setEditing(e => ({ ...e, hotTakes: false }));
      setEditValue('');
      setError(null);
    } catch (err) {
      setError('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  // Name editing
  const handleEditName = () => {
    setEditing(e => ({ ...e, displayName: true }));
    setEditValue(localProfile.displayName);
  };
  const handleSaveName = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: editValue });
      setLocalProfile((p: any) => ({ ...p, displayName: editValue }));
      setEditing(e => ({ ...e, displayName: false }));
      setEditValue('');
      setError(null);
    } catch (err) {
      setError('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  // Photo editing (URL for now)
  const handleEditPhoto = () => {
    setEditing(e => ({ ...e, photoURL: true }));
    setEditValue(localProfile.photoURL);
  };
  const handleSavePhoto = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { photoURL: editValue });
      setLocalProfile((p: any) => ({ ...p, photoURL: editValue }));
      setEditing(e => ({ ...e, photoURL: false }));
      setEditValue('');
      setError(null);
    } catch (err) {
      setError('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  // Availability editing
  const handleToggleBlock = (day: string, block: string) => {
    setLocalProfile((p: any) => {
      const prevBlocks = p.availability[day] || [];
      const newBlocks = prevBlocks.includes(block)
        ? prevBlocks.filter((b: string) => b !== block)
        : [...prevBlocks, block];
      return { ...p, availability: { ...p.availability, [day]: newBlocks } };
    });
  };
  const handleSaveAvailability = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { availability: localProfile.availability });
      setEditing(e => ({ ...e, availability: false }));
      setError(null);
    } catch (err) {
      setError('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', marginRight: 28 }}>
          <img src={localProfile.photoURL} alt="Profile" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }} />
          {isEditable && <button onClick={handleEditPhoto} style={{ position: 'absolute', bottom: 0, right: 0, background: '#eee', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>✏️</button>}
        </div>
        <div>
          {editing.displayName ? (
            <>
              <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ fontSize: 24, fontWeight: 700, borderRadius: 8, border: '1px solid #ccc', padding: 6, marginRight: 8 }} />
              <button onClick={handleSaveName} style={{ fontSize: 18, borderRadius: 8, border: 'none', background: '#007bff', color: 'white', padding: '6px 16px', fontWeight: 600 }} disabled={saving}>Save</button>
            </>
          ) : (
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{localProfile.displayName} {isEditable && <button onClick={handleEditName} style={{ fontSize: 18, border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>}</h2>
          )}
        </div>
      </div>
      {/* Interests */}
      <Section title="Interests" onEdit={() => handleEditTags('interests')} editing={editing.interests} editValue={editValue} setEditValue={setEditValue} onSave={() => handleSaveTags('interests')} tags={localProfile.interests} saving={saving} isEditable={isEditable} />
      {/* Skills Offered (expertise) */}
      <Section title="Skills I Can Share" onEdit={() => handleEditTags('expertise')} editing={editing.expertise} editValue={editValue} setEditValue={setEditValue} onSave={() => handleSaveTags('expertise')} tags={localProfile.expertise} saving={saving} isEditable={isEditable} />
      {/* Skills Wanted */}
      <Section title="Skills I Want to Learn" onEdit={() => handleEditTags('skillsWanted')} editing={editing.skillsWanted} editValue={editValue} setEditValue={setEditValue} onSave={() => handleSaveTags('skillsWanted')} tags={localProfile.skillsWanted} saving={saving} isEditable={isEditable} />
      {/* Hot Takes */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Hot Takes {isEditable && <button onClick={handleEditHotTakes} style={{ fontSize: 16, border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>}</div>
        {editing.hotTakes ? (
          <>
            <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ fontSize: 16, borderRadius: 8, border: '1px solid #ccc', padding: 6, marginRight: 8, width: 300 }} />
            <button onClick={handleSaveHotTakes} style={{ fontSize: 16, borderRadius: 8, border: 'none', background: '#007bff', color: 'white', padding: '6px 16px', fontWeight: 600 }} disabled={saving}>Save</button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(localProfile.hotTakes || []).map((ht: string, i: number) => (
              <span key={i} style={{ background: '#f7f7f7', borderRadius: 16, padding: '10px 18px', fontSize: 16, fontStyle: 'italic', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>💬 {ht}</span>
            ))}
          </div>
        )}
      </div>
      {/* Availability */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Availability {isEditable && <button onClick={() => setEditing(e => ({ ...e, availability: !e.availability }))} style={{ fontSize: 16, border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>}</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th></th>
              {AVAIL_DAYS.map(day => <th key={day} style={{ padding: 4, fontWeight: 500 }}>{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {AVAIL_BLOCKS.map(block => (
              <tr key={block}>
                <td style={{ fontWeight: 500 }}>{block}</td>
                {AVAIL_DAYS.map(day => (
                  <td key={day} style={{ textAlign: 'center', padding: 4 }}>
                    <button
                      type="button"
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: '1px solid #ccc', background: (localProfile.availability[day] || []).includes(block) ? '#007bff' : '#fff', color: (localProfile.availability[day] || []).includes(block) ? 'white' : '#333', cursor: editing.availability ? 'pointer' : 'default', fontWeight: 600
                      }}
                      onClick={() => editing.availability && handleToggleBlock(day, block)}
                      disabled={!editing.availability}
                    >
                      {block[0]}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {editing.availability && <button onClick={handleSaveAvailability} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 20, border: 'none', backgroundColor: '#007bff', color: 'white', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }} disabled={saving}>Save Availability</button>}
      </div>
    </div>
  );
};

// Tag chip section
const Section: React.FC<{ title: string, tags: string[], onEdit: () => void, editing: boolean, editValue: string, setEditValue: (v: string) => void, onSave: () => void, saving: boolean, isEditable: boolean }> = ({ title, tags, onEdit, editing, editValue, setEditValue, onSave, saving, isEditable }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{title} {isEditable && <button onClick={onEdit} style={{ fontSize: 16, border: 'none', background: 'none', cursor: 'pointer' }}>✏️</button>}</div>
    {editing ? (
      <>
        <input value={editValue} onChange={e => setEditValue(e.target.value)} style={{ fontSize: 16, borderRadius: 8, border: '1px solid #ccc', padding: 6, marginRight: 8, width: 300 }} />
        <button onClick={onSave} style={{ fontSize: 16, borderRadius: 8, border: 'none', background: '#007bff', color: 'white', padding: '6px 16px', fontWeight: 600 }} disabled={saving}>Save</button>
      </>
    ) : (
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(tags || []).map((tag, i) => (
          <span key={i} style={{ background: '#e0f2ff', borderRadius: 14, padding: '8px 16px', fontSize: 15, fontWeight: 500, color: '#007bff', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>{tag}</span>
        ))}
      </div>
    )}
  </div>
);

export default ProfilePage; 