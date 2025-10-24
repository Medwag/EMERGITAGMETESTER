// frontend/pages/subscription-success.js

import wixLocation from 'wix-location';
import wixData from 'wix-data';
import wixUsers from 'wix-users'; // Still needed for current user context if we needed it, but not for getMember(userId)
import { verifyPaystackTransaction } from 'backend/paystack-utils.jsw';
import { updateEmergencyProfileStatus } from 'backend/profile-utils.jsw'; // Ensure this function exists
import { notifyAdminOfPayment, sendSubscriptionConfirmationEmail } from 'backend/email-utils.jsw'; // Assume these exist or will be created

$w.onReady(async function () {
    $w("#statusMessage").text = "Verifying your subscription payment... Please wait.";
    $w("#successSection").hide();
    $w("#errorSection").hide();
    $w("#goToDashboardButton").hide();
    $w("#managePlanLink").hide(); // Assuming you have a 'manage my plan' link

    const query = wixLocation.query;
    const reference = query.reference;
    const userId = query.userId;
    const paystackPlanCode = query.plan; // The Paystack plan code from callback_url
    const transactionType = query.type; // Should be 'subscription'

    if (!reference || !userId || transactionType !== 'subscription') {
        $w("#statusMessage").text = "Subscription verification failed: Missing transaction details or invalid type.";
        $w("#errorSection").show();
        console.error("Missing 'reference', 'userId', or invalid 'type' in URL query parameters for subscription.");
        return;
    }

    try {
        // First, check our local pending transaction record
        let transactionRecord = await wixData.get('PaystackTransactions', reference);

        if (!transactionRecord) {
            $w("#statusMessage").text = "Subscription verification failed: Transaction record not found locally.";
            $w("#errorSection").show();
            console.error(`Local transaction record for reference ${reference} not found.`);
            // Potentially allow retrying verification if it's a known issue, or direct to support
            return;
        }

        if (transactionRecord.status === 'success') {
            // Already verified and updated, likely due to webhook or previous visit
            $w("#statusMessage").text = "✅ Your subscription has already been confirmed!";
            $w("#successSection").show();
            handleSuccessfulSubscription(userId, transactionRecord.planName, true); // Pass true to indicate already processed
            return;
        }

        // Verify the transaction with Paystack API
        const paystackResponse = await verifyPaystackTransaction(reference);

        if (paystackResponse.status === true && paystackResponse.data && paystackResponse.data.status === 'success') {
            // Payment was successful on Paystack's side
            $w("#statusMessage").text = "✅ Your subscription payment was successful!";
            $w("#successSection").show();

            // Extract plan details from Paystack response metadata or local record
            const confirmedPlanName = paystackResponse.data.metadata?.custom_fields?.find(f => f.variable_name === 'plan_name')?.value || transactionRecord.planName;
            const confirmedSubscriptionType = paystackResponse.data.metadata?.custom_fields?.find(f => f.variable_name === 'subscription_type')?.value || transactionRecord.subscriptionType;
            const userEmail = paystackResponse.data.customer?.email || transactionRecord.userEmail; // Get email from Paystack response or local record
            const userName = paystackResponse.data.customer?.first_name || paystackResponse.data.customer?.last_name || 'Client'; // Get name from Paystack response or default

            // Update the local PaystackTransactions record
            await wixData.update('PaystackTransactions', {
                _id: reference,
                status: 'success',
                verifiedAt: new Date(),
                paystackResponse: paystackResponse // Store the full response for auditing
            });

            // Update Emergency_Profiles: subscriptionActive = true, membershipTier = confirmedPlanName
            await updateEmergencyProfileStatus(userId, {
                subscriptionActive: true,
                membershipTier: confirmedPlanName
            });
            console.log(`User ${userId} subscribed to ${confirmedPlanName} (${confirmedSubscriptionType}).`);

            // Send confirmation emails using the extracted email and name
            if (userEmail) { // Ensure email exists before trying to send
                 sendSubscriptionConfirmationEmail(userEmail, userName, confirmedPlanName, paystackResponse.data.amount / 100);
                 notifyAdminOfPayment('subscription', userEmail, paystackResponse.data.amount / 100);
            } else {
                console.warn("Could not retrieve user email for sending subscription confirmation/admin notification.");
            }

            handleSuccessfulSubscription(userId, confirmedPlanName);

        } else {
            // Payment failed or was not successful on Paystack's side
            let errorMessage = "❌ Subscription payment failed or was not successful. Please try again.";
            if (paystackResponse.data && paystackResponse.data.gateway_response) {
                errorMessage = `❌ Subscription payment failed: ${paystackResponse.data.gateway_response}.`;
            }
            $w("#statusMessage").text = errorMessage;
            $w("#errorSection").show();
            console.error("Paystack subscription transaction not successful:", paystackResponse);

            // Update the local PaystackTransactions record to 'failed'
            await wixData.update('PaystackTransactions', {
                _id: reference,
                status: 'failed',
                verifiedAt: new Date(),
                paystackResponse: paystackResponse
            });
        }

    } catch (error) {
        $w("#statusMessage").text = "An error occurred during subscription verification. Please contact support.";
        $w("#errorSection").show();
        console.error("Error during subscription payment verification:", error);

        // Optional: Update transaction status to 'error' if it exists and is still pending
        try {
            if (reference) {
                await wixData.update('PaystackTransactions', {
                    _id: reference,
                    status: 'error',
                    verifiedAt: new Date(),
                    errorMessage: error.message || 'Unknown error during verification'
                }).catch(updateErr => console.error("Failed to update transaction status to error:", updateErr));
            }
        } catch (innerErr) {
            console.error("Error updating failed transaction record:", innerErr);
        }
    }
});

