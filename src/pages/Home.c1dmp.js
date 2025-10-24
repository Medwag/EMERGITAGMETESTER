import wixUsers from 'wix-users';
import { isAdmin } from 'backend/auth';

$w.onReady(async function () {
  // Hide Admin button by default
  $w("#adminBtn").hide();

  if (wixUsers.currentUser.loggedIn) {
    const admin = await isAdmin();
    if (admin) {
      $w("#adminBtn").show();
    }
  }
});
