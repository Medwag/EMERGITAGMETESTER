// pages/Sign-up Success.ypb90.js
// ✅ PRODUCTION READY: Updated with consolidated services
import wixUsers from 'wix-users';
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { ProfileService } from 'backend/core/profile-service.jsw';
import { PaymentService } from 'backend/core/payment-service.jsw';
import { createSubscriptionWithCustomer } from 'backend/paystackSubscriptionWithCustomer.jsw';
import { generatePayFastUrl } from 'backend/payfastUrl.jsw';
import { resolvePlanAmountZar, resolvePlanName } from 'backend/plan-utils.jsw';

$w.onReady(async () => {
    const user = wixUsers.currentUser;

    if (!user.loggedIn) {
        // User not logged in - show login message only
        hideAllUIElements();
        $w("#confirmationText").text = "⚠️ Please log in to view your membership status.";
        $w("#confirmationText").show();
        return;
    }

    // Hide all UI elements initially - proper state management
    hideAllUIElements();
    
    let profile;

    try {
        // Step 1: Get or create profile using reliable service
        profile = await ProfileService.getOrCreateProfile(user.id);
        console.log('[Sign-up Success] ✅ Retrieved profile for user:', user.id);

        console.log('[Sign-up Success] Current profile state:', {
            signUpPaid: profile.signUpPaid,
            subscriptionActive: profile.subscriptionActive,
            planStatus: profile.planStatus,
            membershipTier: profile.membershipTier,
            userState: ProfileService.getUserState(profile)
        });

        // Step 2: Determine user state and show appropriate UI
        await handleUserStateReliable(user, profile);

    } catch (err) {
        const errorId = `PAY-ERR-${Date.now()}`;
        console.error("Profile creation error:", err);
        hideAllUIElements();
        $w("#confirmationText").text = `⚠️ Unable to load profile. Contact support. (Ref: ${errorId})`;
        $w("#confirmationText").show();
        return;
    }
});

// Helper function to hide all UI elements
function hideAllUIElements() {
    [
        "#confirmationText",
        "#billingCycleSwitch", 
        "#switchLabel",
        "#planRepeater",
        "#dashboardLink",
        "#managePlanLink",
        "#discountBadgeimage",
        "#signUpButton",
        "#paymentMethodSelector", // New dual gateway selector
        "#paystackPayButton",     // Paystack payment button
        "#payfastPayButton"       // PayFast payment button
    ].forEach(id => {
        try {
            $w(id).hide();
        } catch (e) {
            console.warn('Element not found:', id);
        }
    });
    try {
        $w("#billingCycleSwitch").checked = false;
        $w("#switchLabel").text = "Monthly";
    } catch (e) {
        console.warn('Could not reset billing cycle elements');
    }
}

// Alias function for consistency
function hideAllElements() {
    hideAllUIElements();
}

