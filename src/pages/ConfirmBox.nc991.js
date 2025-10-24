// In ConfirmBox Lightbox Page
import wixWindow from 'wix-window';

$w.onReady(() => {
  $w("#yesButton").onClick(() => {
    wixWindow.lightbox.close(true);  // Return true
  });

  $w("#noButton").onClick(() => {
    wixWindow.lightbox.close(false); // Return false
  });

  // Optionally, display message from context
  const context = wixWindow.lightbox.getContext();
  if (context && context.message) {
    $w("#confirmationMessage").text = context.message;
  }
});
