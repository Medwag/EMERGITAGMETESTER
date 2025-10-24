// Filename: pages/Warning.js
import wixWindow from 'wix-window';
import wixData from 'wix-data';
import wixUsers from 'wix-users';
import { fetch } from 'wix-fetch'; // For calling HTTP backend

$w.onReady(function () {
    $w("#agreeButton").onClick(async () => {
        console.log("DEBUG Lightbox: Agree button clicked");

        if (!wixUsers.currentUser.loggedIn) {
            console.warn("User not logged in. Cannot log agreement.");
            try {
                await wixWindow.lightbox.close(false);
            } catch (e) {
                console.error("DEBUG Lightbox: Failed to close lightbox after login check failed", e);
            }
            return;
        }

        $w("#agreeButton").disable(); // Prevent duplicate clicks

        const userId = wixUsers.currentUser.id;
        const agreementType = "PublicProfileChangeDisclaimer";
        const pageAccessed = "Emergency Contact Dashboard";
        let ipAddress = "N/A";
        const timestamp = new Date().toISOString();

        console.log("DEBUG Lightbox: Attempting to get client IP via fetch...");
        try {
            const response = await fetch('/_functions/getClientIp', { method: 'GET' });

            if (response.ok) {
                const data = await response.json();
                if (data && data.ip) {
                    ipAddress = data.ip;
                    console.log("DEBUG Lightbox: IP address retrieved:", ipAddress);
                } else {
                    console.warn("DEBUG Lightbox: IP data missing in response.");
                }
            } else {
                console.error(`DEBUG Lightbox: HTTP error fetching IP: ${response.status} ${response.statusText}`);
            }
        } catch (err) {
            console.error("DEBUG Lightbox: Fetch error when getting client IP:", err);
        }

        const logEntry = {
            userId,
            agreementType,
            timestamp,
            pageAccessed,
            ipAddress
        };

        try {
            await wixData.insert("UserAgreementsLog", logEntry);
            console.log("DEBUG Lightbox: User agreement logged successfully:", logEntry);

            try {
                await wixWindow.lightbox.close(true);
            } catch (e) {
                console.error("DEBUG Lightbox: Failed to close lightbox after success:", e);
            }

        } catch (error) {
            console.error("DEBUG Lightbox: Failed to insert agreement log:", error);
            await wixWindow.openLightbox("CustomAlertLightbox", { message: "Failed to log agreement. Please try again." });

            try {
                await wixWindow.lightbox.close(false);
            } catch (e) {
                console.error("DEBUG Lightbox: Failed to close lightbox after insert error:", e);
            }
        }
    });
});