// ✅ PRODUCTION READY: Reliable state handler using consolidated services
async function handleUserStateReliable(user, profile) {
    console.log('[Sign-up Success] 🔍 Determining user state with reliable services');
    
    const userEmail = user.email;

    // STEP 1: Reliable signup payment detection
    let signupPaymentConfirmed = false;
    
    console.log('[Sign-up Success] Checking signup payment with PaymentService...');
    try {
        const paymentResult = await PaymentService.detectSignupPayment(user.id, userEmail);
        
        if (paymentResult.success && paymentResult.paymentDetected) {
            console.log(`✅ [Sign-up Success] Signup payment confirmed via ${paymentResult.provider} (confidence: ${paymentResult.confidence}%)`);
            signupPaymentConfirmed = true;
            
            // Sync to profile if needed
            if (!profile.signUpPaid) {
                console.log('[Sign-up Success] Syncing signup payment to profile...');
                await PaymentService.syncPaymentStatus(user.id, {
                    signUpPaid: true,
                    reference: paymentResult.reference,
                    provider: paymentResult.provider
                });
                profile.signUpPaid = true; // Update local reference
            }
        } else {
            console.log('[Sign-up Success] ❌ No signup payment detected');
            signupPaymentConfirmed = false;
        }
    } catch (error) {
        console.error('[Sign-up Success] Payment detection error:', error);
        // Fallback to profile data
        signupPaymentConfirmed = profile.signUpPaid || false;
    }

    // STATE 1: User hasn't paid signup fee - SHOW SIGNUP FLOW
    if (!signupPaymentConfirmed) {
        console.log('[Sign-up Success] 🔄 STATE 1: Showing signup flow');
        await handleUnpaidUserState(user, profile);
        return;
    }

    // STEP 2: Reliable subscription detection  
    let subscriptionActive = false;
    let membershipTier = null;

    console.log('[Sign-up Success] Checking subscription with PaymentService...');
    try {
        const subscriptionResult = await PaymentService.detectActiveSubscription(user.id, userEmail);
        
        if (subscriptionResult.success && subscriptionResult.hasActiveSubscription) {
            subscriptionActive = true;
            membershipTier = subscriptionResult.planName;
            
            console.log(`✅ [Sign-up Success] Active subscription confirmed: ${membershipTier}`);
            
            // Sync to profile if needed
            if (!profile.subscriptionActive || profile.membershipTier !== membershipTier) {
                console.log('[Sign-up Success] Syncing subscription to profile...');
                await PaymentService.syncPaymentStatus(user.id, {
                    subscriptionActive: true,
                    membershipTier: membershipTier
                });
                profile.subscriptionActive = true;
                profile.membershipTier = membershipTier;
            }
        } else {
            console.log('[Sign-up Success] No active subscription found');
            subscriptionActive = false;
        }
    } catch (error) {
        console.error('[Sign-up Success] Subscription detection error:', error);
        // Fallback to profile data
        subscriptionActive = profile.subscriptionActive || false;
        membershipTier = profile.membershipTier || null;
    }

    console.log('[Sign-up Success] Final state determination:', {
        signupPaymentConfirmed,
        subscriptionActive,
        membershipTier: membershipTier || 'None'
    });

    // STATE 2: User paid signup fee but no active subscription - SHOW PLAN SELECTION
    if (signupPaymentConfirmed && (!subscriptionActive || !membershipTier || membershipTier === 'Free')) {
        console.log('[Sign-up Success] STATE 2: Show plan selection - user paid signup but needs subscription');
        await handleSignedUpUserState(user, profile);
        return;
    }

    // STATE 3: User has active subscription - SHOW SUCCESS WITH DASHBOARD LINK
    if (signupPaymentConfirmed && subscriptionActive && membershipTier && membershipTier !== 'Free') {
        console.log('[Sign-up Success] STATE 3: Show subscription success - user has both payments and active subscription');
        await handleSubscribedUserState(user, profile);
        return;
    }

    // Fallback: Something went wrong with detection
    console.warn('[Sign-up Success] Unexpected state - showing plan selection as fallback');
    await handleSignedUpUserState(user, profile);
}

