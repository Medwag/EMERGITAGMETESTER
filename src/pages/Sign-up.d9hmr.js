// ---------------------------------------------
// 1️⃣ Imports
// ---------------------------------------------
import payments from 'backend/payments.jsw'; // ✅ correct import
import wixUsers from 'wix-users';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import wixData from 'wix-data';
import { checkPayments } from 'backend/payments-check.jsw';
import { getMemberFirstName } from 'backend/getContactInfo.jsw';
import { session } from 'wix-storage'; // ✅ temporary storage
import { generatePayfastUrl, generatePaystackUrl } from 'backend/payments.jsw'; // ✅ secure backend calls

// ---------------------------------------------
// 2️⃣ Collapse / Show Helpers
// ---------------------------------------------
function showAndExpand(id) {
  try {
    const el = $w(id);
    if (!el) return;
    if (typeof el.show === 'function') el.show();
    if (typeof el.expand === 'function') el.expand();
    const parent = el.parent;
    if (parent) {
      if (typeof parent.show === 'function') parent.show();
      if (typeof parent.expand === 'function') parent.expand();
    }
  } catch (err) {
    console.warn('⚠️ showAndExpand failed for', id, err.message);
  }
}

function hideAndCollapse(id) {
  try {
    const el = $w(id);
    if (!el) return;
    if (typeof el.hide === 'function') el.hide();
    if (typeof el.collapse === 'function') el.collapse();
  } catch (err) {
    console.warn('⚠️ hideAndCollapse failed for', id, err.message);
  }
}

// ---------------------------------------------
// 2.5️⃣ Fade Text Helper
// ---------------------------------------------
function fadeUpdate($element, newText) {
  try {
    if (!$element) return;
    $element.hide('fade', { duration: 120 })
      .then(() => {
        $element.text = newText;
        $element.show('fade', { duration: 300 });
      });
  } catch (_) {
    try { $element.text = newText; } catch (_) {}
  }
}

// ---------------------------------------------
// 3️⃣ Progress Bar Logic
// ---------------------------------------------
const STEP_BOXES = ['#step1', '#step2', '#step3', '#step4'];
let currentStep = 1;
const COLOR_DONE = '#22A447';
const COLOR_ACTIVE = '#0B66FF';
const COLOR_TODO = '#E0E0E0';

function el(id) {
  try { return $w(id); } catch { return null; }
}
function paintBox(box, state) {
  if (!box || !box.style) return;
  let color = COLOR_TODO;
  if (state === 'done') color = COLOR_DONE;
  else if (state === 'active') color = COLOR_ACTIVE;
  try {
    box.hide('fade', { duration: 150 })
      .then(() => {
        box.style.backgroundColor = color;
        box.show('fade', { duration: 300 });
      });
  } catch (_) { box.style.backgroundColor = color; }
}
function bump(id) {
  const box = el(id);
  if (!box) return;
  try { box.scale = 1.05; setTimeout(() => (box.scale = 1), 150); } catch (_) {}
}
function setProgress(step) {
  currentStep = Math.max(1, Math.min(4, Number(step) || 1));
  STEP_BOXES.forEach((sel, i) => {
    const state =
      (i + 1) < currentStep ? 'done' :
      (i + 1) === currentStep ? 'active' : 'todo';
    paintBox(el(sel), state);
  });
  bump(STEP_BOXES[currentStep - 1]);
}

// ---------------------------------------------
// 4️⃣ Form Tracking
// ---------------------------------------------
const INPUT_FIELDS = ['#inputFullName', '#inputPhone', '#inputWA', '#homeAddress', '#deliveryAddress'];
function checkFormProgress() {
  const filled = INPUT_FIELDS.filter(id => {
    const val = $w(id).value;
    return typeof val === 'string' ? val.trim() : val?.formatted;
  });
  if (filled.length > 0) setProgress(2);
}

