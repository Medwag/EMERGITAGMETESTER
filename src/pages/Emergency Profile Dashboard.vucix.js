// === EmergiTag Dashboard — PRODUCTION READY ===
import { sendWhatsAppTestMessage, logTestAction, sendTemplateWhatsApp } from 'backend/notify.jsw';
import { getMemberActivityLogs } from 'backend/log-service.jsw';
import { ProfileService } from 'backend/core/profile-service.jsw';
import { PaymentService } from 'backend/core/payment-service.jsw';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { generateCustomQR } from 'backend/qr-utils.jsw';
import wixData from 'wix-data';
import { sendWhatsAppAlert } from 'backend/notify.jsw';
import { fetch } from 'wix-fetch';
import wixUsers from 'wix-users';

// Lazy wrappers to avoid no-undef if modules change
const detectUserSubscriptions = async (email, userId) =>
  (await import('backend/enhanced-subscription-detector.jsw')).detectUserSubscriptions(email, userId);
const getUserSubscriptionDetails = async (userId) =>
  (await import('backend/paystack.jsw')).getUserSubscriptionDetails(userId);

// NEW: Import unified subscription manager
import { getUserSubscription, hasActiveSubscription } from 'backend/subscription-manager.jsw';

// --- Routing constants (adjust to your site URLs) ---
const SIGNUP_PAGE = '/sign-up';
const SUBSCRIBE_PAGE = '/signup-success';

// --- CMS constants ---
const COLLECTION = 'Emergency_Profiles';
const BASE_PUBLIC_URL = 'https://www.emergitag.me/emergencyview/';
const LOG_COLLECTION = 'MemberActivityLogs'; // NEW: Log collection name

// ---------- Safe element helpers ----------
function safe(id) {
    try { return $w(id); } catch (_) { return null; }
}

function safeText(id, text) {
    const el = safe(id);
    if (el) el.text = (text == null ? 'Not available' : String(text));
}

function safeShow(id) {
    const el = safe(id);
    if (!el) return;
    try {
        if (typeof el.show === 'function') el.show();
        if (typeof el.expand === 'function') el.expand();
    } catch (_) { void 0; }
}

function safeHide(id) {
    const el = safe(id);
    if (!el) return;
    try {
        if (typeof el.hide === 'function') el.hide();
        if (typeof el.collapse === 'function') el.collapse();
    } catch (_) { void 0; }
}

// ---------- UI reset ----------
function collapseAllSections() {
    [
        '#bronzeSection', '#silverSection', '#goldSection', '#petSection', '#familyPlanSection',
        '#bronzeEditModeBox', '#silverEditModeBox', '#boxGold', '#boxPet', '#boxFamily', '#newMemberBox',
        '#upgradeToSilverBox', '#upgradeToGoldBox', '#upgradeToGoldBox1',
        '#planBenefitsContainer', '#PlanDetails', '#notifySection',
        '#paystackBox', '#subscriptionDetailsBox', '#tierBadgeImage1',
        '#GoldMedication', '#ip-display', '#bronzeContentContainer',
        '#tierBadgeBox', '#activityLogContainer' // NEW: Hide the log container initially
    ].forEach(safeHide);
}

// ---------- Formatters ----------
function formatMoneyZAR(v) {
    if (v == null || isNaN(Number(v))) return 'N/A';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 })
        .format(Number(v));
}

function formatDate(d) {
    const dt = d ? new Date(d) : null;
    return dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-GB') : 'N/A';
}
// NEW: A combined date and time formatter for logs
function formatLogDateTime(d) {
    const dt = d ? new Date(d) : null;
    return dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-GB') + ' ' + dt.toLocaleTimeString('en-GB') : 'N/A';
}

// ---------- Timeout Helper ----------
const paystackTimeout = (promise, timeoutMs = 10000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Paystack timeout')), timeoutMs)
        )
    ]);
};

// ---------- Tier helpers ----------
function normalizeTier(raw) {
    // CRITICAL: Default to 'Free' for security - never give paid access without confirmation
    if (!raw) return 'Free';
    const t = String(raw).trim().toLowerCase();
    if (t.startsWith('bronze')) return 'Bronze';
    if (t.startsWith('silver')) return 'Silver';
    if (t.startsWith('gold')) return 'Gold';
    if (t.startsWith('pet')) return 'Pet';
    if (t.includes('extended') && t.includes('family')) return 'Extended Family Plan';
    if (t.includes('family')) return 'Family Plan';
    if (t.startsWith('free')) return 'Free';
    // CRITICAL: Default to 'Free' for security - never give paid access without confirmation
    return 'Free';
}
const tierBadgeUrls = {
    'Free': 'https://static.wixstatic.com/media/68f7f2_free_tier_badge~mv2.png', // Add appropriate free tier badge URL
    'Bronze': 'https://static.wixstatic.com/media/68f7f2_e7936490bae3417a8acca382ef006aa4~mv2.png',
    'Silver': 'https://static.wixstatic.com/media/68f7f2_cc8ee7ebc6f741969dac2ba2781c51d6~mv2.png',
    'Gold': 'https://static.wixstatic.com/media/68f7f2_acfb7ac10f78411b9a6d0f7c88f2a3fd~mv2.png',
    'Pet': 'https://static.wixstatic.com/media/68f7f2_74b469e003584ad1803273dd51a40ce4~mv2.png',
    'Family Plan': 'https://static.wixstatic.com/media/68f7f2_381a593035e34404b81b053452a93fd3~mv2.png',
    'Extended Family Plan': 'https://static.wixstatic.com/media/68f7f2_92647c3f4df04fee96cc603a01e0f939~mv2.png',
    'Default': 'https://static.wixstatic.com/media/68f7f2_e7936490bae3417a8acca382ef006aa4~mv2.png'
};

function updateTierBadge(profile) {
    const tierBadge = $w('#tierBadgeImage1');
    const userTier = profile.membershipTier || 'Default';
    if (tierBadge) {
        tierBadge.src = tierBadgeUrls[userTier] || tierBadgeUrls['Default'];
    } else {
        console.warn('⚠️ Missing or invalid #tierBadgeImage1 element.');
    }
}

function tierBorderColor(tier) {
    switch (tier) {
    case 'Bronze':
        return '#cd7f32';
    case 'Silver':
        return '#c0c0c0';
    case 'Gold':
        return '#ffd700';
    case 'Pet':
        return '#87ceeb';
    case 'Family Plan':
        return '#ff6347';
    case 'Extended Family Plan':
        return '#4682b4';
    default:
        return '#cccccc';
    }
}

// ---------- NEW: Subscription Tier Detection ----------
async function fetchUserSubscriptionTier(userId) {
    try {
        console.log('[Dashboard] Fetching subscription tier for user:', userId);
        
        // Check if user has active subscription
        const hasActive = await hasActiveSubscription(userId);
        
        if (!hasActive) {
            console.log('[Dashboard] No active subscription found');
            return 'Free';
        }
        
        // Get subscription details
        const subscription = await getUserSubscription(userId);
        
        if (!subscription || !subscription.tier) {
            console.log('[Dashboard] Subscription exists but no tier found');
            return 'Free';
        }
        
        // Map tier from subscription-manager to dashboard tiers
        const tierMap = {
            'basic': 'Bronze',
            'standard': 'Silver',
            'premium': 'Gold'
        };
        
        const dashboardTier = tierMap[subscription.tier.toLowerCase()] || 'Free';
        
        console.log('[Dashboard] Subscription tier:', subscription.tier, '→', dashboardTier);
        return dashboardTier;
        
    } catch (error) {
        console.error('[Dashboard] Error fetching subscription tier:', error);
        return 'Free'; // Safe fallback
    }
}

