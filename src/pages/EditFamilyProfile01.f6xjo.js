import wixWindow from 'wix-window';
import wixData from 'wix-data';
import wixUsers from 'wix-users';

let profileId;

$w.onReady(async function () {
    const receivedData = wixWindow.lightbox.getContext();
    profileId = receivedData?.profileId ?? null;

    // Initial setup
    $w("#medication10Box").collapse().then(() => {
  console.log("✅ Medication10Box collapsed");
});
    $w("#toggleMedicationFields").checked = false;
    $w("#showMoreMedsBtn").hide();
    $w("#hideExtraMedsBtn").hide();

    // Collapse all medication boxes on load
    for (let i = 1; i <= 10; i++) {
        const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
        $w(boxId).collapse();
    }

    // Terms checkbox logic
    $w("#saveEditBtn").disable();
    $w("#termsCheckbox").onChange(() => {
        if ($w("#termsCheckbox").checked) {
            $w("#saveEditBtn").enable();
        } else {
            $w("#saveEditBtn").disable();
        }
    });

    // Toggle medication section
    $w("#toggleMedicationFields").onChange(() => {
        if ($w("#toggleMedicationFields").checked) {
            $w("#medicationSection").expand();
            for (let i = 1; i <= 2; i++) {
                const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
                $w(boxId).expand();
            }
            for (let i = 3; i <= 10; i++) {
                const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
                $w(boxId).collapse();
            }
            $w("#showMoreMedsBtn").show();
            $w("#hideExtraMedsBtn").hide();
        } else {
            $w("#medicationSection").collapse();
            $w("#showMoreMedsBtn").hide();
            $w("#hideExtraMedsBtn").hide();
            for (let i = 1; i <= 10; i++) {
                $w(`#med0${i}Name`).value = "";
                $w(`#med0${i}Dose`).value = "";
                $w(`#med0${i}Frequency`).value = "";
                const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
                $w(boxId).collapse();
            }
        }
    });

    // Show more meds
    $w("#showMoreMedsBtn").onClick(() => {
        for (let i = 3; i <= 10; i++) {
            const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
            $w(boxId).expand();
        }
        $w("#showMoreMedsBtn").hide();
        $w("#hideExtraMedsBtn").show();
    });

    // Hide extra meds
    $w("#hideExtraMedsBtn").onClick(() => {
        for (let i = 3; i <= 10; i++) {
            $w(`#med0${i}Name`).value = "";
            $w(`#med0${i}Dose`).value = "";
            $w(`#med0${i}Frequency`).value = "";
            const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
            $w(boxId).collapse();
        }
        $w("#showMoreMedsBtn").show();
        $w("#hideExtraMedsBtn").hide();
    });

    // Load existing profile
    if (profileId) {
        try {
            const profile = await wixData.get("Emergency_Profiles", profileId);

            $w("#editFullName").value = profile.fullName || "";
            $w("#editEmergencyContact").value = profile.emergencyContact || "";
            $w("#editEmergencyContactPhoneNumber").value = profile.emergencyContactPrimaryNumber || "";
            $w("#editEmergencyContactAltPhoneNumber").value = profile.emergencyContactAltNumber || "";
            $w("#editEmergencyContactRelationship").value = profile.emergencyContactRelationship || "";
            $w("#editEmergencyContactAllergies").value = profile.allergies || "";
            $w("#editEmergencyContactBloodType").value = profile.bloodType || "";
            $w("#editEmergencyMedicalAidName").value = profile.medicalAidDetailsName || "";
            $w("#editEmergencyMedicalAidNumber").value = profile.medicalAidDetailsNumber || "";
            $w("#editEmergencyMedicalAidOption").value = profile.medicalAidDetailsOption || "";
            $w("#editEmergencyMedicalAidDependantCode").value = profile.medicalAidDetailsDependantcode || "";
            $w("#editEmergencyMedicalInfo").value = profile.conditions || "";

            let hasMedication = false;
            for (let i = 1; i <= 10; i++) {
                const name = profile[`med0${i}Name`] || "";
                const dose = profile[`med0${i}Dose`] || "";
                const freq = profile[`med0${i}Frequency`] || "";

                $w(`#med0${i}Name`).value = name;
                $w(`#med0${i}Dose`).value = dose;
                $w(`#med0${i}Frequency`).value = freq;

                if (name || dose || freq) {
                    const boxId = i < 10 ? `#medication0${i}Box` : `#medication10Box`;
                    $w(boxId).expand();
                    hasMedication = true;
                }
            }

            if (hasMedication) {
                $w("#toggleMedicationFields").checked = true;
                $w("#medicationSection").expand();
                const med3Used = $w(`#med03Name`).value || $w(`#med03Dose`).value || $w(`#med03Frequency`).value;
                if (med3Used) {
                    $w("#showMoreMedsBtn").hide();
                    $w("#hideExtraMedsBtn").show();
                } else {
                    $w("#showMoreMedsBtn").show();
                    $w("#hideExtraMedsBtn").hide();
                }
            }

            if (profile.termsAccepted) {
                $w("#termsCheckbox").checked = true;
                $w("#saveEditBtn").enable();
            }

        } catch (err) {
            console.error("❌ Failed to load profile:", err);
        }
    } else {
        // New profile
        $w("TextInput").forEach(i => i.value = "");
        $w("TextBox").forEach(i => i.value = "");
        $w("#termsCheckbox").checked = false;
        $w("#saveEditBtn").disable();
    }
});

