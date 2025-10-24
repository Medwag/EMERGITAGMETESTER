// =============================================================
// ✅ EmergiTag.me – Payment Success / Plan Selection Page
// =============================================================
// Handles:
//  • Post-signup success verification
//  • Plan selection and subscription creation
//  • State detection (unpaid, paid, subscribed)
//  • Paystack integration (PayFast optional)
//
// Last updated: October 2025
// =============================================================

import wixUsers from 'wix-users';
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { getOrCreateProfile } from 'backend/core/profile-service.jsw';
import PaymentService from 'backend/core/payment-service-new.jsw';
import { createSubscriptionWithCustomer } from 'backend/paystackSubscriptionWithCustomer.jsw';
// import { generatePayFastUrl } from 'backend/payfastUrl.jsw'; // 💤 commented out for later
import { resolvePlanAmountZar, resolvePlanName } from 'backend/plan-utils.jsw';

// =============================================================
// 🧭 PAGE INITIALIZATION
// =============================================================
$w.onReady(async () => {

  // =============================================================
  // 🧩 TARGETED CONSOLE TRACING BLOCK
  // =============================================================
  try {
    console.log('🔍 [Payment-Success] Page initialized at', new Date().toISOString());
    const user = wixUsers.currentUser;
    console.log('👤 wixUsers.currentUser object:', user);
    console.log('🧾 user.loggedIn:', user?.loggedIn);
    console.log('🆔 user.id:', user?.id);

    // Attempt to fetch basic user info if logged in
    if (user?.loggedIn) {
      const email = await user.getEmail().catch(() => '(no email accessible)');
      console.log('📧 user.email (from API):', email);
    } else {
      console.warn('⚠️ User is NOT logged in at payment-success stage!');
    }
  } catch (traceErr) {
    console.error('💥 [Tracing] Failed to log user info:', traceErr);
  }
  // =============================================================

  const user = wixUsers.currentUser;

  // 1️⃣ Require login
  if (!user.loggedIn) {
    hideAllUI();
    $w('#confirmationText').text = '⚠️ Please log in to view your membership status.';
    $w('#confirmationText').show();
    return;
  }
// In payment-success page, early in onReady():
if (user.loggedIn) {
  const profile = await getOrCreateProfile(user.id);
  if (!profile?.signUpPaid) {
    console.warn('🚫 Access denied: Sign-up fee not paid.');
    wixLocation.to('/sign-up-page');
    return;
  }
}
  hideAllUI();
  let profile;

  try {
  // 2️⃣ Retrieve or create profile (updated import version)
  profile = await getOrCreateProfile(user.id);
  console.log('[Payment Success] ✅ Profile loaded for user:', user.id);
  console.log('[Payment Success] 🧾 Profile data:', profile);
    if (!profile) {
      console.warn('⚠️ No profile returned by ProfileService.getOrCreateProfile()');
    }

    // 3️⃣ Determine user state
    await handleUserState(user, profile);
  } catch (err) {
    const errorRef = `ERR-${Date.now()}`;
    console.error('❌ Profile load error:', err);
    hideAllUI();
    $w('#confirmationText').text = `⚠️ Unable to load profile. Please contact support. (Ref: ${errorRef})`;
    $w('#confirmationText').show();
  }
});

// =============================================================
// 🧩 UI HELPERS
// =============================================================
function hideAllUI() {
  const elements = [
    '#confirmationText', '#billingCycleSwitch', '#switchLabel', '#planRepeater',
    '#dashboardLink', '#managePlanLink', '#discountBadgeimage',
    '#signUpButton', '#paymentMethodSelector', '#paystackPayButton', '#payfastPayButton'
  ];
  elements.forEach(id => {
    try { $w(id).hide(); } catch (_) {}
  });
  try {
    $w('#billingCycleSwitch').checked = false;
    $w('#switchLabel').text = 'Monthly';
  } catch (_) {}
}

// =============================================================
// 🔍 STATE MANAGEMENT
// =============================================================
async function handleUserState(user, profile) {
  const email = user.email;
  let signUpPaid = false;

  // 🟢 1. Verify signup payment
  try {
    const res = await PaymentService.detectSignupPayment(user.id, email);
    console.log('[Payment Success] detectSignupPayment result:', res);

    signUpPaid = res.success && res.paymentDetected;
    if (signUpPaid && !profile.signUpPaid) {
      await PaymentService.syncPaymentStatus(user.id, {
        signUpPaid: true,
        reference: res.reference,
        provider: res.provider
      });
      profile.signUpPaid = true;
    }
  } catch (err) {
    console.warn('⚠️ Signup payment detection failed:', err);
    signUpPaid = profile.signUpPaid || false;
  }

  // 🟡 If not paid → redirect
  if (!signUpPaid) return handleUnpaidUserState(user);

  // 🟢 2. Check subscription status
  let subscribed = false;
  let planName = null;
  try {
    const sub = await PaymentService.detectActiveSubscription(user.id, email);
    console.log('[Payment Success] detectActiveSubscription result:', sub);

    if (sub.success && sub.hasActiveSubscription) {
      subscribed = true;
      planName = sub.planName;
      if (!profile.subscriptionActive || profile.membershipTier !== planName) {
        await PaymentService.syncPaymentStatus(user.id, {
          subscriptionActive: true,
          membershipTier: planName
        });
        profile.subscriptionActive = true;
        profile.membershipTier = planName;
      }
    } else {
      subscribed = false;
    }
  } catch (err) {
    console.warn('⚠️ Subscription detection failed:', err);
    subscribed = profile.subscriptionActive || false;
    planName = profile.membershipTier || null;
  }

  // 3️⃣ Route by state
  if (signUpPaid && !subscribed) {
    console.log('🟢 State: Paid but unsubscribed');
    return handlePlanSelection(user, profile);
  } else if (signUpPaid && subscribed) {
    console.log('🟢 State: Paid and subscribed');
    return handleSubscribedUser(user, profile, planName);
  } else {
    console.warn('⚠️ Unknown state – defaulting to plan selection');
    return handlePlanSelection(user, profile);
  }
}