// ---------- DATA: Fetch profile (NO CREATE on client) ----------
async function fetchEmergencyProfile(ownerId) {
    try {
        const res = await wixData.query(COLLECTION)
            .eq('_owner', ownerId)
            .limit(1)
            .find();
        return res.items.length ? res.items[0] : null;
    } catch (err) {
        console.error('❌ fetchEmergencyProfile failed:', err);
        return null;
    }
}

// ---------- Log Binder (NEW FUNCTION) ----------
async function bindActivityLogs(userId) {
    if (!userId) {
        safeHide('#activityLogContainer');
        return;
    }

    try {
        safeText('#logStatusText', '⏳ Loading activity logs...');
        safeShow('#activityLogContainer');

        const logs = await getMemberActivityLogs(userId);

        const logRepeater = safe('#activityLogRepeater');
        if (logRepeater) {
            if (logs && logs.length > 0) {
                logRepeater.data = logs.map(log => ({
                    ...log,
                    _id: log._id,
                    logDate: formatLogDateTime(log.logDate), // Format the date
                    description: log.description,
                    logType: log.logType
                }));
                logRepeater.onItemReady(($item, itemData, index) => {
                    safeText('#logDateText', itemData.logDate);
                    safeText('#logTypeText', itemData.logType);
                    safeText('#logDescriptionText', itemData.description);
                });
                safeText('#logStatusText', ''); // Clear status on success
            } else {
                safeText('#logStatusText', 'No recent activity logs found.');
                logRepeater.data = [];
            }
        }
    } catch (err) {
        console.error('❌ bindActivityLogs failed:', err);
        safeText('#logStatusText', '❌ Error loading activity logs.');
        safeHide('#activityLogRepeater');
    }
}

// ---------- Enhanced Paystack binder using enhanced-subscription-detector ----------
async function bindPaystackSubscription(userId) {
    if (!userId) { 
        safeHide('#paystackBox'); 
        return; 
    }
    
    try {
        console.log('[bindPaystackSubscription] Fetching subscription for userId:', userId);
        
        // Get current user to access email
        const currentUser = wixUsers.currentUser;
        if (!currentUser || !currentUser.loggedIn) {
            console.log('[bindPaystackSubscription] User not logged in');
            safeHide('#paystackBox');
            return;
        }
        
        const userEmail = currentUser.email;
        console.log('[bindPaystackSubscription] Using email:', userEmail);
        
        // Use enhanced subscription detector
        const result = await detectUserSubscriptions(userEmail, userId);
        console.log('[bindPaystackSubscription] Enhanced detection result:', result);
        
        if (!result.success || !result.data || !result.data.selectedSubscription) {
            console.log('[bindPaystackSubscription] No active subscription found');
            safeHide('#paystackBox');
            return;
        }

        const subscription = result.data.selectedSubscription;
        const profile = result.data.profile;
        
        safeShow('#paystackBox');
        
        // Display subscription details
        safeText('#paystackPlanText', subscription.plan?.name || 'N/A');
        safeText('#paystackStatus', subscription.status || 'N/A');
        safeText('#paystackStartDate', formatDate(subscription.createdAt));
        safeText('#paystackExpiryDate', formatDate(subscription.next_payment_date));

        // Display payment information
        const amount = subscription.amount ? (subscription.amount / 100) : 0; // Convert kobo to ZAR
        safeText('#lastPaymentDate', formatDate(subscription.createdAt));
        safeText('#lastPaymentAmount', formatMoneyZAR(amount));
        safeText('#nextPaymentDate', formatDate(subscription.next_payment_date));
        safeText('#nextPaymentAmount', formatMoneyZAR(amount));
        
        // Log successful binding
        console.log('[bindPaystackSubscription] Successfully bound subscription:', {
            plan: subscription.plan?.name,
            status: subscription.status,
            amount: amount
        });
        
    } catch (err) {
        console.error('❌ bindPaystackSubscription failed:', err);
        safeHide('#paystackBox');
    }
}
// === Consent Toggle Binder with Date + Numbers Support ===
/**
 * checkboxId      → the toggle switch element ID
 * booleanField    → the CMS field storing true/false
 * dateField       → the CMS field storing the date of consent
 * numberFieldIds  → array of input element IDs for numbers associated with this consent
 * textElementId   → the UI element to display numbers + date
 * profile         → the CMS profile object
 */
// === Consent Toggle Binder with Date + Numbers Support (auto-prefill + clean UI) ===
function bindConsentToggleWithNumbers(
    checkboxId,
    booleanField,
    dateField,
    textElementId,
    profile,
    numberFieldIds = [],
    numberCmsFields = []
) {
    const $checkbox = safe(checkboxId);
    if (!$checkbox) {
        console.warn(`⚠️ Missing element ${checkboxId}`);
        if (textElementId) {
            const $text = safe(textElementId);
            if ($text) $text.text = `Error: Missing element ${checkboxId}`;
        }
        return;
    }
    if (typeof $checkbox.onChange !== 'function') {
        console.error(`❌ Element ${checkboxId} does not support onChange. Actual type:`, $checkbox.type || typeof $checkbox);
        if (textElementId) {
            const $text = safe(textElementId);
            if ($text) $text.text = `Error: Element ${checkboxId} is not a checkbox or switch.`;
        }
        return;
    }

    // === Initial state from profile ===
    const currentValue = profile[booleanField] || false;
    $checkbox.checked = currentValue;

    // Prefill number inputs from CMS
    numberFieldIds.forEach((id, idx) => {
        const $input = safe(id);
        if ($input && numberCmsFields[idx]) {
            $input.value = profile[numberCmsFields[idx]] || "";
        }
    });

    // Build consent info string
    const consentDate = profile[dateField] ? new Date(profile[dateField]) : null;
    let consentInfo = currentValue && consentDate ?
        `✅ Consent given on ${consentDate.toLocaleString()}` :
        "❌ Not consented";

    if (numberFieldIds.length && currentValue) {
        numberFieldIds.forEach((id, idx) => {
            const $input = safe(id);
            const numberValue = $input?.value || profile[numberCmsFields[idx]] || "";
            if (numberValue) {
                consentInfo += `\n📞 ${maskNumber(numberValue)}`;
            }
        });
    }

    if (textElementId) {
        const $text = safe(textElementId);
        if ($text) $text.text = consentInfo;
    }

    // === Change handler for checkbox ===
    $checkbox.onChange(async () => {
        const checked = $checkbox.checked;
        const update = {
            _id: profile._id,
            [booleanField]: checked,
            [dateField]: checked ? new Date() : null
        };

        // Save numbers directly into CMS fields
        numberFieldIds.forEach((id, idx) => {
            const $input = safe(id);
            if ($input && numberCmsFields[idx]) {
                update[numberCmsFields[idx]] = $input.value;
            }
        });

        try {
            const saved = await wixData.update("Emergency_Profiles", update);
            console.log(`✅ Consent + numbers saved for ${booleanField}`);

            // Update UI text
            let msg = checked ?
                `✅ Consent given on ${new Date().toLocaleString()}` :
                "❌ Not consented";

            numberCmsFields.forEach((cmsField) => {
                const num = saved[cmsField];
                if (num) msg += `\n📞 ${maskNumber(num)}`;
            });

            if (textElementId) {
                const $text = safe(textElementId);
                if ($text) $text.text = msg;
            }

        } catch (err) {
            console.error(`❌ Failed to save consent + numbers for ${booleanField}`, err);
        }
    });

    // === Optional: live save when numbers are typed ===
    numberFieldIds.forEach((id, idx) => {
        const $input = safe(id);
        if ($input && numberCmsFields[idx]) {
            $input.onChange(async () => {
                const update = {
                    _id: profile._id,
                    [numberCmsFields[idx]]: $input.value
                };
                try {
                    const saved = await wixData.update("Emergency_Profiles", update);
                    console.log(`📞 Number saved for ${numberCmsFields[idx]}`);

                    // Refresh text element
                    if (textElementId && $checkbox.checked) {
                        const $text = safe(textElementId);
                        if ($text) {
                            $text.text = `✅ Consent given on ${new Date(saved[dateField] || Date.now()).toLocaleString()}`;
                            numberCmsFields.forEach((cmsField) => {
                                const num = saved[cmsField];
                                if (num) $text.text += `\n📞 ${maskNumber(num)}`;
                            });
                        }
                    }
                } catch (err) {
                    console.error(`❌ Failed to save number for ${numberCmsFields[idx]}`, err);
                }
            });
        }
    });
}