// Function to handle successful subscription and guide user
async function handleSuccessfulSubscription(userId, planName, alreadyProcessed = false) {
    if (!alreadyProcessed) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Small delay for data sync
    }

    try {
        const userProfile = await wixData.get('Emergency_Profiles', userId);
        
        // Get the actual plan name from various sources
        let actualPlanName = userProfile?.membershipTier || planName;
        
        // If membershipTier is undefined, try to get it from Paystack
        if (!actualPlanName || actualPlanName === 'undefined' || actualPlanName === 'null') {
            try {
                console.log('[Subscription Success] membershipTier is undefined, fetching from Paystack...');
                const { getUserSubscriptionDetails } = await import('backend/paystack.jsw');
                const subscriptionDetails = await getUserSubscriptionDetails(userId);
                
                if (subscriptionDetails && !subscriptionDetails.error) {
                    actualPlanName = subscriptionDetails.planName;
                    console.log('[Subscription Success] Got plan name from Paystack:', actualPlanName);
                } else {
                    console.log('[Subscription Success] Could not get subscription details:', subscriptionDetails?.error);
                }
            } catch (paystackErr) {
                console.error('[Subscription Success] Error fetching Paystack details:', paystackErr);
            }
        }
        
        // Use fallback plan name if still undefined - SECURITY: Never default to paid plan
        if (!actualPlanName || actualPlanName === 'undefined' || actualPlanName === 'null' || actualPlanName === 'N/A') {
            // SECURITY: Only default to Free tier without confirmed payment
            actualPlanName = planName && planName !== 'undefined' && planName !== 'null' ? planName : 'Free';
            console.log('[Subscription Success] Using fallback plan name (SECURITY: defaulting to Free if no valid plan):', actualPlanName);
        }
        
        if (userProfile && userProfile.subscriptionActive === true) {
            $w("#statusMessage").text = `✅ You are now subscribed to the ${actualPlanName} Plan! Welcome aboard!`;
            $w("#goToDashboardButton").show();
            $w("#managePlanLink").show();
        } else {
            // Fallback if profile update hasn't propagated or has issue
            $w("#statusMessage").text = `✅ Your subscription to the ${actualPlanName} Plan is confirmed! Go to your dashboard to manage your plan.`;
            $w("#goToDashboardButton").show();
            $w("#managePlanLink").show();
        }
    } catch (profileErr) {
        console.error("Error fetching profile after subscription success:", profileErr);
        $w("#statusMessage").text = "✅ Your subscription is confirmed! An error occurred checking your profile. Please go to your dashboard.";
        $w("#goToDashboardButton").show();
    }

    $w("#goToDashboardButton").onClick(() => wixLocation.to("/client-dashboard"));
    $w("#managePlanLink").onClick(() => wixLocation.to("/myplan")); // Replace /myplan with your actual manage plan page
}