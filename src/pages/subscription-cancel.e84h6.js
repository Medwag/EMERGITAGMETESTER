// frontend/pages/subscription-cancel.js

import wixLocation from 'wix-location';
import wixWindow from 'wix-window'; // Import wixWindow

$w.onReady(function () {
    // Immediately open the lightbox
    wixWindow.openLightbox("SubscriptionCancelledLightbox") // Replace with your Lightbox name
        .then((data) => {
            // Optional: Handle data passed back from the lightbox if any
            // e.g., if the lightbox has a button that redirects
            if (data === "tryAgain") {
                wixLocation.to("/join");
            } else if (data === "contactSupport") {
                wixLocation.to("/contact");
            }
        })
        .catch((err) => {
            console.error("Error opening SubscriptionCancelledLightbox:", err);
            // Fallback: display message on the page if lightbox fails
            $w("#cancelMessage").text = "Your subscription payment was cancelled or did not complete. Please try again or contact support if you believe this is an error.";
            $w("#cancelMessage").show();
            $w("#tryAgainButton").show();
            $w("#contactSupportButton").show();
        });

    // Hide page elements if lightbox is intended to cover everything
    $w("#cancelMessage").hide(); // Hide the text on the page
    $w("#tryAgainButton").hide(); // Hide the buttons on the page
    $w("#contactSupportButton").hide(); // Hide the buttons on the page

    // In your Lightbox code, you would have buttons that close the lightbox and pass data back:
    // $w("#lightboxTryAgainButton").onClick(() => wixWindow.lightbox.close("tryAgain"));
    // $w("#lightboxContactButton").onClick(() => wixWindow.lightbox.close("contactSupport"));
});