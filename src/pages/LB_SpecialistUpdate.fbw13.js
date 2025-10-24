import wixWindow from 'wix-window';
import wixData from 'wix-data';

const COLLECTION = 'Emergency_Profiles';

let recordId;
let originalItem;

$w.onReady(async () => {
  // 1) Get the recordId passed by the dashboard
  const ctx = wixWindow.lightbox.getContext();
  recordId = ctx?.recordId;

  if (!recordId) {
    $w('#statusText').text = 'Missing recordId. Please close and retry from the dashboard.';
    $w('#btnSave').disable();
    return;
  }

  // 2) Load current record
  try {
    originalItem = await wixData.get(COLLECTION, recordId);
    if (!originalItem) throw new Error('Record not found');

    // 3) Prefill inputs
    $w('#inSpec01Name').value       = originalItem.Specialist || '';
    $w('#inSpec02Name').value       = originalItem.specialist2Id || '';
    $w('#inSpec03Name').value       = originalItem.specialist3Id || '';
    $w('#inSpec01Number').value       = originalItem.specialistNumber || '';
    $w('#inSpec02Number').value       = originalItem.specialistEmergencyNumber1 || '';
    $w('#inSpec03Number').value       = originalItem.specialistEmergencyNumber11 || '';
    $w('#inSpec01EmergencyNumber').value     = originalItem.specialistEmergencyNumber || '';
    $w('#inSpec02EmergencyNumber').value     = originalItem.specialistEmergencyNumber1 || '';
    $w('#inSpec03EmergencyNumber').value     = originalItem.specialistEmergencyNumber11 || '';
    $w('#inSpec01Type').value     = originalItem.speciality01 || '';
    $w('#inSpec02Type').value     = originalItem.speciality02 || '';
    $w('#inSpec03Type').value     = originalItem.speciality021 || '';
    
  } catch (err) {
    console.error('Load failed:', err);
    $w('#statusText').text = 'Could not load your Medical Aid details.';
    $w('#btnSave').disable();
  }

  // 4) Wire buttons
  $w('#btnCancel').onClick(() => wixWindow.lightbox.close({ updated: false }));

  $w('#btnSave').onClick(async () => {
    // Basic validation (adjust to your needs)
    const name = ($w('#inSpec01Name').value || '').trim();
    const number = ($w('#inSpec01Number').value || '').trim();

    if (!name || !number) {
      $w('#statusText').text = 'Please fill in Your Doctors Name and Contact Number.';
      return;
    }

    try {
      $w('#btnSave').disable();
      if ($w('#savingSpinner')) $w('#savingSpinner').show();
      $w('#statusText').text = 'Saving...';

      // Build partial update
      const updates = {
        _id: recordId,
        inSpec01Name: name,
        inSpec01Number: ($w('#inSpec01Number').value || '').trim() || null,
        inSpec01EmergencyNumber: number,
        inSpec02Name:($w('#inSpec02Name').value || '').trim() || null,
        inSpec02Number:($w('#inSpec02Number').value || '').trim() || null,
        inSpec02EmergencyNumber:($w('#inSpec02EmergencyNumber').value || '').trim() || null,
        inSpec03Name:($w('#inSpec03Name').value || '').trim() || null,
        inSpec03Number:($w('#inSpec03Number').value || '').trim() || null,
        inSpec03EmergencyNumber:($w('#inSpec03EmergencyNumber').value || '').trim() || null,
        lastUpdated: new Date()
      };

      // Merge onto original to avoid wiping other fields
      const itemToSave = { ...originalItem, ...updates };

      await wixData.update(COLLECTION, itemToSave);

      // Close & tell the dashboard to refresh
      wixWindow.lightbox.close({ updated: true, section: 'MedicalAid' });

    } catch (err) {
      console.error('Save failed:', err);
      $w('#statusText').text = 'Save failed. Please try again.';
      $w('#btnSave').enable();
      if ($w('#savingSpinner')) $w('#savingSpinner').hide();
    }
  });
});
