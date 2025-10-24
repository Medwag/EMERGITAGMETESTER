import { profileViewed } from 'backend/profileViewed.jsw'; // Make sure this import is at the topimport wixData from 'wix-data';
import { sendTestWhatsApp } from 'backend/notify.jsw';
import { logProfileView } from 'backend/profile-view-logger.jsw';
import { sendWhatsAppTemplate, sendDiscordAlert } from 'backend/notify.jsw';

$w.onReady(function () {
    $w("#dynamicDataset").onReady(async () => {
        const profile = $w("#dynamicDataset").getCurrentItem();

        // ===============================================
        // >>> IMPORTANT: ADD THESE DEBUG LOGS HERE <<<
        // ===============================================
        console.log("DEBUG: Profile object retrieved from dataset:", profile);
        console.log("DEBUG: Value of profile.notificationPhoneNumber:", profile?.notificationPhoneNumber);
        console.log("DEBUG: Value of profile.notificationPhoneNumberAdditional:", profile?.notificationPhoneNumberAdditional);
        
        // ===============================================
        // >>> END OF NEW DEBUG LOGS <<<
        // ===============================================


        if (!profile || !profile.publicViewId) {
            console.error("❌ Profile not found or publicViewId missing.");
            return;
        }

        // 1. Initial Collapse of all sections
        collapseIfExists("#bronzeSection");
        collapseIfExists("#silverSection");
        collapseIfExists("#goldSection");
        collapseIfExists("#petSection");
        collapseIfExists("#doctorDetailsSection");
        collapseIfExists("#medicationSection");
        collapseIfExists("#medicationTableBpx");
        collapseIfExists("#additionalemergencycontact");
        collapseIfExists("#additionalemergencycontactBox");
        // Collapse the container that holds the Repeater

        // 1. Display Member Name
$w("#membersNameText").text = profile.fullName ? `Member: ${profile.fullName}` : "Member name not available";
console.log(`✅ Member Name set to: ${$w("#membersNameText").text}`);

$w("#membersTagText").text = profile.fullName ? `Member: ${profile.fullName}` : "Member name not available";
console.log(`✅ Member Tag set to: ${$w("#membersTagText").text}`);
$w("#memberTagText").text = profile.fullName ? `TAG USER: ${profile.fullName}` : "Member name not available";
console.log(`✅ Heading Member Name set to: ${$w("#memberTagText").text}`);

// 2. Display Secondary Contact Name
if (profile.secondaryContact && profile.secondaryContact.trim() !== "") {
  const secondaryContact = profile.secondaryContact.trim();
  $w("#SecondaryContact").text = `Additional Contact: ${secondaryContact}`;
  console.log(`✅ Secondary Contact Name: ${secondaryContact}`);
} else {
  $w("#SecondaryContact").text = "Additional contact not available";
  console.warn("⚠️ SecondaryContact field is missing or empty in profile.");
}

// 3. Display Secondary Contact Primary Number
if (profile.secondaryContactPrimaryNumber && profile.secondaryContactPrimaryNumber.trim() !== "") {
  const primaryNumber = profile.secondaryContactPrimaryNumber.trim();
  $w("#SecondaryNumber").text = `Additional Contact Primary Number: ${primaryNumber}`;
  console.log(`✅ Secondary Contact Primary Number: ${primaryNumber}`);
} else {
  $w("#SecondaryNumber").text = "Additional contact number not available";
  console.warn("⚠️ secondaryContactPrimaryNumber is missing or empty in profile.");
}

// 4. Display Secondary Contact Alternative Number
if (profile.secondaryContactPrimaryNumber1 && profile.secondaryContactPrimaryNumber1.trim() !== "") {
  const altNumber = profile.secondaryContactPrimaryNumber1.trim();
  $w("#SecondaryaltNumber").text = `Additional Contact Alt Number: ${altNumber}`;
  console.log(`✅ Secondary Contact Alt Number: ${altNumber}`);
} else {
  $w("#SecondaryaltNumber").text = "Additional contact alt number not available";
  console.warn("⚠️ secondaryContactPrimaryNumber1 is missing or empty in profile.");
}

// 5. Display Relationship
if (profile.alternativeContactRelationship && profile.alternativeContactRelationship.trim() !== "") {
  const relationship = profile.alternativeContactRelationship.trim();
  $w("#RelationshipText").text = `Relationship: ${relationship}`;
  console.log(`✅ Relationship: ${relationship}`);
} else {
  $w("#RelationshipText").text = "Relationship not specified";
  console.warn("⚠️ alternativeContactRelationship is missing or empty in profile.");
}
// ✅ Display Member Name
if (profile.fullName && profile.fullName.trim() !== "") {
  const memberName = `Member: ${profile.fullName.trim()}`;
  $w("#memberNameText").text = memberName;
  console.log(`✅ DEBUG: Member Name set to: ${memberName}`);
} else {
  $w("#memberNameText").text = "Member name not available";
  console.warn("⚠️ Member name is missing in profile.");
}

// ✅ Load and log member tier
const tier = profile.membershipTier;
console.log(`✅ Loaded profile for tier: ${tier}`);

/// 2. Display Member Name
if (profile.fullName && profile.fullName.trim() !== "") {
  const memberName = `Medical Information for: ${profile.fullName.trim()}`;
  $w("#memberNameTextOwner").text = memberName;
  console.log(`✅ DEBUG: Member Name set to: ${memberName}`);
} else {
  $w("#memberNameTextOwner").text = "Member name not available";
  console.warn("⚠️ Member name is missing in profile.");
}
// 3. Apply Tier-Based Section Visibility
        showFlexboxForTier(tier);

        // 4. Implement Slider Switch Visibility Logic (Overrides Tier-Based Visibility)

        // 4a. Doctor Details Section
        if (profile.showDoctorNamePublic !== false && (profile.doctorName || profile.doctorContact || profile.homeGp || profile.gpNumber || profile.doctorsEmergencyNumber)) {
            $w("#doctorNameText").text = profile.homeGp || "N/A";
            $w("#doctorContactText").text = profile.gpNumber || "N/A";
            
            $w("#doctorDetailsSection").expand();
            console.log("✅ Doctor section shown by switch/default.");
        } else {
            $w("#doctorDetailsSection").collapse();
            console.log("🔒 Doctor section hidden by switch or no data.");
        }

        // 4b. Silver Section
        if (profile.showmeddetailsPublic === false) {
            $w("#silverSection").collapse();
            console.log("🔒 Silver section (medical details) hidden by switch.");
        } else {
            console.log("✅ Silver section (medical details) visible by switch/default.");
        }

        // 4c. Gold Section / Medical Aid Details
        if (profile.showMedAidPublic === false) {
            $w("#goldSection").collapse();
            console.log("🔒 Gold section (medical aid) hidden by switch.");
        } else {
            console.log("✅ Gold section (medical aid) visible by switch/default.");
        }

// 4d. Medication Section (controlled by showMedicationSwitch)
const rows = [];

for (let i = 1; i <= 10; i++) {
    const index = i < 10 ? `0${i}` : `${i}`;
    const name = profile[`med${index}Name`] || "";
    const dose = profile[`med${index}Dose`] || "";
    const frequency = profile[`med${index}Frequency`] || "";

    if (name || dose || frequency) {
        rows.push({
            _id: `med${i}`,
            medication: name,
            dose: dose,
            frequency: frequency
        });
    }
}

console.log(`DEBUG: profile.showMedicationSwitch value: ${profile.showMedicationSwitch}`);
console.log(`DEBUG: Number of medication rows found: ${rows.length}`);

if (rows.length > 0) {
    console.log("DEBUG: First medication row in 'rows' array:", rows[0]);
    console.log("DEBUG: All medication rows in 'rows' array:", rows);
} else {
    console.log("DEBUG: No medication data found in profile or rows array is empty.");
}

        // Connect the Repeater to the data
        $w("#medicationRepeater").data = rows;

// Set up the itemReady function for the Repeater
$w("#medicationRepeater").onItemReady(($item, itemData, index) => {
    console.log(`DEBUG: onItemReady called for item ${index}. itemData:`, itemData); 

    // Ensure these element IDs match exactly what you named them in the Wix Editor!
    $item("#medicationText").text = itemData.medication;
    $item("#doseText").text = itemData.dose;
    $item("#frequencyText").text = itemData.frequency;

    console.log(`DEBUG: Item ${index} set - Med: ${itemData.medication}, Dose: ${itemData.dose}, Freq: ${itemData.frequency}`);
});


        // *** THIS IS THE CRITICAL BLOCK THAT WAS SKIPPED ***
        // *** TEMPORARY DEBUGGING CODE: FORCE SHOW MEDICATION SECTION (remove 'profile.showMedicationSwitch' for now to be sure it shows) ***
        // Replaced your original if (profile.showMedicationSwitch === true || profile.showMedicationSwitch === "true") && rows.length > 0)
        // with the temporary one from before.
        if (rows.length > 0) { 
            $w("#medicationRepeater").show();
            $w("#medicationTableBpx").expand(); 
            $w("#medicationSection").expand();
            console.log("✅ FORCED: Medication repeater and sections shown (for debugging).");
        } else {
            $w("#medicationRepeater").hide();
            $w("#medicationTableBpx").collapse();
            $w("#medicationSection").collapse();
            console.warn("🔒 Medication repeater and sections hidden (no data found).");
        }
        // *** END TEMPORARY DEBUGGING CODE ***

        // 5. IP Logging and Alert
try {
            const res = await fetch("https://ipapi.co/json/");
            const data = await res.json();
            const ip = data.ip;
            const location = `${data.city}, ${data.region}, ${data.country_name}`;

            const alertMessage = `🚨Hello ${profile.fullName || 'User'}, your EmergiTag.me profile, Member Profile: ID ${profile.publicViewId}, was just viewed from 📍 ${location} using IP address ${ip}. (❗️The Location is Approximate Only - WE DO NOT TRACK USERS' LOCATIONS❗️) ⚠️If this access is unexpected, please reply to this Message, review your Profile or Email info@emergitag.me.`;

            // WhatsApp: 
           try {
    const ipData = await fetch("https://ipapi.co/json/").then(r => r.json());
    const viewerIp = ipData?.ip || "Unknown IP";
    const viewerLocation = `${ipData?.city || 'Unknown City'}, ${ipData?.region || ''}, ${ipData?.country_name || ''}`;

    // Send notifications
    const result = await profileViewed(profile._id, viewerIp, viewerLocation);

    console.log("✅ profileViewed results:", result);
} catch (err) {
    console.error("❌ profileViewed failed:", err);
}




        } catch (geoErr) {
            console.error("❌ Could not fetch IP info or send WhatsApp alert:", geoErr);
        }  // <-- close catch block properly
}); // closes $w("#dynamicDataset").onReady(async () => {
}); // closes $w.onReady(function () {
// ======== Tier Visibility Handler ========
function showFlexboxForTier(tier) {
    switch (tier) {
        case "Bronze":
            $w("#bronzeSection").expand();
            break;
        case "Silver":
            $w("#bronzeSection").expand();
            $w("#silverSection").expand();
            break;
       case "Gold":
            $w("#bronzeSection").expand();
            $w("#silverSection").expand();
            $w("#goldSection").expand();
            $w("#additionalemergencycontact").expand();     // Expand the parent section
            $w("#additionalemergencycontactBox").expand(); // <--- Expand the flexbox inside the section
            break;
        case "Pet":
            $w("#petSection").expand();
            break;
        default:
            console.warn("⚠️ Unknown membership tier:", tier);
    }
}

// ======== Helper: Collapse if Element Exists ========
function collapseIfExists(id) {
    try {
        const el = $w(id);
        if (el && el.collapse) {
            el.collapse();
        }
    } catch (e) {
        // console.warn(⚠️ Element ${id} error or not found:, e.message);
    }
}
console.log("Type of sendWhatsAppAlert:", typeof sendWhatsAppAlert);
