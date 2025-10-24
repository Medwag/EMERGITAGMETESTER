// Velo API Reference: https://www.wix.com/velo/reference/api-overview/introduction

$w.onReady(function () {

	// Write your Javascript code here using the Velo framework API

	// Print hello world:
	// console.log("Hello world!");

	// Call functions on page elements, e.g.:
	// $w("#button1").label = "Click me!";

	// Click "Run", or Preview your site, to execute your code

});
import wixUsers from 'wix-users';
import wixData from 'wix-data';

$w.onReady(async () => {
  const user = wixUsers.currentUser;
  const userId = user.id;

  const result = await wixData.query("Emergency_Profiles")
    .eq("_owner", userId)
    .find();

  if (result.items.length > 0) {
    const profile = result.items[0];
    const tier = profile.membershipTier;
    
    $w("#membershipText").text = `You are on the ${tier} Plan`;

    if (tier === "Bronze") {
      $w("#bronzeSection").show();
    } else if (tier === "Silver") {
      $w("#silverSection").show();
    } else if (tier === "Gold") {
      $w("#goldSection").show();
    } else if (tier === "Pet") {
      $w("#petSection").show();
    }
  }
});
