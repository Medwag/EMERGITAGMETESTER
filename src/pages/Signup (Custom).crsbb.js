import wixUsers from 'wix-users';
import wixData from 'wix-data';
import { updateProfile } from 'backend/profile-logger.jsw';

function generateUniqueId() {
  return `emergi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}


$w.onReady(async function () {
  const user = wixUsers.currentUser;
  if (!user.loggedIn) return;

  const userId = user.id;
  // Removed undefined 'profile' usage
  try {
    const existingProfile = await wixData.query("Emergency_Profiles")
      .eq("_owner", userId)
      .limit(1)
      .find();

    if (existingProfile.items.length === 0) {
      await wixData.insert("Emergency_Profiles", {
        _owner: userId,
        signUpPaid: true,
        publicViewId: generateUniqueId(), // You might already have a function for this
        lastUpdated: new Date()
      });
      console.log("✅ Emergency profile created for new user.");
    } else {
      console.log("ℹ️ Profile already exists for user.");
    }
  } catch (err) {
    console.error("❌ Error checking/creating Emergency Profile:", err);
  }
});
