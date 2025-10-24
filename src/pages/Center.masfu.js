// Lightbox/ConfirmationModal.js
import wixWindow from 'wix-window';

$w.onReady(function () {
    // Get data passed to the lightbox
    const data = wixWindow.lightbox.getContext();
    $w("#modalMessageText").text = data.message;

    $w("#confirmYesButton").onClick(() => {
        wixWindow.lightbox.close("yes");
    });

    $w("#confirmNoButton").onClick(() => {
        wixWindow.lightbox.close("no");
    });
});