// === Simple Consent Toggle Binder (date only, no numbers) ===
function bindConsentToggle(checkboxId, booleanField, dateField, textElementId, profile) {
    const $checkbox = safe(checkboxId);
    if (!$checkbox) return;
    if (typeof $checkbox.onChange !== 'function') {
        console.error(`❌ Element ${checkboxId} does not support onChange. Check that it is a checkbox or switch.`);
        return;
    }

    const currentValue = profile[booleanField] || false;
    $checkbox.checked = currentValue;

    const consentDate = profile[dateField] ? new Date(profile[dateField]) : null;
    const consentInfo = currentValue && consentDate ?
        `✅ Consent given on ${consentDate.toLocaleString()}` :
        "❌ Not consented";

    if (textElementId) {
        const $text = safe(textElementId);
        if ($text) $text.text = consentInfo;
    }

    $checkbox.onChange(async () => {
        const checked = $checkbox.checked;
        const update = {
            _id: profile._id,
            [booleanField]: checked,
            [dateField]: checked ? new Date() : null
        };

        try {
            const saved = await wixData.update("Emergency_Profiles", update);
            console.log(`✅ Consent saved for ${booleanField}`);

            if (textElementId) {
                const $text = safe(textElementId);
                if ($text) {
                    $text.text = checked ?
                        `✅ Consent given on ${new Date(saved[dateField]).toLocaleString()}` :
                        "❌ Not consented";
                }
            }
        } catch (err) {
            console.error(`❌ Failed to save consent for ${booleanField}`, err);
        }
    });
}

// === Masking helper ===
function maskNumber(num = "") {
    if (num.length < 5) return num;
    return num.slice(0, 3) + "*****" + num.slice(-2);
}