// STATE 1: User hasn't paid signup fee - redirect away from this page
async function handleUnpaidUserState(user, profile) {
    console.log('[Sign-up Success] STATE 1: Unpaid user - redirecting to payment');
    
    // Clear all UI elements
    hideAllElements();
    
    // Show clear message
    $w("#confirmationText").text = "⚠️ Signup payment required to access this page. Redirecting to payment...";
    $w("#confirmationText").show();
    
    // Show payment options or redirect after short delay
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    
    // Check if user just completed a payment (reference in URL)
    let reference = wixLocation.query.reference;
    
    if (reference) {
        // User just completed payment - verify it
        console.log('[Sign-up Success] Found payment reference in URL, verifying...');
        try {
            // Use the new PaymentService for verification
            const paymentResult = await PaymentService.detectSignupPayment(user.id, user.email);
            if (paymentResult.success && paymentResult.paymentDetected) {
                // Payment verified - update profile and continue
                await PaymentService.syncPaymentStatus(user.id, {
                    signUpPaid: true,
                    reference: paymentResult.reference,
                    provider: paymentResult.provider
                });
                
                $w("#confirmationText").text = "🎉 Payment verified! Loading plan options...";
                
                // Reload the page to trigger proper state detection
                setTimeout(() => {
                    wixLocation.to(wixLocation.url.split('?')[0]); // Remove query params and reload
                }, 1500);
                return;
            }
        } catch (verifyError) {
            console.error('[Sign-up Success] Payment verification failed:', verifyError);
        }
    }
    
    // No valid payment - redirect to signup or show payment options
    await wixWindow.openLightbox('Alert', { 
        message: '🚫 Access Denied\n\nYou need to complete your signup payment before accessing plan options.\n\nRedirecting to signup page...' 
    });
    
    // Redirect to signup page or show payment UI
    wixLocation.to('/sign-up'); // Adjust URL as needed
}

// STATE 2: User paid signup fee, now needs to select subscription plan  
// Note: keep single canonical implementation; legacy retained with different name to avoid duplicate declaration
async function handleSignedUpUserState_v1(user, profile) {
    console.log('[Sign-up Success] STATE 2: Signed up user - showing plan selection');
    
    hideAllElements();
    
    $w("#confirmationText").text = "✅ Signup complete! Please select a membership plan below.";
    $w("#confirmationText").show();
    
    // Show plan selection UI
    $w("#billingCycleSwitch").show();
    $w("#switchLabel").show();

    const initialCycle = $w("#billingCycleSwitch").checked ? "Annual" : "Monthly";
    await loadPlansFromCMS(initialCycle);

    $w("#billingCycleSwitch").onChange(() => {
        const cycle = $w("#billingCycleSwitch").checked ? "Annual" : "Monthly";
        $w("#switchLabel").text = cycle;
        loadPlansFromCMS(cycle);
    });
    
    // Hide dashboard/manage buttons - user doesn't have subscription yet
    try {
        $w("#dashboardLink").hide();
        $w("#managePlanLink").hide();
    } catch (e) {
        // Elements may not exist
        console.log('[Sign-up Success] Dashboard/manage links not found on page');
    }
}

// Show dual gateway payment options for signup fee
// STATE 2: User paid signup fee, now needs to select subscription plan  
async function handleSignedUpUserState(user, profile) {
    console.log('[Sign-up Success] STATE 2: Signed up user - showing plan selection');
    
    $w("#confirmationText").text = "✅ Signup complete! Please select a plan below.";
    $w("#confirmationText").show();
    
    // Show plan selection UI
    $w("#billingCycleSwitch").show();
    $w("#switchLabel").show();

    const initialCycle = $w("#billingCycleSwitch").checked ? "Annual" : "Monthly";
    await loadPlansFromCMS(initialCycle);

    $w("#billingCycleSwitch").onChange(() => {
        const cycle = $w("#billingCycleSwitch").checked ? "Annual" : "Monthly";
        $w("#switchLabel").text = cycle;
        loadPlansFromCMS(cycle);
    });
    
    // Hide dashboard/manage buttons - user doesn't have subscription yet
    $w("#dashboardLink").hide();
    $w("#managePlanLink").hide();
}

