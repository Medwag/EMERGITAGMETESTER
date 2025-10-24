import wixUsers from 'wix-users';
import wixLocation from 'wix-location';
import { sendWhatsAppOTP, verifyOTP } from 'backend/otp.jsw';
import wixData from 'wix-data';

let currentUserId = null;
let lastProfilePhone = null;

$w.onReady(async () => {
    console.log("Page loaded");

    if ($w("#debugBox")) $w("#debugBox").hide();

    // Attach button handlers
    if ($w("#sendOtpButton")) $w("#sendOtpButton").onClick(sendOtpButton_click);
    if ($w("#verifyOtpButton")) $w("#verifyOtpButton").onClick(verifyOtpButton_click);

    if (!wixUsers.currentUser.loggedIn) {
        console.log("User not logged in, prompting login...");
        wixUsers.promptLogin()
            .then(() => initializeOTP())
            .catch(() => wixLocation.to("/"));
    } else {
        initializeOTP();
    }
});

async function initializeOTP() {
    currentUserId = wixUsers.currentUser.id;
    console.log("Initializing OTP for userId:", currentUserId);

    try {
        const results = await wixData.query("Emergency_Profiles")
            .eq("_owner", currentUserId)
            .find();

        if (results.items.length === 0) {
            console.warn("Profile not found for user:", currentUserId);
            $w("#statusText").text = "Profile not found.";
            $w("#otpSection").hide();
            $w("#protectedContent").hide();
            return;
        }

        const profile = results.items[0];
        lastProfilePhone = profile.phone;

        if (profile.otpVerified) {
            console.log("OTP already verified");
            $w("#protectedContent").show();
            $w("#otpSection").hide();
        } else {
            console.log("OTP not verified, showing OTP section");
            $w("#otpSection").show();
            $w("#protectedContent").hide();
        }

    } catch (err) {
        console.error("Error querying Emergency_Profiles:", err);
        $w("#statusText").text = "Error loading profile. Check console.";
    }
}

// --- Send OTP ---
async function sendOtpButton_click() {
    const enteredPhone = $w("#phoneInput").value.trim();
    if (!enteredPhone) {
        $w("#statusText").text = "Enter your phone number first.";
        return;
    }

    try {
        // Ensure phone matches Emergency_Profiles
        const results = await wixData.query("Emergency_Profiles")
            .eq("_owner", currentUserId)
            .find();

        if (results.items.length === 0) {
            $w("#statusText").text = "Profile not found.";
            return;
        }

        const profile = results.items[0];
        lastProfilePhone = profile.phone;

        if (enteredPhone !== profile.phone) {
            $w("#statusText").text = "Phone number does not match our records.";
            return;
        }

        $w("#statusText").text = "Sending OTP...";
        const result = await sendWhatsAppOTP(currentUserId, enteredPhone);
        console.log("OTP sent:", result);
        $w("#statusText").text = "OTP sent to your WhatsApp!";

        if ($w("#debugBox") && $w("#debugText")) {
            $w("#debugBox").show();
            $w("#debugText").text = `
Current User ID: ${currentUserId}
Profile Phone: ${lastProfilePhone}
Entered Phone: ${enteredPhone}
WhatsApp API Result: ${JSON.stringify(result)}
            `;
        }

    } catch (err) {
        console.error("Error sending OTP:", err);
        $w("#statusText").text = "Failed to send OTP. Check console.";
    }
}

// --- Verify OTP ---
async function verifyOtpButton_click() {
    const otp = $w("#otpInput").value.trim();
    if (!otp) {
        $w("#statusText").text = "Enter OTP first.";
        return;
    }

    try {
        const verified = await verifyOTP(currentUserId, otp);
        console.log("OTP verification result:", verified);

        if (verified) {
            $w("#otpSection").hide();
            $w("#protectedContent").show();
            $w("#statusText").text = "OTP verified!";
        } else {
            $w("#statusText").text = "Invalid or expired OTP.";
        }

        if ($w("#debugBox") && $w("#debugText")) {
            $w("#debugBox").show();
            $w("#debugText").text = `
Current User ID: ${currentUserId}
Last OTP Attempt: ${otp}
OTP Verified: ${verified}
            `;
        }

    } catch (err) {
        console.error("Error verifying OTP:", err);
        $w("#statusText").text = "Error verifying OTP. Check console.";
    }
}