// SAVE BUTTON
export async function saveEditBtn_click() {
    const fullName = $w("#editFullName").value?.trim();
    const emergencyContact = $w("#editEmergencyContact").value?.trim();

    if (!fullName || !emergencyContact) {
        $w("#editFullName").updateValidityIndication();
        $w("#editEmergencyContact").updateValidityIndication();
        return;
    }

    if (!$w("#termsCheckbox").checked) {
        console.warn("Terms not accepted");
        return;
    }

    const userId = wixUsers.currentUser.id;

    const record = {
        fullName,
        emergencyContact,
        emergencyContactPrimaryNumber: $w("#editEmergencyContactPhoneNumber").value?.trim(),
        emergencyContactAltNumber: $w("#editEmergencyContactAltPhoneNumber").value?.trim(),
        emergencyContactRelationship: $w("#editEmergencyContactRelationship").value?.trim(),
        allergies: $w("#editEmergencyContactAllergies").value?.trim(),
        bloodType: $w("#editEmergencyContactBloodType").value?.trim(),
        medicalAidDetailsName: $w("#editEmergencyMedicalAidName").value?.trim(),
        medicalAidDetailsNumber: $w("#editEmergencyMedicalAidNumber").value?.trim(),
        medicalAidDetailsOption: $w("#editEmergencyMedicalAidOption").value?.trim(),
        medicalAidDetailsDependantcode: $w("#editEmergencyMedicalAidDependantCode").value?.trim(),
        conditions: $w("#editEmergencyMedicalInfo").value?.trim(),
        lastUpdated: new Date(),
        accountOwnerId: userId,
        termsAccepted: true,
        termsAcceptedDate: new Date()
    };

    if ($w("#toggleMedicationFields").checked) {
        for (let i = 1; i <= 10; i++) {
            record[`med0${i}Name`] = $w(`#med0${i}Name`).value?.trim();
            record[`med0${i}Dose`] = $w(`#med0${i}Dose`).value?.trim();
            record[`med0${i}Frequency`] = $w(`#med0${i}Frequency`).value?.trim();
        }
    } else {
        for (let i = 1; i <= 10; i++) {
            record[`med0${i}Name`] = "";
            record[`med0${i}Dose`] = "";
            record[`med0${i}Frequency`] = "";
        }
    }

    try {
        if (profileId) {
            record._id = profileId;
            await wixData.update("Emergency_Profiles", record);
        } else {
            await wixData.insert("Emergency_Profiles", record);
        }

        $w("TextInput").forEach(i => i.value = "");
        $w("TextBox").forEach(i => i.value = "");
        $w("Checkbox").forEach(c => c.checked = false);
        $w("#medicationSection").collapse();

        wixWindow.lightbox.close({ success: true });

    } catch (err) {
        console.error("❌ Failed to save profile:", err);
    }
}

// CANCEL BUTTON
export function cancelBtn_click() {
    wixWindow.lightbox.close();
}
