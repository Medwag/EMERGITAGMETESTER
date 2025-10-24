import wixWindow from 'wix-window';

$w.onReady(function () {
  const data = wixWindow.lightbox.getContext();
  if (data && data.message) {
    $w("#messageText").text = data.message;
  }

  $w("#closeButton").onClick(() => {
    wixWindow.lightbox.close();
  });
});