// ---------------------------------------------
// 5️⃣ OnReady
// ---------------------------------------------
$w.onReady(async function () {
  showAndExpand('#subheadingsignup');
  showAndExpand('#greetingBox');
  showAndExpand('#userEmail');

  hideAndCollapse('#SignUpBox');
  hideAndCollapse('#subscribetoPlan');
  hideAndCollapse('#VisitDash');
  hideAndCollapse('#startsignup');
  hideAndCollapse('#LogicBox');
  hideAndCollapse('#PaymentOptions'); // ✅ initially hidden
  hideAndCollapse('#MoreInfo'); // ✅ More Info section initially hidden

  const user = wixUsers.currentUser;
  if (!user.loggedIn) {
    $w('#userName').text = 'Welcome, Guest';
    $w('#EmaiuserEmaill').text = 'Please sign in to continue.';
    setProgress(1);
    return;
  }

  try {
    let userEmail = '';
    const contactId = user.id;
    try { userEmail = await user.getEmail(); }
    catch {
      console.warn('⚠️ getEmail() failed once, retrying...');
      await new Promise(r => setTimeout(r, 1000));
      try { userEmail = await user.getEmail(); } catch (_) {}
    }

    if (!userEmail) userEmail = `user_${contactId}@emergitag.me`;
    const name = await getMemberFirstName(contactId);
    const greeting = getGreeting();

    $w('#userName').text = `${greeting}, ${name || 'Member'}`;
    $w('#EmaiuserEmaill').text = `You are logged in with: ${userEmail}`;

    // --- More Info Panel Setup ---
    if ($w('#MoreInfoBtn')) {
      $w('#MoreInfoBtn').onClick(async () => {
        const section = $w('#MoreInfo');
        const btn = $w('#MoreInfoBtn');

        if (section.collapsed || !section.isVisible) {
          section.expand(); // expand layout
          await section.show('slide', { direction: 'bottom', duration: 400 });
          btn.label = 'Close Info Panel';
        } else {
          await section.hide('slide', { direction: 'bottom', duration: 400 });
          section.collapse();
          btn.label = 'More Info';
        }
      });
    }

    // Check if user email might cause payment issues
    const restrictedEmails = [
      'admin@emergitag.me','payments@emergitag.me','merchant@emergitag.me',
      'support@emergitag.me','gavin@emergitag.me','info@emergitag.me'
    ];
    const isRestrictedEmail = restrictedEmails.includes(userEmail.toLowerCase());
    
    if ($w('#inputEmail')) {
      $w('#inputEmail').value = userEmail;
      if (isRestrictedEmail) {
        $w('#inputEmail').enable();
        if ($w('#formMessage')) {
          $w('#formMessage').text = '⚠️ Notice: You may need to use a different email address for payment processing.';
          $w('#formMessage').style.color = '#ff8800';
          $w('#formMessage').expand();
        }
      } else {
        $w('#inputEmail').disable();
      }
    }

    const paymentStatus = await checkPayments(userEmail);
    const signup = paymentStatus?.signup || { found: false };
    const subscription = paymentStatus?.subscription || { found: false };

    // --- Sign-Up Logic ---
    if (signup.found) {
      showAndExpand('#SignUpBox');
      const dateTxt = signup.date ? ` on ${signup.date}` : '';
      const gwTxt = signup.gateway ? ` via ${signup.gateway}` : '';
      $w('#signUpLink').text = `✅ You signed up${dateTxt}${gwTxt}.`;
      hideAndCollapse('#startsignup');
      setProgress(3);
    } else {
      showAndExpand('#SignUpBox');
      $w('#signUpLink').html = `<p style="text-decoration:underline; color:#0b66ff; cursor:pointer;">Click here to Sign Up</p>`;
      $w('#signUpLink').onClick(() => {
        if ($w('#startsignup').collapsed) showAndExpand('#startsignup');
        else hideAndCollapse('#startsignup');
        setProgress(2);
      });
    }

    // --- Subscription Logic ---
    if (signup.found) {
      if (subscription.found) {
        showAndExpand('#subscribetoPlan');
        const planName = subscription.planName || 'Membership Plan';
        $w('#SubscribeLink').text = `💚 You are currently on the ${planName}.`;
        showAndExpand('#VisitDash');
        $w('#visitDashLink').label = 'Visit Dashboard';
        $w('#visitDashLink').onClick(() => wixLocation.to('/emergency-profiles-dashboard'));
        setProgress(4);
      } else {
        showAndExpand('#subscribetoPlan');
        $w('#SubscribeLink').html = `<p style="text-decoration:underline; color:#0b66ff; cursor:pointer;">Subscribe to a Plan</p>`;
        $w('#SubscribeLink').onClick(() => wixLocation.to('/membership-options'));
        hideAndCollapse('#VisitDash');
        setProgress(3);
      }
    }

    const anyVisible = ['#SignUpBox', '#subscribetoPlan', '#VisitDash'].some(id => $w(id).isVisible);
    if (anyVisible) showAndExpand('#LogicBox');
    else hideAndCollapse('#LogicBox');

    // --- Field Linking ---
    INPUT_FIELDS.forEach(id => {
      const field = $w(id);
      if (!field) return;
      if (typeof field.onInput === 'function') field.onInput(checkFormProgress);
      else if (typeof field.onChange === 'function') field.onChange(checkFormProgress);
    });

    // --- Checkbox and Input syncing ---
    $w('#sameAsPhoneCheckbox').onChange(() => {
      const phoneVal = $w('#inputPhone').value;
      if ($w('#sameAsPhoneCheckbox').checked) {
        $w('#inputWA').value = phoneVal;
        $w('#inputWA').disable();
      } else {
        $w('#inputWA').enable();
        $w('#inputWA').value = '';
      }
    });

    $w('#inputPhone').onInput(() => {
      if ($w('#sameAsPhoneCheckbox').checked)
        $w('#inputWA').value = $w('#inputPhone').value;
    });

    if ($w('#sameAsAddressCheckbox')) {
      $w('#sameAsAddressCheckbox').onChange(() => {
        if ($w('#sameAsAddressCheckbox').checked) {
          const homeVal = $w('#homeAddress').value;
          const formatted = typeof homeVal === 'object' ? homeVal.formatted : homeVal;
          $w('#deliveryAddress').value = { formatted };
          $w('#deliveryAddress').disable();
        } else {
          $w('#deliveryAddress').enable();
          $w('#deliveryAddress').value = { formatted: '' };
        }
      });
    }

    // --- Real-time display mirroring ---
    if ($w('#inputFullName') && $w('#displayName'))
      $w('#inputFullName').onInput(e => fadeUpdate($w('#displayName'), e.target.value.trim() || 'Your name will appear here...'));
    if ($w('#inputEmail') && $w('#displayEmail'))
      $w('#inputEmail').onInput(e => fadeUpdate($w('#displayEmail'), e.target.value.trim() || 'Your email will appear here...'));
    if ($w('#homeAddress') && $w('#displayHomeAddress'))
      $w('#homeAddress').onChange(e => {
        const val = e.target.value;
        const formatted = typeof val === 'object' ? val.formatted : val;
        fadeUpdate($w('#displayHomeAddress'), formatted || 'Home address will appear here...');
      });
    if ($w('#deliveryAddress') && $w('#displayDeliveryAddress'))
      $w('#deliveryAddress').onChange(e => {
        const val = e.target.value;
        const formatted = typeof val === 'object' ? val.formatted : val;
        fadeUpdate($w('#displayDeliveryAddress'), formatted || 'Delivery address will appear here...');
      });

    // --- Submit + Payment Buttons ---
    if ($w('#submitBtn')) $w('#submitBtn').onClick(() => handleSubmit({ setProgress }));
    if ($w('#PaystackPay')) $w('#PaystackPay').onClick(handlePaystack);

    setProgress(1);
  } catch (err) {
    console.error('⚠️ Error loading data:', err);
    hideAndCollapse('#LogicBox');
  }
});