// STATE 3: User has active subscription - show dashboard access
async function handleSubscribedUserState(user, profile) {
    console.log('[Sign-up Success] STATE 3: Subscribed user - showing dashboard access');
    
    hideAllElements();
    
    // Get accurate subscription info
    let planName = profile.membershipTier;
    
    // Try to get more accurate subscription info
    try {
        console.log('[Sign-up Success] Getting accurate subscription info...');
        const currentUser = wixUsers.currentUser;
        const userEmail = currentUser.email;
        
        if (userEmail) {
            const result = await import('backend/enhanced-subscription-detector.jsw')
                .then(m => m.detectUserSubscriptions(userEmail, user.id));
            
            if (result.success && result.data?.selectedSubscription) {
                planName = result.data.selectedSubscription.plan?.name || planName;
                console.log('[Sign-up Success] Updated plan name from subscription detector:', planName);
            }
        }
    } catch (detectionError) {
        console.warn('[Sign-up Success] Could not get accurate subscription info:', detectionError);
    }
    
    // Use fallback plan name if still undefined - SECURITY: Never default to paid plan  
    if (!planName || planName === 'undefined' || planName === 'null' || planName === 'N/A') {
        planName = 'Free'; // SECURITY: Default to Free tier only
        console.log('[Sign-up Success] Using fallback plan name (SECURITY: defaulting to Free):', planName);
    }
    
    // Show subscription confirmation
    $w("#confirmationText").html = `
        <p style="text-align: center; font-size: 18px; color: #28a745; margin-bottom: 20px;">
            🎉 <strong>Congratulations!</strong><br>
            You are subscribed to the <strong>${planName} Plan</strong>
        </p>
        <p style="text-align: center; font-size: 16px; margin-bottom: 30px;">
            Your emergency profile is now active and ready to use.
        </p>
    `;
    $w("#confirmationText").show();
    
    // Show dashboard access button
    try {
        $w("#dashboardLink").label = "Access Your Emergency Profile Dashboard";
        $w("#dashboardLink").show();
        
        // Make sure the dashboard link works
        $w("#dashboardLink").onClick(() => {
            wixLocation.to('/emergency-profile-dashboard'); // Adjust URL as needed
        });
    } catch (e) {
        console.log('[Sign-up Success] Dashboard link not available, creating alternative');
        // If dashboard link doesn't exist, modify confirmation text to include link
        $w("#confirmationText").html = `
            <p style="text-align: center; font-size: 18px; color: #28a745; margin-bottom: 20px;">
                🎉 <strong>Congratulations!</strong><br>
                You are subscribed to the <strong>${planName} Plan</strong>
            </p>
            <p style="text-align: center; font-size: 16px; margin-bottom: 20px;">
                Your emergency profile is now active and ready to use.
            </p>
            <p style="text-align: center;">
                <a href="/emergency-profile-dashboard" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Access Your Dashboard
                </a>
            </p>
        `;
    }
    
    // Show manage plan button if available
    try {
        $w("#managePlanLink").label = "Manage Subscription";
        $w("#managePlanLink").show();
    } catch (e) {
        console.log('[Sign-up Success] Manage plan link not available');
    }
    
    // Hide plan selection UI - user already has a plan
    try {
        $w("#billingCycleSwitch").hide();
        $w("#switchLabel").hide();
        $w("#planRepeater").hide();
    } catch (e) {
        console.log('[Sign-up Success] Plan selection UI elements not found');
    }
}