// (rest of your file remains identical...)


// =============================================================
// 🚫 STATE 1: Unpaid user
// =============================================================
async function handleUnpaidUserState(user) {
  hideAllUI();
  $w('#confirmationText').text = '⚠️ Signup payment required. Redirecting to payment...';
  $w('#confirmationText').show();

  await new Promise(r => setTimeout(r, 2000));
  wixLocation.to('/sign-up');
}

// =============================================================
// 🟢 STATE 2: Paid but unsubscribed – show plan options
// =============================================================
async function handlePlanSelection(user, profile) {
  hideAllUI();

  $w('#confirmationText').text = '✅ Signup complete! Please select a membership plan below.';
  $w('#confirmationText').show();

  $w('#billingCycleSwitch').show();
  $w('#switchLabel').show();

  const initialCycle = $w('#billingCycleSwitch').checked ? 'Annual' : 'Monthly';
  await loadPlans(initialCycle);

  $w('#billingCycleSwitch').onChange(() => {
    const cycle = $w('#billingCycleSwitch').checked ? 'Annual' : 'Monthly';
    $w('#switchLabel').text = cycle;
    loadPlans(cycle);
  });

  $w('#dashboardLink').hide();
  $w('#managePlanLink').hide();
}

// =============================================================
// 💎 STATE 3: Subscribed – show dashboard access
// =============================================================
async function handleSubscribedUser(user, profile, planName) {
  hideAllUI();
  const name = planName || profile.membershipTier || 'Free';

  $w('#confirmationText').html = `
    <p style="text-align:center;font-size:18px;color:#28a745;">
      🎉 <strong>Congratulations!</strong><br>
      You are subscribed to the <strong>${name} Plan</strong>.
    </p>
    <p style="text-align:center;font-size:16px;">Your emergency profile is now active.</p>
  `;
  $w('#confirmationText').show();

  // Dashboard access
  try {
    $w('#dashboardLink').label = 'Access Your Emergency Dashboard';
    $w('#dashboardLink').onClick(() => wixLocation.to('/emergency-profile-dashboard'));
    $w('#dashboardLink').show();
  } catch (_) {}

  try {
    $w('#managePlanLink').label = 'Manage Subscription';
    $w('#managePlanLink').show();
  } catch (_) {}
}

// =============================================================
// 📦 LOAD PLANS FROM CMS
// =============================================================
async function loadPlans(cycle = 'Monthly') {
  try {
    const res = await wixData.query('PlanOptions').ascending('sortOrder').find();
    const plans = res.items;
    if (!plans.length) throw new Error('No plans found');

    $w('#planRepeater').data = plans;
    $w('#planRepeater').show();

    $w('#planRepeater').onItemReady(async ($item, item) => {
      const price = await resolvePlanAmountZar(item, cycle);
      const name = await resolvePlanName(item);

      $item('#planName').text = name;
      $item('#planDescription').text = item.description || '';
      $item('#planPrice').text = `R${price} / ${cycle}`;
      $item('#planImage').src = item.productImage;

      $item('#subscribeButton').label = `Subscribe via Paystack – ${name}`;
      $item('#subscribeButton').onClick(() => handlePaystackSubscription(item, cycle));

      // (Optional PayFast logic)
      /*
      $item('#subscribePayFastButton').label = 'Subscribe via PayFast';
      $item('#subscribePayFastButton').onClick(() =>
        handlePayFastSubscription(item, cycle)
      );
      */
    });
  } catch (err) {
    console.error('❌ Failed to load plans:', err);
    $w('#confirmationText').text = '⚠️ Unable to load plans. Please contact support.';
    $w('#confirmationText').show();
  }
}

// =============================================================
// 💳 SUBSCRIPTION HANDLERS
// =============================================================
async function handlePaystackSubscription(item, cycle) {
  try {
    const user = wixUsers.currentUser;
    if (!user.loggedIn) throw new Error('User not logged in.');

    const email = await user.getEmail();
    const sub = await createSubscriptionWithCustomer(item.planTier, cycle, user.id, email);

    if (sub.success && sub.authorization_url) {
      wixLocation.to(sub.authorization_url);
    } else if (sub.alreadySubscribed) {
      $w('#confirmationText').text = `🎉 You are already subscribed to ${item.planTier}.`;
      $w('#confirmationText').show();
    } else {
      throw new Error(sub.message || 'Subscription failed.');
    }
  } catch (err) {
    console.error('❌ Subscription error:', err);
    await wixWindow.openLightbox('Alert', {
      message: `Subscription Error: ${err.message}\nPlease try again or contact support.`
    });
  }
}

// (Optional PayFast subscription handler – commented for later)
/*
async function handlePayFastSubscription(item, cycle) {
  try {
    const user = wixUsers.currentUser;
    const { generatePayFastSubscriptionUrl } = await import('backend/payfastUrl.jsw');
    const price = cycle === 'Annual' ? item.annualPrice : item.monthlyPrice;
    const url = await generatePayFastSubscriptionUrl(user.id, item.planTier, price, cycle.toLowerCase());
    wixLocation.to(url);
  } catch (err) {
    console.error('❌ PayFast error:', err);
    await wixWindow.openLightbox('Alert', {
      message: `PayFast Error: ${err.message}\nTry again or use Paystack instead.`
    });
  }
}
*/
