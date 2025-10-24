import wixUsers from 'wix-users';
import wixData from 'wix-data';

// Add this function OUTSIDE $w.onReady()
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 10);
}

$w.onReady(async () => {
  const user = wixUsers.currentUser;
  const userId = user.id;

  const result = await wixData.query("Emergency_Profiles")
    .eq("loginEmail", userId)
    .find();

  if (result.items.length === 0) {
    await wixData.insert("Emergency_Profiles", {
      loginEmail: userId,
      publicViewId: generateUniqueId(),
      membershipTier: "Bronze"
    });

    console.log("Emergency profile created.");
  } else {
    console.log("Emergency profile already exists.");
  }
});
