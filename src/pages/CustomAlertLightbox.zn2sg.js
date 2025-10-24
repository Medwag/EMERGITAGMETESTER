// Code for CustomAlertLightbox
import wixWindow from 'wix-window';

$w.onReady(function () {
    const context = wixWindow.lightbox.getContext();
    if (context && context.message) {
        $w('#alertMessageText').text = context.message; // Make sure #alertMessageText is the ID of your text element
    }
});