// ---------- Dashboard binder ----------
async function bindDashboardData(profile, userEmail) {
    try {
        const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.fullName || '';
        safeText('#fullName', fullName || 'Not available');
        safeText('#emailText', userEmail || profile.email || profile.emailAddress || 'Not available');
        safeText('#phoneText', profile.phone);
        safeText('#addressText', profile.address);

        const lastUpdatedDate = profile.lastUpdated ? new Date(profile.lastUpdated) : null;
        safeText('#lastUpdatedText', `Last Updated: ${formatDate(lastUpdatedDate)}`);

        // Public link
        if (profile.publicViewId) {
            const publicUrl = `${BASE_PUBLIC_URL}${profile.publicViewId}`;

            // Display URL as button label
            $w('#publicViewLink').label = publicUrl;

            // Make button clickable
            $w('#publicViewLink').onClick(() => wixLocation.to(publicUrl));

            const copyBtn = safe('#CopyLink');
            if (copyBtn) {
                copyBtn.show();
                copyBtn.onClick(() =>
                    wixWindow.copyToClipboard(publicUrl)
                    .then(() => wixWindow.openLightbox('Copied'))
                    .catch(() => wixWindow.openLightbox('Alert', { message: '❌ Could not copy to clipboard. Please copy manually.' }))
                );
            }
        }

        // Tier & badge - Enhanced with subscription-manager (SECURE: Only assign paid tiers with confirmed subscription)
        let rawTier = (profile.membershipTier ?? '').trim();
        let tier = 'Free'; // Safe default
        
        // NEW: Fetch tier from subscription-manager FIRST
        try {
            console.log('[bindDashboardData] Fetching tier from subscription-manager...');
            const subscriptionTier = await fetchUserSubscriptionTier(profile._owner);
            tier = subscriptionTier;
            console.log('[bindDashboardData] Using tier from subscription-manager:', tier);
            
            // Update profile tier if different (keep profile in sync)
            if (profile.membershipTier !== tier) {
                console.log('[bindDashboardData] Syncing profile tier:', profile.membershipTier, '→', tier);
                try {
                    await wixData.update(COLLECTION, {
                        _id: profile._id,
                        membershipTier: tier,
                        lastUpdated: new Date()
                    });
                    profile.membershipTier = tier;
                    console.log('[bindDashboardData] Profile tier synced successfully');
                } catch (syncErr) {
                    console.warn('[bindDashboardData] Could not sync profile tier:', syncErr);
                }
            }
        } catch (subscriptionErr) {
            console.warn('[bindDashboardData] Could not fetch tier from subscription-manager, falling back to Paystack:', subscriptionErr);
            
            // Fallback: Try to get from Paystack (legacy support)
            if (!rawTier || rawTier === 'undefined' || rawTier === 'null') {
                console.log('[bindDashboardData] membershipTier is missing, attempting to fetch from Paystack...');
                try {
                    console.log('[bindDashboardData] Starting Paystack tier fetch with 8s timeout...');
                    const paystackDetails = await paystackTimeout(
                        getUserSubscriptionDetails(profile._owner),
                        8000 // 8 second timeout for tier fetch
                    );
                    if (paystackDetails && !paystackDetails.error && paystackDetails.planName) {
                        // SECURITY CHECK: Only assign if subscription is active
                        if (paystackDetails.status === 'active' && paystackDetails.planName) {
                            rawTier = paystackDetails.planName;
                            console.log('[bindDashboardData] Got ACTIVE plan name from Paystack:', rawTier);
                            
                            // Update the profile with the correct tier
                            try {
                                console.log('[bindDashboardData] Updating profile tier from Paystack data...');
                                await wixData.update('Emergency_Profiles', {
                                    _id: profile._id,
                                    membershipTier: rawTier,
                                    lastUpdated: new Date() // Add timestamp
                                });
                                profile.membershipTier = rawTier;
                                console.log('[bindDashboardData] Updated profile with correct tier');
                            } catch (updateErr) {
                                console.warn('[bindDashboardData] Failed to update profile tier:', updateErr);
                                // Don't fail the whole dashboard if profile update fails
                            }
                        } else {
                            console.log('[bindDashboardData] Paystack subscription is not active or missing plan name, defaulting to Free');
                            rawTier = 'Free'; // Explicit free tier for inactive subscriptions
                        }
                    } else {
                        console.log('[bindDashboardData] No valid Paystack subscription found, defaulting to Free');
                        rawTier = 'Free'; // Explicit free tier when no subscription found
                    }
                } catch (paystackErr) {
                    console.warn('[bindDashboardData] Could not fetch tier from Paystack (timeout or error), defaulting to Free:', paystackErr.message);
                    rawTier = 'Free'; // Explicit free tier on error or timeout
                }
            }
            
            // Use normalized tier from fallback
            tier = normalizeTier(rawTier);
        }
        
        console.log('[bindDashboardData] Final tier used:', tier, '(from raw:', rawTier, ')');
        safeText('#currentPlanText', tier);
        safeText('#membershipTier', tier);

        const badgeUrl = tierBadgeUrls[tier] || tierBadgeUrls['Default'];
        const badgeImg = safe('#tierBadgeImage1');
        if (badgeImg && typeof badgeImg.src !== 'undefined') {
            badgeImg.src = badgeUrl;
        } else {
            console.warn('⚠️ Missing or invalid #tierBadgeImage1 element.');
        }
        safeShow('#tierBadgeBox');

        // Member since / duration
        const since = profile.createdAt ? new Date(profile.createdAt) : null;
        if (since && !isNaN(since.getTime())) {
            safeText('#membersinceText', `Member since: ${formatDate(since)}`);
            const days = Math.floor((Date.now() - since.getTime()) / 86400000);
            safeText('#Membershipduration', `You have been a member for ${days} days`);
        } else {
            safeText('#membersinceText', 'Member since: Unknown');
            safeText('#Membershipduration', '');
        }
        safeText('#Member', profile.fullName);

        // Emergency / medical fields (bind only if elements exist)
        safeText('#emergencycontact', profile.emergencyContact);
        safeText('#EmergencyContactRelationship', profile.relationship);
        safeText('#EmergencyContactNumber', profile.emergencyContactPrimaryNumber);
        safeText('#EmergencyContactNumber2', profile.emergencyContactAltNumber);
        safeText('#allergiesinfo', profile.allergies);
        safeText('#bloodgroup', profile.bloodTypeField);
        safeText('#Medinfo', profile.medicalInfo);
        safeText('#Medaidname', profile.medicalAidDetailsName);
        safeText('#Medaidnumber', profile.medicalAidDetailsNumber);
        safeText('#Medaidmainmember', profile.medAidMainMember);
        safeText('#Medaidplan', profile.medicalAidDetailsOption);
        safeText('#Medaiddepcode', profile.medicalAidDetailsDependantcode);
        safeText('#medicalDoctor', profile.medicalDoctorName);
        safeText('#medicalSpecialist', profile.medicalSpecialist);

        // Additional emergency contacts
        safeText('#AddEmergencyContactName', profile.secondaryContact);
        safeText('#AddRelationship', profile.alternativeContactRelationship);
        safeText('#AddEmergencyContactNo', profile.secondaryContactPrimaryNumber);
        safeText('#AddEmergencyAltContactno', profile.secondaryContactPrimaryNumber1);

        // Doctor & specialists
        safeText('#DoctorName', profile.homeGp);
        safeText('#DoctorContactNumber', profile.gpNumber);
        safeText('#DoctorEmergencyContactNumber', profile.doctorsEmergencyNumber);

        safeText('#1SpecialistsName', profile.specialist);
        safeText('#1SpecialistsNumber', profile.specialistNumber);
        safeText('#1SpecialistType', profile.speciality01);

        safeText('#2SpecialistsName', profile.specialist1);
        safeText('#2SpecialistsNumber', profile.specialistNumber2);
        safeText('#2SpecialistType', profile.speciality02);

        safeText('#3SpecialistsName', profile.specialist11);
        safeText('#3SpecialistsNumber', profile.specialistNumber11);
        safeText('#3SpecialistType', profile.speciality021);

        // Medication table for Gold
        const medTable = safe('#medicationTable');
        if (medTable && tier === 'Gold') {
            const rows = [];
            for (let i = 1; i <= 10; i++) {
                const n = i.toString().padStart(2, '0');
                const nameKey = `Med${n}Name`;
                if (profile[nameKey]) {
                    rows.push({
                        _id: `row-${i}`,
                        medication: profile[nameKey],
                        dose: profile[`Med${n}Dose`],
                        frequency: profile[`Med${n}Frequency`]
                    });
                }
            }
            medTable.rows = rows;
            rows.length ? safeShow('#GoldMedication') : safeHide('#GoldMedication');
        } else {
            safeHide('#GoldMedication');
        }

        // Tier sections show/hide
        switch (tier) {
        case 'Gold':
            safeShow('#bronzeSection');
            safeShow('#bronzeContentContainer');
            safeShow('#bronzeEditModeBox');
            safeShow('#silverSection');
            safeShow('#silverEditModeBox');
            safeShow('#notifySection');
            safeShow('#goldSection');
            safeShow('#boxGold');
            safeShow('#GoldMedication');
            safeHide('#upgradeToSilverBox');
            safeHide('#upgradeToGoldBox');
            safeHide('#upgradeToGoldBox1');
            break;
        case 'Silver':
            safeShow('#bronzeSection');
            safeShow('#bronzeContentContainer');
            safeShow('#bronzeEditModeBox');
            safeShow('#silverSection');
            safeShow('#silverEditModeBox');
            safeShow('#notifySection');
            safeShow('#upgradeToGoldBox');
            safeShow('#upgradeToGoldBox1');
            break;
        case 'Bronze':
            safeShow('#bronzeSection');
            safeShow('#bronzeContentContainer');
            safeShow('#bronzeEditModeBox');
            safeShow('#upgradeToSilverBox');
            safeShow('#upgradeToGoldBox');
            break;
        case 'Pet':
            safeShow('#petSection');
            safeShow('#boxPet');
            break;
        case 'Family Plan':
        case 'Extended Family Plan':
            safeShow('#familyPlanSection');
            safeShow('#newMemberBox');
            break;
        }

        // Plan details (optional)
        try {
            const planRes = await wixData.query('PlanOptions')
                .or(
                    wixData.query('PlanOptions').eq('title', tier),
                    wixData.query('PlanOptions').eq('planTier', tier),
                    wixData.query('PlanOptions').eq('planName', tier),
                    wixData.query('PlanOptions').eq('tierName', tier)
                )
                .limit(1)
                .find();
            if (planRes.items.length > 0) {
                safeText('#planBenefitsText', planRes.items[0].description || '');
                safeShow('#PlanDetails');
                safeShow('#planBenefitsContainer');
            } else {
                safeText('#planBenefitsText', 'No plan details available.');
            }
        } catch (e) {
            console.error('PlanOptions query failed:', e);
        }

        // Upgrade tooltip
        const tipBox = safe('#upgradeTooltipBox');
        const tipIcon = safe('#upgradeTooltipIcon');
        if (tipBox && tipIcon) {
            tipBox.hide();
            const upgradeMessage =
                tier === 'Bronze' ? 'Your plan can be upgraded to Silver or Gold' :
                tier === 'Silver' ? 'You can upgrade to Gold' :
                tier === 'Gold' ? 'You are on the highest plan' :
                'Plan information unavailable';
            safeText('#upgradeTooltipText', `You are on the ${tier} Plan. ${upgradeMessage}`);
            tipIcon.onMouseIn(() => tipBox.show());
            tipIcon.onMouseOut(() => tipBox.hide());
        }

        const isActive = profile.isPublic;
        if (isActive) {
            safeText("#statusText", "Active");
            safe('#statusText').style.color = "green";
        } else {
            safeText("#statusText", "Inactive");
            safe('#statusText').style.color = "red";
        }
    } catch (err) {
        console.error('❌ bindDashboardData failed:', err);
    }
}
// 4) Consent switch binder (declare before use to be clear)
// -----------------------------
// (I left your binder implementation as-is elsewhere; just ensure this function exists)
function bindConsentSwitches(profile) {
    // 1. General Notifications (Administrative)
    // Defensive Consent Binder for Terms and Conditions
    bindConsentToggle(
        "#termsandConditionsSwitch",
        "termsandConditions",
        "termsAcceptedDate",
        "#termsAcceptedDateText",
        profile
    );

    // Defensive Consent Binder for Email Communication
    bindConsentToggle(
        "#emailNotify",
        "emailNotificationConsent",
        "emailNotificationConsentDate",
        "#emailAcceptDate",
        profile
    );

    // Defensive Consent Binder for WhatsApp General Notification
    bindConsentToggle(
        "#whatsappConsent",
        "waConsent",
        "waConsentDate",
        "#whatsappNotifyDate",
        profile
    );

    // Defensive Consent Binder for WhatsApp Public Profile View (with numbers)
    bindConsentToggleWithNumbers(
        "#whatsappConsent",
        "receiveNotifications",
        "whatsAppProfileViewConsentDate",
        "#WANotification",
        profile,
        ["#whatsappPhoneInputPrimary", "#whatsappPhoneInputAdditional"],
        ["whatsappPhoneInputPrimary", "whatsappPhoneInputAdditional"]
    );

    // Defensive Consent Binder for WhatsApp Profile Retrieval
    bindConsentToggle(
        "#waProfileRetrievalConsent",
        "waProfileRetrievalConsent",
        "waProfileRetrievalConsentDate",
        "#waProfileRetrievalDateText",
        profile
    );
}

