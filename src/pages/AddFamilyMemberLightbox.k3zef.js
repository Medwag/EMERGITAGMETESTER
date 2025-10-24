import { lightbox } from 'wix-window';

$w.onReady(() => {
  $w('#saveMemberButton').onClick(() => {
    const fullName = $w('#fullNameInput').value.trim();
    const relationship = $w('#relationshipInput').value.trim();

    if (!fullName || !relationship) {
      // Show basic error handling (optional alert)
      $w('#saveMemberButton').label = "Missing info!";
      setTimeout(() => $w('#saveMemberButton').label = "Save", 2000);
      return;
    }

    // Return data to the main page
    lightbox.close({ fullName, relationship });
  });

  $w('#cancelButton').onClick(() => {
    lightbox.close(); // Cancels and passes nothing
  });
});
