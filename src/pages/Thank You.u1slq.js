import wixLocation from 'wix-location';
import wixData from 'wix-data';
import wixUsers from 'wix-users';

$w.onReady(function () {
  const query = wixLocation.query;

  const tier = query.membershipTier;
  const userId = query.userId;
  const reference = query.reference;

  console.log("Membership Tier:", tier);
  console.log("User ID:", userId);
  console.log("Reference:", reference);

  // Set message
  if (tier) {
    $w("#message").text = `Thank you for subscribing to the ${tier} plan!`;
  } else {
    $w("#message").text = `Thank you for subscribing!`;
  }

  // Hide optional elements by default
  $w("#dashboardButton").hide();
  $w("#errorText").hide();

  // Save to CMS
  if (userId && tier && reference) {
    wixUsers.currentUser.getEmail()
      .then((email) => {
        saveToCMS(userId, tier, email, reference);
      })
      .catch((err) => {
        console.error("Could not retrieve user email:", err);
        $w("#errorText").text = "Error retrieving your email. Please try again.";
        $w("#errorText").show();
      });
  } else {
    console.warn("Missing userId, tier, or reference from URL.");
    $w("#errorText").text = "Missing subscription info. Please contact support.";
    $w("#errorText").show();
  }
});

function saveToCMS(userId, tier, email, reference) {
  wixData.query("Emergency_Profiles")
    .eq("_owner", userId)
    .find()
    .then((results) => {
      if (results.items.length > 0) {
        const item = results.items[0];
        item.membershipTier = tier;
        item.email = email;
        item.lastReference = reference;

        return wixData.update("Emergency_Profiles", item);
      } else {
        const newItem = {
          _owner: userId,
          membershipTier: tier,
          email: email,
          lastReference: reference
        };

        return wixData.insert("Emergency_Profiles", newItem);
      }
    })
    .then(() => {
      console.log("Emergency profile saved successfully.");
      $w("#dashboardButton").show();

      // Optional: Auto-redirect to dashboard
      setTimeout(() => {
        wixLocation.to("/dashboard");
      }, 5000);
    })
    .catch((err) => {
      console.error("Error saving Emergency Profile:", err);
      $w("#errorText").text = "Oops! Something went wrong saving your profile.";
      $w("#errorText").show();
    });
}
