import wixLocation from 'wix-location';
import wixUsers from 'wix-users';
import { updateEmergencyProfileStatus } from 'backend/profile-utils.jsw';

$w.onReady(async () => {
  const query = wixLocation.query;
  const reference = query.reference || "";
  const membershipTier = query.plan || "Bronze";  // Adjust based on your actual query param or default tier

  $w("#statusText").text = "🔄 Verifying your subscription...";
  $w("#statusText").show();

  const user = wixUsers.currentUser;
  if (!user.loggedIn) {
    $w("#statusText").text = "⚠️ Please log in to complete your subscription.";
    return;
  }

  const userId = user.id;

  try {
    // Construct the updates object to pass to backend
    const updates = {
      planStatus: "active",
      membershipTier,
      lastReference: reference,
      subscriptionActive: true,
      updatedAt: new Date()
    };

    // Call backend function with userId and updates object
    const result = await updateEmergencyProfileStatus(userId, updates);

    if (result) {
      $w("#statusText").text = "🎉 Your subscription is now active!";
      $w("#goToDashboard").show();
    } else {
      $w("#statusText").text = "❌ Could not verify your subscription. Please contact support.";
    }
  } catch (err) {
    console.error("❌ Error confirming subscription:", err);
    $w("#statusText").text = "⚠️ There was a problem confirming your subscription.";
  }
});
