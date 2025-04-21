import React, { useState } from 'react';
import { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ProfileEditForm } from './ProfileEditForm'; // Import the new form component

interface ProfileHeaderProps {
    profile: NDKUserProfile | null;
    user: NDKUser;
    onProfileUpdate: () => void; // Add callback prop
}

const defaultBanner = "https://via.placeholder.com/1200x300/cccccc/888888?text=No+Banner";
const defaultAvatar = "https://via.placeholder.com/150/cccccc/888888?text=N";

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, user, onProfileUpdate }) => {
    const { user: loggedInUser } = useNdk();
    const isOwnProfile = user.pubkey === loggedInUser?.pubkey;
    const [showEditModal, setShowEditModal] = useState(false);

    const bannerUrl = profile?.banner || defaultBanner;
    const avatarUrl = profile?.image || defaultAvatar;
    const displayName = profile?.displayName || profile?.name || user.npub.substring(0, 12);
    // Keep existing values for display if profile is null
    const displayAbout = profile?.about || "No description provided.";
    const displayWebsite = profile?.website;
    const displayLud16 = profile?.lud16;
    const displayNip05 = profile?.nip05;


    const handleOpenEditModal = () => {
        setShowEditModal(true);
    };

    // Just closes modal now, refresh is handled by parent via onProfileUpdate
    const handleCloseEditModal = () => {
        setShowEditModal(false);
    };

    const formatWebsite = (url: string) => {
        try {
            const parsed = new URL(url);
            return parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname);
        } catch { return url; }
    };

    return (
        <div className="profile-header">
            <div style={{ background: `#eee url(${bannerUrl}) no-repeat center center / cover`, height: '250px', marginBottom: '-75px' }}></div>
            <div style={{ padding: '0 20px', display: 'flex', alignItems: 'flex-end', justifyContent:'space-between' }}>
                 <img
                    src={avatarUrl}
                    alt={`${displayName}'s avatar`}
                    style={{ width: '150px', height: '150px', borderRadius: '50%', border: '5px solid white', background: 'white' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
                />
                 {isOwnProfile && (
                     <button onClick={handleOpenEditModal} style={{ marginBottom: '10px' }}>
                         Edit Profile
                     </button>
                 )}
            </div>
            <div style={{ padding: '10px 20px' }}>
                <h2 style={{ margin: '5px 0' }}>{displayName}</h2>
                {displayNip05 && <p style={{ margin: '2px 0', color: 'grey', fontSize: '0.9em' }}>✓ {displayNip05}</p>}
                <p style={{ margin: '10px 0' }}>{displayAbout}</p>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', color: '#555', fontSize:'0.9em' }}>
                    {displayWebsite && <span>🌐 <a href={displayWebsite} target="_blank" rel="noopener noreferrer nofollow">{formatWebsite(displayWebsite)}</a></span>}
                    {displayLud16 && <span>⚡ {displayLud16}</span>}
                     <span>🔑 {user.npub.substring(0,10)}...{user.npub.substring(user.npub.length-5)}</span>
                </div>
            </div>

            {/* Edit Modal */}
            {isOwnProfile && showEditModal && (
                <ProfileEditForm
                    currentUser={user}
                    currentProfile={profile || {}} // Pass existing profile or empty obj
                    onClose={handleCloseEditModal} // Just closes modal
                    onProfileUpdate={onProfileUpdate} // Pass down the refresh trigger
                />
            )}
        </div>
    );
};