// === Main (paywalled) ===
$w.onReady(async () => {
    console.log('🚀 Dashboard loading... [$w.onReady called]');
    try {
        console.log('Checking collapseAllSections...');
        collapseAllSections();
        console.log('collapseAllSections complete.');
    } catch (err) {
        console.error('❌ collapseAllSections failed:', err);
    }
    // show spinner/overlay immediately
    safeShow('#loadingSpinner');
    $w("#loadingOverlay1").show();


$w.onReady(async () => {
  console.log('🚀 Dashboard loading... [$w.onReady called]');

  // ============================================================
  // 🔒 ACCESS GUARD: Block unauthorized users early
  // ============================================================
  const user = wixUsers.currentUser;
  if (!user.loggedIn) {
    console.warn('🚫 Access denied: User not logged in.');
    wixLocation.to('/sign-up-page');
    return;
  }

  try {
    const profile = await ProfileService.getOrCreateProfile(user.id);
    if (!profile?.signUpPaid) {
      console.warn('🚫 Access denied: Sign-up fee not paid.');
      wixLocation.to('/sign-up-page');
      return;
    }

    if (!profile?.subscriptionActive) {
      console.warn('🚫 Access denied: No active subscription.');
      wixLocation.to('/signup-success'); // redirect to plan selection
      return;
    }

    console.log(`✅ Authorized dashboard access for ${profile.email}`);
  } catch (err) {
    console.error('❌ Access guard error:', err);
    wixLocation.to('/sign-up-page');
    return;
  }

  // ============================================================
  // (Continue with your main initialization logic below)
  // ============================================================

  try {
    console.log('Checking collapseAllSections...');
    collapseAllSections();
    console.log('collapseAllSections complete.');
    ...


    // Hold interval id so we can clear it in finally
    let autoRefreshId = null;

    try {
        // -----------------------------
        // 0) Basic UI collapse
        // -----------------------------
        collapseAllSections();

        // -----------------------------
        // 1) Current user check (single canonical user variable)
        // -----------------------------
        const currentUser = wixUsers.currentUser;
        console.log('Current user:', currentUser);
        if (!currentUser.loggedIn) {
            console.warn('User not logged in. Redirecting to signup.');
            await wixWindow.openLightbox('Alert', { message: '⚠️ Please sign up or log in.' });
            return wixLocation.to(SIGNUP_PAGE);
        }

        // -----------------------------
        // 2) Get user email (non-fatal)
        // -----------------------------
        let userEmail = '';
        try {
            userEmail = await currentUser.getEmail();
            console.log('User email:', userEmail);
            safeText('#userEmailText', `You are logged in with email: ${userEmail}`);
            safeShow('#userEmailText');
        } catch (err) {
            console.warn('Could not read user email:', err);
            safeText('#userEmailText', 'Unable to fetch email address.');
            safeShow('#userEmailText');
        }

        // -----------------------------
        // 3) Fetch profile using reliable service
        // -----------------------------
        console.log('✅ [Dashboard] Getting profile with ProfileService for user:', currentUser.id);
        const profile = await ProfileService.getOrCreateProfile(currentUser.id);
        console.log('✅ [Dashboard] Profile loaded:', {
            id: profile._id,
            signUpPaid: profile.signUpPaid,
            subscriptionActive: profile.subscriptionActive,
            membershipTier: profile.membershipTier,
            userState: ProfileService.getUserState(profile)
        });
        
        if (!profile) {
            console.error('❌ [Dashboard] Failed to get/create profile. Critical error.');
            await wixWindow.openLightbox('Alert', { message: '⚠️ System error. Please contact support.' });
            return;
        }

        // -----------------------------
        // CRITICAL: Payment Provider as Source of Truth - Comprehensive payment verification and sync
        // -----------------------------
        
        let accessGranted = false;
        let accessDenialReason = '';
        
        console.log('✅ [Dashboard] Starting PRODUCTION READY payment verification with PaymentService');
        console.log(`[Dashboard] Current profile status - SignUp: ${profile.signUpPaid}, Subscription: ${profile.subscriptionActive}, Tier: ${profile.membershipTier}`);
        
        // STEP 1: Comprehensive signup payment verification (Payment Provider = Source of Truth)
        let signupPaymentConfirmed = false;
        try {
            console.log('[Dashboard] Checking signup payment in payment providers...');
            const { detectSignupPayment } = await import('backend/signup-payment-detector-dual.jsw');
            const signupResult = await detectSignupPayment(currentUser.id, {
                includePartialMatches: true,
                timeWindow: 90
            });
            
            if (signupResult.success && signupResult.paymentDetected && signupResult.confidence >= 70) {
                console.log(`✅ [Dashboard] Found signup payment via ${signupResult.provider} - confidence: ${signupResult.confidence}%`);
                signupPaymentConfirmed = true;
                
                // Sync to CMS if not already there
                if (!profile.signUpPaid) {
                    console.log('[Dashboard] Syncing signup payment from payment provider to CMS...');
                    try {
                        await wixData.update('Emergency_Profiles', {
                            _id: profile._id,
                            signUpPaid: true,
                            signUpReference: signupResult.paymentReference,
                            paymentProvider: signupResult.provider,
                            joinedDate: signupResult.paymentDate || new Date()
                        });
                        profile.signUpPaid = true;
                        console.log('✅ [Dashboard] Synced signup payment to Emergency_Profiles CMS');
                    } catch (syncError) {
                        console.warn('[Dashboard] Failed to sync signup payment to CMS:', syncError);
                    }
                }
            } else {
                console.log('[Dashboard] No signup payment found in payment providers');
                signupPaymentConfirmed = false;
            }
        } catch (signupError) {
            console.error('❌ [Dashboard] Signup payment detection failed:', signupError);
            // Fallback to CMS data if payment provider check fails
            signupPaymentConfirmed = profile.signUpPaid || false;
            console.log(`[Dashboard] Using CMS signup status as fallback: ${signupPaymentConfirmed}`);
        }
        
        // STEP 2: Comprehensive subscription verification (Payment Provider = Source of Truth)
        let subscriptionActive = false;
        let membershipTier = null;
        let subscriptionDetails = null;
        
        try {
            console.log('[Dashboard] Checking subscription in payment providers...');
            const { detectUserSubscriptions } = await import('backend/enhanced-subscription-detector.jsw');
            const subscriptionResult = await detectUserSubscriptions(userEmail, currentUser.id);
            
            console.log('[Dashboard] Subscription detection result:', subscriptionResult);
            
            if (subscriptionResult.success && subscriptionResult.data?.selectedSubscription) {
                const subscription = subscriptionResult.data.selectedSubscription;
                
                if (subscription.status === 'active') {
                    subscriptionActive = true;
                    membershipTier = subscription.plan?.name || subscription.plan?.planName || null;
                    subscriptionDetails = subscription;
                    
                    console.log(`✅ [Dashboard] Found ACTIVE subscription in payment provider: ${membershipTier} (${subscription.status})`);
                    
                    // Sync to CMS if data doesn't match
                    const cmsNeedsUpdate = (
                        !profile.subscriptionActive || 
                        !profile.membershipTier || 
                        profile.membershipTier !== membershipTier ||
                        profile.membershipTier === 'Free' ||
                        profile.membershipTier === 'undefined' ||
                        profile.membershipTier === 'null'
                    );
                    
                    if (cmsNeedsUpdate) {
                        console.log('[Dashboard] Syncing subscription data from payment provider to CMS...');
                        console.log(`[Dashboard] CMS Update needed - Current: ${profile.membershipTier} -> New: ${membershipTier}`);
                        try {
                            const updateData = {
                                _id: profile._id,
                                subscriptionActive: true,
                                membershipTier: membershipTier,
                                planStatus: 'active',
                                paystackSubscriptionCode: subscription.subscription_code || profile.paystackSubscriptionCode,
                                paystackCustomerCode: subscription.customer?.customer_code || profile.paystackCustomerCode,
                                lastPaymentDate: subscription.createdAt ? new Date(subscription.createdAt) : null,
                                nextPaymentDate: subscription.next_payment_date ? new Date(subscription.next_payment_date) : null
                            };
                            
                            await wixData.update('Emergency_Profiles', updateData);
                            
                            // Update local profile reference
                            Object.assign(profile, updateData);
                            
                            console.log('✅ [Dashboard] Synced subscription data to Emergency_Profiles CMS:', {
                                tier: membershipTier,
                                active: true,
                                subscriptionCode: subscription.subscription_code
                            });
                        } catch (syncError) {
                            console.warn('[Dashboard] Failed to sync subscription data to CMS:', syncError);
                        }
                    } else {
                        console.log('[Dashboard] CMS subscription data is up to date');
                    }
                } else {
                    console.log(`⚠️ [Dashboard] Found subscription in payment provider but status is: ${subscription.status} (not active)`);
                    subscriptionActive = false;
                    membershipTier = null;
                }
            } else {
                console.log('[Dashboard] No active subscription found in payment providers');
                subscriptionActive = false;
                membershipTier = null;
            }
        } catch (subscriptionError) {
            console.error('❌ [Dashboard] Subscription detection failed:', subscriptionError);
            // Fallback to CMS data if payment provider check fails
            subscriptionActive = profile.subscriptionActive || false;
            membershipTier = profile.membershipTier || null;
            
            if (subscriptionActive && membershipTier && membershipTier !== 'Free') {
                console.log(`[Dashboard] Using CMS subscription data as fallback: ${membershipTier} (${subscriptionActive})`);
            }
        }

        console.log('[Dashboard] Final verification status:', {
            signupPaymentConfirmed,
            subscriptionActive,
            membershipTier: membershipTier || 'None'
        });

        // STEP 3: Access control based on comprehensive verification
        if (signupPaymentConfirmed && subscriptionActive && membershipTier && membershipTier !== 'Free') {
            console.log('✅ [Dashboard] ACCESS GRANTED: Both payments confirmed in payment providers');
            accessGranted = true;
        } else if (!signupPaymentConfirmed) {
            accessDenialReason = 'signup';
        } else if (!subscriptionActive || !membershipTier || membershipTier === 'Free') {
            accessDenialReason = 'subscription';
        }
        
        // Enforce access control
        if (!accessGranted) {
            if (accessDenialReason === 'signup') {
                console.warn('[Dashboard] ACCESS DENIED: No signup payment found');
                await wixWindow.openLightbox('Alert', { 
                    message: '🚫 Access Denied\n\nSignup payment required to access your dashboard.\n\nPlease complete your signup payment first.' 
                });
                wixLocation.to(SIGNUP_PAGE);
                return;
            } else if (accessDenialReason === 'subscription') {
                console.warn('[Dashboard] ACCESS DENIED: No active subscription found');
                await wixWindow.openLightbox('Alert', { 
                    message: '🚫 Access Denied\n\nActive subscription required to access your dashboard.\n\nPlease subscribe to a plan to continue.' 
                });
                wixLocation.to(SUBSCRIBE_PAGE);
                return;
            }
        }

        console.log('✅ [Dashboard] ACCESS GRANTED: User has verified payments and active subscription');

            // --- Double-check subscription status with timeout ---
            let cmsActive = !!profile.subscriptionActive;
            let paystackActive = false;
            let paystackStatus = null;
            let paystackDetails = null;
            console.log('[Diagnostics] CMS subscriptionActive:', profile.subscriptionActive, 'PaystackSubscriptionCode:', profile.paystackSubscriptionCode);
            
            try {
                console.log('[Diagnostics] Starting Paystack subscription check with 10s timeout...');
                paystackDetails = await paystackTimeout(
                    import('backend/paystack.jsw').then(m => m.getUserSubscriptionDetails(currentUser.id))
                );
                paystackStatus = paystackDetails?.status;
                paystackActive = paystackStatus === 'active';
                console.log('[Diagnostics] Paystack subscription details:', paystackDetails);
            } catch (err) {
                console.warn('[Diagnostics] Paystack subscription check failed or timed out:', err.message);
                // Continue with dashboard loading even if Paystack check fails
            }

            // If missing subscription code or no active subscription, attempt recovery
            if ((!profile.paystackSubscriptionCode || !paystackActive) && userEmail) {
                console.log('[Recovery] Attempting Paystack subscription recovery for:', userEmail);
                try {
                    console.log('[Recovery] Starting recovery with 15s timeout...');
                    const recoveryResult = await paystackTimeout(
                        import('backend/paystackRecoveryAndSync.jsw').then(m => m.recoverAndSyncPaystackSubscription(userEmail)),
                        15000 // 15 second timeout for recovery
                    );
                    console.log('[Recovery] Result:', recoveryResult);
                    
                    // Re-fetch profile and Paystack status after recovery
                    console.log('[Recovery] Refreshing profile data...');
                    const refreshedProfile = await fetchEmergencyProfile(currentUser.id);
                    cmsActive = !!refreshedProfile.subscriptionActive;
                    
                    // Update profile reference for further use
                    Object.assign(profile, refreshedProfile);
                    
                    console.log('[Recovery] Re-checking Paystack status with timeout...');
                    paystackDetails = await paystackTimeout(
                        import('backend/paystack.jsw').then(m => m.getUserSubscriptionDetails(currentUser.id))
                    );
                    paystackStatus = paystackDetails?.status;
                    paystackActive = paystackStatus === 'active';
                    console.log('[Diagnostics] Post-recovery CMS:', refreshedProfile.subscriptionActive, 'Paystack:', paystackDetails);
                } catch (err) {
                    console.warn('[Recovery] Paystack recovery failed or timed out:', err.message);
                    // Continue with dashboard loading even if recovery fails
                }
            }

            if (paystackActive && !cmsActive) {
                try {
                    await wixData.update('Emergency_Profiles', {
                        _id: profile._id,
                        subscriptionActive: true
                    });
                    cmsActive = true;
                    console.log('[Diagnostics] CMS subscriptionActive updated to true based on Paystack.');
                } catch (err) {
                    console.error('[Diagnostics] Failed to update CMS subscriptionActive:', err);
                }
            }

            if (cmsActive && !paystackActive) {
                console.warn('[Diagnostics] CMS shows active, Paystack does not. CMS:', profile.subscriptionActive, 'Paystack:', paystackDetails);
                
                // Try auto-fix first with enhanced error handling
                try {
                    console.log('[AutoFix] Attempting to fix subscription sync issue...');
                    
                    // Add timeout and additional error handling for the autofix
                    const autoFixPromise = import('backend/subscription-sync-diagnostics.jsw')
                        .then(module => module.autoFixSubscriptionSync(currentUser.id));
                    
                    const fixResult = await paystackTimeout(autoFixPromise, 5000); // 5 second timeout
                    
                    if (fixResult && fixResult.success) {
                        console.log('[AutoFix] Successfully fixed sync issue:', fixResult);
                        // Show success message and refresh
                        await wixWindow.openLightbox('Alert', {
                            message: `✅ Subscription Sync Fixed!\n\n${fixResult.fixes.join('\n')}\n\nRefreshing dashboard...`
                        });
                        wixLocation.to(wixLocation.url);
                        return;
                    } else {
                        console.log('[AutoFix] Auto-fix failed or returned no result:', fixResult);
                    }
                } catch (autoFixErr) {
                    console.error('[AutoFix] Auto-fix attempt failed:', autoFixErr.message || autoFixErr);
                    // Don't let autofix errors break the flow - continue to manual diagnostic
                }
                
                // If auto-fix failed, show detailed diagnostic
                try {
                    const { diagnoseSubscriptionSync } = await import('backend/subscription-sync-diagnostics.jsw');
                    const diagnostic = await diagnoseSubscriptionSync(currentUser.id);
                    
                    const debugInfo = [
                        `CMS Status: ${diagnostic.cms?.subscriptionActive ? 'Active' : 'Inactive'}`,
                        `Paystack Status: ${diagnostic.paystack?.subscription?.status || 'Not Found'}`,
                        `Issues: ${diagnostic.issues?.join(', ') || 'None identified'}`,
                        `Recommendations: ${diagnostic.recommendations?.join(', ') || 'Contact support'}`
                    ].join('\n');

                    await wixWindow.openLightbox('Alert', {
                        message: `⚠️ Subscription Sync Issue Detected\n\n` +
                                `Your dashboard shows an active subscription, but we can't confirm it with Paystack.\n\n` +
                                `Common causes:\n` +
                                `• Subscription was cancelled in Paystack\n` +
                                `• Payment method declined\n` +
                                `• Account suspended\n\n` +
                                `Diagnostic Information:\n${debugInfo}\n\n` +
                                `If this persists, please contact support with this diagnostic info.`
                    });
                } catch (diagnosticErr) {
                    // Fallback to original message if diagnostic fails
                    await wixWindow.openLightbox('Alert', {
                        message: `⚠️ Subscription Sync Issue\n\n` +
                                `Your dashboard shows an active subscription, but Paystack verification failed.\n\n` +
                                `Error: ${paystackDetails?.error || 'Unknown error'}\n\n` +
                                `Please contact support for assistance.`
                    });
                }
            }

            if (!cmsActive && !paystackActive) {
                console.warn('[ACCESS DENIED] No active subscription found in CMS or Paystack. CMS:', profile.subscriptionActive, 'Paystack:', paystackDetails);
                
                // PRODUCTION: Block dashboard access without active subscription
                await wixWindow.openLightbox('Alert', { 
                    message: '🚫 Subscription Required\n\nNo active subscription detected.\n\nPlease subscribe to a plan to access your dashboard.' 
                });
                wixLocation.to(SIGNUP_PAGE); // Redirect to subscription page
                return;
            }

        // -----------------------------

        // -----------------------------
        // 5) Bind UI + data once
        // -----------------------------
        try {
            console.log('Calling updateTierBadge...');
            updateTierBadge(profile);
            console.log('Calling bindConsentSwitches...');
            bindConsentSwitches(profile); // binds toggles and prefills numbers
            console.log('Calling bindDashboardData...');
            await bindDashboardData(profile, userEmail);
            console.log('Calling bindPaystackSubscription...');
            await bindPaystackSubscription(currentUser.id);  // Fix: Use userId instead of userEmail
            console.log('Calling bindActivityLogs...');
            await bindActivityLogs(currentUser.id);
            console.log('All dashboard binders completed.');
        } catch (err) {
            console.error('❌ Error in dashboard binders:', err);
        }

        // greeting
        try {
            console.log('Setting greeting...');
            const hour = new Date().getHours();
            const tod = hour >= 5 && hour < 12 ? 'Good Morning' :
                hour >= 12 && hour < 18 ? 'Good Afternoon' :
                'Good Evening';
            const clientName = profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || (userEmail || '').split('@')[0] || 'Client';
            safeText('#greeting', `${tod}, ${clientName}`);
        } catch (e) {
            console.warn('Greeting failed', e);
        }

        // -----------------------------
        // 6) Wire UI controls (once) - Test notifications, update buttons
        // -----------------------------
        // TestNotify button
        $w('#TestNotify').onClick(async () => {
            console.log('TestNotify button clicked.');
            try {
                const receiveNotifications = profile.emergencyDetailsConsent === true;
                if (!receiveNotifications) {
                    safeText('#whatsappStatusText', "⚠️ Cannot send comprehensive test — notification consent not given.");
                    console.warn('TestNotify: Notification consent not given.');
                    return wixWindow.openLightbox('Alert', {
                        message: 'WhatsApp Test Failed = Notification consent was not given in your profile settings.',
                        showOptInButton: true,
                        recordId: profile._id
                    });
                }

                const numbersToSend = [
                    profile.phone,
                    profile.whatsAppNumber,
                    profile.whatsappPhoneInputPrimary,
                    profile.whatsappPhoneInputAdditional
                ].filter(Boolean);

                if (numbersToSend.length === 0) {
                    safeText('#whatsappStatusText', "⚠️ No valid WhatsApp numbers found in profile for comprehensive test.");
                    console.warn('TestNotify: No valid WhatsApp numbers found.');
                    return wixWindow.openLightbox('Alert', { message: 'WhatsApp Test Failed = No valid WhatsApp numbers were found in your profile to send a message to.' });
                }

                safeText('#whatsappStatusText', "⏳ Sending comprehensive test WhatsApps...");
                console.log('TestNotify: Sending WhatsApp test to numbers:', numbersToSend);
                const results = await sendWhatsAppTestMessage(numbersToSend);
                const successCount = results.sentTo?.length || 0;
                const failedCount = results.failedTo?.length || 0;

                let statusMessage = `✅ Sent comprehensive test WhatsApp to ${successCount} number(s).`;
                if (failedCount > 0) {
                    statusMessage += ` ❌ Failed to send to ${failedCount} number(s).`;
                    wixWindow.openLightbox('Alert', { message: `WhatsApp Test Failed = Failed to send a test message to ${failedCount} number(s).` });
                } else {
                    wixWindow.openLightbox('TestSuccess', { message: 'WhatsApp Test Successful.' });
                }
                safeText('#whatsappStatusText', statusMessage);

                await logTestAction({
                    userId: currentUser.id,
                    userEmail,
                    testType: 'Comprehensive WhatsApp Test',
                    phoneNumber: numbersToSend.join(', '),
                    status: successCount > 0 ? 'Success' : 'Failed'
                });
            } catch (err) {
                console.error('❌ Comprehensive WhatsApp test failed:', err);
                safeText('#whatsappStatusText', "❌ Error sending comprehensive test WhatsApp.");
                await logTestAction({
                    userId: currentUser.id,
                    userEmail,
                    testType: 'Comprehensive WhatsApp Test',
                    phoneNumber: '',
                    status: 'Failed',
                    errorMessage: err?.message || String(err)
                });
                wixWindow.openLightbox('Alert', { message: `WhatsApp Test Failed = ${err?.message || 'Unknown error'}` });
            }
        });

        // sendTestNotification (basic)
        $w('#sendTestNotification').onClick(async () => {
            console.log('sendTestNotification button clicked.');
            try {
                const receiveNotifications = profile.emergencyDetailsConsent === true;
                if (!receiveNotifications) {
                    safeText('#whatsappStatusText', "⚠️ Cannot send test — notification consent not given.");
                    console.warn('sendTestNotification: Notification consent not given.');
                    return wixWindow.openLightbox('Alert', {
                        message: 'WhatsApp Test Failed = Notification consent was not given in your profile settings.',
                        showOptInButton: true,
                        recordId: profile._id
                    });
                }

                const numbersToSend = [
                    profile.whatsappPhoneInputPrimary,
                    profile.whatsappPhoneInputAdditional
                ].filter(Boolean);

                if (numbersToSend.length === 0) {
                    safeText('#whatsappStatusText', "⚠️ No primary or additional WhatsApp numbers found in profile for test.");
                    console.warn('sendTestNotification: No primary or additional WhatsApp numbers found.');
                    return wixWindow.openLightbox('Alert', { message: 'WhatsApp Test Failed = No primary or additional WhatsApp numbers were found in your profile to send a message to.' });
                }

                safeText('#whatsappStatusText', "⏳ Sending basic test WhatsApp...");
                console.log('sendTestNotification: Sending WhatsApp test to numbers:', numbersToSend);
                const results = await sendWhatsAppTestMessage(numbersToSend);
                const successCount = results.sentTo?.length || 0;
                const failedCount = results.failedTo?.length || 0;

                let statusMessage = `✅ Sent basic test WhatsApp to ${successCount} number(s).`;
                if (failedCount > 0) {
                    statusMessage += ` ❌ Failed to send to ${failedCount} number(s).`;
                    wixWindow.openLightbox('Alert', { message: `WhatsApp Test Failed = Failed to send a test message to ${failedCount} number(s).` });
                } else {
                    wixWindow.openLightbox('TestSuccess', { message: 'WhatsApp Test Successful.' });
                }
                safeText('#whatsappStatusText', statusMessage);

                await logTestAction({
                    userId: currentUser.id,
                    userEmail,
                    testType: 'Basic WhatsApp Test',
                    phoneNumber: '',
                    status: successCount > 0 ? 'Success' : 'Failed'
                });
            } catch (err) {
                console.error('❌ Basic WhatsApp test failed:', err);
                safeText('#whatsappStatusText', "❌ Error sending basic test WhatsApp.");
                await logTestAction({
                    userId: currentUser.id,
                    userEmail,
                    testType: 'Basic WhatsApp Test',
                    phoneNumber: '',
                    status: 'Failed',
                    errorMessage: err?.message || String(err)
                });
                wixWindow.openLightbox('Alert', { message: `WhatsApp Test Failed = ${err?.message || 'Unknown error'}` });
            }
        });

        // -----------------------------
        // 7) QR generation: fixed & defensive
        // -----------------------------
        const qrBtn = safe('#ViewQR');
        if (qrBtn) {
            qrBtn.onClick(async () => {
                console.log('ViewQR button clicked.');
                try {
                    if (!profile.publicViewId) {
                        console.warn('QR: Public ID missing.');
                        await wixWindow.openLightbox('Alert', { message: '⚠️ Public ID missing.' });
                        return;
                    }

                    const url = `${BASE_PUBLIC_URL}${profile.publicViewId}`;
                    console.debug('Generating QR for URL:', url);

                    const qrRes = await generateCustomQR(url);
                    console.debug('generateCustomQR returned:', qrRes);

                    const qrUrl = (typeof qrRes === 'string') ? qrRes : (qrRes?.url || qrRes?.qrUrl || qrRes?.data?.url);
                    if (!qrUrl) {
                        console.error('QR generator returned unexpected shape:', qrRes);
                        throw new Error("QR generator did not return a URL");
                    }

                    await wixWindow.openLightbox('QRDisplayLightbox', { qrUrl });
                } catch (err) {
                    console.error('❌ QR generate failed:', err);
                    await wixWindow.openLightbox('Alert', { message: '❌ Could not generate QR code.' });
                }
            });
        } else {
            console.warn('QR: #ViewQR button not found.');
        }

        // -----------------------------
        // 8) Auto-refresh (store id so it can be cleared later)
        // -----------------------------
        autoRefreshId = setInterval(async () => {
            try {
                console.log('🔄 Auto-refreshing dashboard data...');
                const updatedProfile = await fetchEmergencyProfile(currentUser.id);
                console.log('Auto-refresh: updated profile:', updatedProfile);
                await bindDashboardData(updatedProfile, userEmail);
                await bindPaystackSubscription(currentUser.id);  // Fix: Use userId instead of userEmail
                await bindActivityLogs(currentUser.id);
                console.log('Auto-refresh: dashboard data bound.');
            } catch (err) {
                console.warn('Auto-refresh failed:', err);
            }
        }, 300000); // every 5 mins

        // -----------------------------
        // 9) IP logging (non-blocking)
        // -----------------------------
        try {
            const resp = await fetch('https://api.ipify.org?format=json');
            const data = await resp.json();
            const ip = data?.ip;
            if (ip) {
                safeText('#ip-display', `Your IP Address: ${ip}`);
                safeShow('#ip-display');
                try {
                    await wixData.insert('DashboardViewLogs', { userId: currentUser.id, ipAddress: ip, dateViewed: new Date() });
                } catch (e) {
                    console.warn('IP log insert failed', e);
                }
            }
        } catch (err) {
            console.warn('IP logging failed', err);
        }

        // -----------------------------
        // end of try
        // -----------------------------
    } catch (err) {
        // Catch fatal errors in initialization
        console.error('❌ Dashboard init error:', err);
        // user-facing alert (optional)
        try { await wixWindow.openLightbox('Alert', { message: 'Something went wrong loading your dashboard.' }); 
        } 
        catch (_) {    console.warn("⚠️ Alert lightbox failed to open.");
}
    } finally {
        // === SINGLE SPINNER CLEANUP ===
        // This will ALWAYS run regardless of returns/errors above.
        safeHide('#loadingSpinner');
        try { $w("#loadingOverlay1").hide(); } catch (e) { /* ignore if element missing */ }

        // Clear auto-refresh to prevent zombie timers on SPA-like navigations
        if (autoRefreshId) {
            clearInterval(autoRefreshId);
            autoRefreshId = null;
        }
    }
}); // end onReady