// Helper function to get accurate subscription information
// --- Utility Functions ---
async function markSignUpPaid(userId, reference, isNewPayment = true, provider = 'paystack') {
    try {
        const profileQuery = await wixData.query("Emergency_Profiles")
            .eq("_owner", userId)
            .limit(1)
            .find();

        if (profileQuery.items.length) {
            const profile = profileQuery.items[0];
            
            // Only update if not already paid (prevent duplicate processing)
            if (!profile.signUpPaid) {
                profile.signUpPaid = true;  // Your signUpPaid field
                profile.signUpReference = reference; // Your signUpReference field
                profile.joinedDate = new Date(); // Your joinedDate field
                profile.lastPaymentDate = new Date(); // Your lastPaymentDate field
                profile.paymentProvider = provider; // Track which gateway was used
                profile.signUpAmount = 149.00; // Track signup fee amount
                
                const updatedProfile = await wixData.update("Emergency_Profiles", profile);
                console.log(`✅ Updated Emergency_Profiles - signUpPaid: true, signUpReference: ${reference}, provider: ${provider}, joinedDate: ${profile.joinedDate}`);
                
                // 🚫 DISABLED: WhatsApp messages moved to payment webhook confirmations only
                // This prevents premature WhatsApp sending before actual payment confirmation
                console.log(`📝 [Sign-up Success] Profile updated for payment - WhatsApp will be sent via webhook after payment confirmation`);
                
                // NOTE: Welcome messages are now sent ONLY via sendPostPaymentNotifications()
                // from payment webhooks (PayStack/PayFast) after confirmed payment
                if (isNewPayment && !profile.welcomeMessageSent) {
                    console.log(`✋ [Sign-up Success] Skipping welcome messages - will be sent after webhook confirmation`);
                    // MOVED TO WEBHOOK HANDLERS ONLY - no longer sending from this page
                } else if (!isNewPayment) {
                    console.log(`ℹ️ Skipping welcome messages - ${provider} payment was recovered from existing transaction`);
                } else {
                    console.log('ℹ️ Skipping welcome messages - already sent previously');
                }
                
                return updatedProfile;
            } else {
                console.log('ℹ️ Signup already marked as paid - no changes made');
                return profile;
            }
        } else {
            // Create new profile with enhanced signup payment fields
            const newProfile = {
                _owner: userId,
                signUpPaid: true,           // Your signUpPaid field
                signUpReference: reference, // Your signUpReference field
                joinedDate: new Date(),     // Your joinedDate field
                lastPaymentDate: new Date(), // Your lastPaymentDate field
                paymentProvider: provider,  // Track which gateway was used
                signUpAmount: 149.00,        // Track signup fee amount
                dateCreated: new Date(),
                subscriptionActive: false,
                membershipTier: null,       // Your membershipTier field (will be set when they subscribe)
                planStatus: null,           // Your planStatus field
                paystackCustomerCode: null, // Your paystackCustomerCode field (will be set from API)
                publicViewId: Math.random().toString(36).substring(2, 10),
                welcomeMessageSent: false
            };
            
            const createdProfile = await wixData.insert("Emergency_Profiles", newProfile);
            
            // 🚫 DISABLED: WhatsApp messages moved to payment webhook confirmations only
            // This prevents premature WhatsApp sending before actual payment confirmation
            if (isNewPayment) {
                console.log(`✋ [Sign-up Success] Skipping welcome messages for new profile - will be sent after webhook confirmation`);
                // NOTE: Welcome messages are now sent ONLY via sendPostPaymentNotifications()
                // from payment webhooks (PayStack/PayFast) after confirmed payment
            }
            
            return createdProfile;
        }
    } catch (err) {
        console.error("❌ Failed to mark signup as paid:", err);
        throw err;
    }
}

async function loadPlansFromCMS(cycle = "Monthly") {
    try {
        const results = await wixData.query("PlanOptions").ascending("sortOrder").find();
        const planData = results.items;

        if (!planData.length) return;

        $w("#planRepeater").data = planData;
        $w("#planRepeater").show();

        $w("#planRepeater").onItemReady(async ($item, itemData) => {
            const price = await resolvePlanAmountZar(itemData, cycle);
            const name = await resolvePlanName(itemData);

            $item("#planName").text = name;
            $item("#planDescription").text = itemData.description || "";
            $item("#planPrice").text = `R${price} / ${cycle}`;
            $item("#planImage").src = itemData.productImage;

            // Setup dual gateway subscription with payment method choice
            $item("#subscribeButton").label = `Choose Payment Method - ${name}`;
            $item("#subscribeButton").onClick(async () => {
                await handleDualPaymentSubscription($item, itemData, price, cycle);
            });
            
            // Legacy PayFast button (if exists) - redirect to dual selection
            try {
                $item("#subscribePayFastButton").label = `Choose Payment Method`;
                $item("#subscribePayFastButton").onClick(async () => {
                    await handleDualPaymentSubscription($item, itemData, price, cycle);
                });
            } catch (e) {
                // PayFast subscription button not available
                console.log('Legacy PayFast button not available');
            }
        });
    } catch (err) {
        console.error("❌ Error loading plans from CMS:", err);
        $w("#confirmationText").text = "⚠️ Unable to load plans. Contact support.";
        $w("#confirmationText").show();
    }
}