// ---------------------------------------------
// 6️⃣ Greeting Helper
// ---------------------------------------------
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ---------------------------------------------
// 7️⃣ Form Submission + Show Payment Options
// ---------------------------------------------
async function handleSubmit({ setProgress }) {
  console.log('🟦 Submit clicked');
  if ($w('#formMessage')) $w('#formMessage').collapse();

  const fields = [
    { id: '#inputFullName', name: 'Full Name' },
    { id: '#inputEmail', name: 'Email Address' },
    { id: '#inputPhone', name: 'Phone Number' },
    { id: '#inputWA', name: 'WhatsApp Number' },
    { id: '#homeAddress', name: 'Home Address' },
    { id: '#deliveryAddress', name: 'Delivery Address' }
  ];

  let valid = true;
  fields.forEach(f => {
    const el = $w(f.id);
    if (el?.style) el.style.borderColor = '#E0E0E0';
    let v = el?.value;
    if (typeof v === 'object' && v !== null) v = v.formatted || '';
    if (!String(v).trim()) {
      valid = false;
      if (el?.style) el.style.borderColor = '#ff4d4d';
    }
  });

  if (!valid) {
    if ($w('#formMessage')) {
      $w('#formMessage').text = '⚠️ Please complete all required fields.';
      $w('#formMessage').style.color = '#ff4d4d';
      $w('#formMessage').expand();
    }
    return;
  }

  const newProfile = {
    fullName: $w('#inputFullName').value,
    emailAddress: $w('#inputEmail').value,
    signUpPhoneNumber: $w('#inputPhone').value,
    whatsAppNumber: $w('#inputWA').value,
    homeAddress: typeof $w('#homeAddress').value === 'object'
      ? $w('#homeAddress').value.formatted : $w('#homeAddress').value,
    deliveryAddress: typeof $w('#deliveryAddress').value === 'object'
      ? $w('#deliveryAddress').value.formatted : $w('#deliveryAddress').value
  };

  try {
    const savedRecord = await wixData.insert('Emergency_Profiles', newProfile);
    console.log('✅ Profile saved:', savedRecord);
    session.setItem('currentSignupRecord', JSON.stringify(savedRecord));

    hideAndCollapse('#startsignup');
    setTimeout(() => {
      showAndExpand('#PaymentOptions');
    }, 300);
    
    setProgress(3);

    if ($w('#formMessage')) {
      $w('#formMessage').text = '✅ Profile saved! Please choose your payment method below to complete registration.';
      $w('#formMessage').style.color = '#22A447';
      $w('#formMessage').expand();
    }
  } catch (err) {
    console.error('❌ Error saving profile:', err);
    if ($w('#formMessage')) {
      $w('#formMessage').text = '❌ Failed to save profile. Please try again.';
      $w('#formMessage').style.color = '#ff4d4d';
      $w('#formMessage').expand();
    }
  }
}

// ---------------------------------------------
// ✅ Paystack Payment Handler
// ---------------------------------------------
async function handlePaystack() {
  try {
    const record = JSON.parse(session.getItem('currentSignupRecord') || '{}');
    const email = record?.emailAddress || '';
    const id = record?._id || '';
    const amount = 5 * 100; // Paystack expects kobo

    const url = await payments.generatePaystackUrl({ email, id, amount });
    wixLocation.to(url);
  } catch (err) {
    console.error('💥 Paystack Error:', err);
    let errorMessage = 'Payment initialization failed. Please try again.';
    if (err.message?.includes('Invalid email')) errorMessage = '⚠️ Please provide a valid email address.';
    else if (err.message?.includes('amount')) errorMessage = '⚠️ Invalid payment amount.';
    else if (err.message?.includes('Failed to initialize')) errorMessage = '⚠️ Payment service unavailable. Please retry.';
    $w('#formMessage').text = errorMessage;
    $w('#formMessage').style.color = '#ff4d4d';
    $w('#formMessage').expand();
  }
}