// ✅ NEW: Handle dual payment gateway subscription selection
async function handleDualPaymentSubscription($item, itemData, price, cycle) {
    try {
        console.log(`Opening payment method selector for plan: ${itemData.planTier}`);
        
        // Open dual payment selector lightbox
        await wixWindow.openLightbox('PaymentMethodSelector', {
            planName: itemData.planTier,
            amount: price,
            isAnnual: cycle === "Annual",
            features: itemData.description ? itemData.description.split('\n').slice(0, 5) : [],
            savings: cycle === "Annual" && itemData.monthlyPrice ? 
                Math.round(((itemData.monthlyPrice * 12 - itemData.annualPrice) / (itemData.monthlyPrice * 12)) * 100) : 0
        });

    } catch (err) {
        console.error("❌ Payment method selection error:", err);
        await wixWindow.openLightbox('Alert', {
            message: `Payment Selection Error: ${err.message}\n\nPlease try again or contact support.`
        });
    }
}

// Legacy: Handle subscription selection (Paystack only) - kept for backward compatibility
async function handleSubscriptionSelection($item, itemData, cycle) {
    $item("#subscribeButton").label = "Redirecting to Paystack...";
    $item("#subscribeButton").disable();

    try {
        const currentUser = wixUsers.currentUser;
        if (!currentUser.loggedIn) throw new Error("User not logged in");

        const subscription = await createSubscriptionWithCustomer(itemData.planTier, cycle, currentUser.id);

        // --- Handle already subscribed ---
        if (subscription.success && subscription.authorization_url) {
            wixLocation.to(subscription.authorization_url);
        } else if (subscription.alreadySubscribed) {
            $item("#subscribeButton").hide();
            $w("#confirmationText").text = `🎉 You are already subscribed to ${itemData.planTier} plan.`;
            $w("#confirmationText").show();
        } else {
            throw new Error(subscription.message || "Subscription failed");
        }

    } catch (err) {
        console.error("❌ Subscription error:", err);
        $item("#subscribeButton").label = "Try Again";
        $item("#subscribeButton").enable();
        
        await wixWindow.openLightbox('Alert', {
            message: `Subscription Error: ${err.message}\n\nPlease try again or contact support.`
        });
    }
}

// Handle PayFast subscription
async function handlePayFastSubscription($item, itemData, cycle) {
    $item("#subscribePayFastButton").label = "Processing PayFast...";
    $item("#subscribePayFastButton").disable();

    try {
        const currentUser = wixUsers.currentUser;
        if (!currentUser.loggedIn) throw new Error("User not logged in");

        // Import PayFast subscription URL generator
        const { generatePayFastSubscriptionUrl } = await import('backend/payfastUrl.jsw');
        
        const price = cycle === "Annual" ? itemData.annualPrice : itemData.monthlyPrice;
        const payFastUrl = await generatePayFastSubscriptionUrl(
            currentUser.id, 
            itemData.planTier, 
            price, 
            cycle.toLowerCase()
        );
        
        console.log('PayFast subscription URL generated successfully');
        wixLocation.to(payFastUrl);

    } catch (err) {
        console.error("❌ PayFast subscription error:", err);
        $item("#subscribePayFastButton").label = "Try PayFast Again";
        $item("#subscribePayFastButton").enable();
        
        await wixWindow.openLightbox('Alert', {
            message: `PayFast Subscription Error: ${err.message}\n\nPlease try again or use Paystack instead.`
        });
    }
}
