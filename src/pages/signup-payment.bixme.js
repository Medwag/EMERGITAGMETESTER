/**
 * Sign-up Page - SIMPLIFIED VERSION
 * Clean, maintainable code for user registration and address collection
 * 
 * Flow:
 * 1. User creates account (Wix Members)
 * 2. Collects: Name, Email, Phone, Addresses
 * 3. Saves to Emergency_Profiles
 * 4. Checks if signup fee paid
 * 5. Redirects to either /signup-payment or /membership-plans
 */

import wixUsers from 'wix-users';
import wixLocation from 'wix-location';
import { saveEmergencyProfile } from 'backend/profile-utils.jsw';
import { detectSignupPaymentDual } from 'backend/signup-payment-detector-dual.jsw';

// Safe element helper
function el(selector) {
    try {
        const element = $w(selector);
        return element || null;
    } catch {
        return null;
    }
}

// Format phone number to South African format
function formatPhone(input) {
    if (!input) return null;
    let digits = String(input).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '27' + digits.slice(1);
    return digits.length === 11 && digits.startsWith('27') ? digits : null;
}

// Validate email
function validateEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Get formatted address from Address input or plain text
function getFormattedAddress(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.trim() || null;
    // Address widget returns object with formatted address
    return value.formatted || value.addressLine || value.formattedAddress || null;
}

$w.onReady(async () => {
    console.log('[SignUp] Page ready');
    
    const user = wixUsers.currentUser;
    
    // Get elements
    const inputFullName = el('#inputFullName');
    const inputEmail = el('#inputEmail');
    const inputPhone = el('#inputPhone');
    const homeAddress = el('#homeAddress');
    const deliveryAddress = el('#deliveryAddress');
    const smsConsent = el('#smsConsent');
    const waConsent = el('#waConsent');
    const submitBtn = el('#submitBtn');
    const statusText = el('#statusText');
    const loadingSpinner = el('#loadingSpinner');
    
    // Hide loading initially
    loadingSpinner?.hide();
    statusText?.hide();
    
    // Pre-fill email if user is logged in
    if (user && user.loggedIn && inputEmail) {
        try {
            const email = await user.getEmail();
            if (email) inputEmail.value = email;
        } catch (error) {
            console.warn('[SignUp] Could not get user email:', error);
        }
    }
    
    // Submit button handler
    if (submitBtn) {
        submitBtn.onClick(async () => {
            console.log('[SignUp] Submit button clicked');
            
            // Show loading
            submitBtn.disable();
            loadingSpinner?.show();
            statusText?.hide();
            
            try {
                // Check if user is logged in
                if (!user || !user.loggedIn) {
                    throw new Error('Please log in to continue. Redirecting...');
                }
                
                const userId = user.id;
                
                // Collect form data
                const fullName = inputFullName?.value?.trim() || '';
                const email = inputEmail?.value?.trim() || '';
                const phoneRaw = inputPhone?.value?.trim() || '';
                const homeAddressValue = getFormattedAddress(homeAddress?.value);
                const deliveryAddressValue = getFormattedAddress(deliveryAddress?.value);
                const smsConsentValue = smsConsent?.checked || false;
                const waConsentValue = waConsent?.checked || false;
                
                // Validate required fields
                const missing = [];
                if (!fullName) missing.push('Full Name');
                if (!email) missing.push('Email');
                if (!phoneRaw) missing.push('Phone');
                if (!homeAddressValue) missing.push('Home Address');
                if (!deliveryAddressValue) missing.push('Delivery Address');
                
                if (missing.length > 0) {
                    throw new Error(`Please fill in: ${missing.join(', ')}`);
                }
                
                // Validate email format
                if (!validateEmail(email)) {
                    throw new Error('Please enter a valid email address');
                }
                
                // Format phone number
                const phone = formatPhone(phoneRaw);
                if (!phone) {
                    throw new Error('Please enter a valid South African phone number (e.g., 0XXXXXXXXX)');
                }
                
                // Save profile
                console.log('[SignUp] Saving emergency profile...');
                statusText?.text = 'Saving your information...';
                statusText?.show();
                
                const profileData = {
                    userId,
                    email,
                    fullName,
                    phone,
                    whatsAppNumber: phone, // Use same number for WhatsApp
                    smsConsent: smsConsentValue,
                    waConsent: waConsentValue,
                    homeAddress: homeAddressValue,
                    deliveryAddress: deliveryAddressValue
                };
                
                await saveEmergencyProfile(profileData);
                console.log('[SignUp] Profile saved successfully');
                
                // Check if signup fee has been paid
                console.log('[SignUp] Checking signup payment status...');
                statusText?.text = 'Checking payment status...';
                
                let signupPaid = false;
                try {
                    const paymentCheck = await detectSignupPaymentDual(userId, {
                        includePartialMatches: true,
                        timeWindow: 120
                    });
                    signupPaid = paymentCheck && paymentCheck.paymentDetected;
                    console.log('[SignUp] Signup payment status:', signupPaid ? 'PAID' : 'NOT PAID');
                } catch (error) {
                    console.warn('[SignUp] Error checking payment status:', error);
                    // Default to not paid if check fails
                    signupPaid = false;
                }
                
                // Redirect based on payment status
                if (signupPaid) {
                    console.log('[SignUp] Signup fee already paid, redirecting to membership plans');
                    statusText?.text = 'Success! Redirecting to membership plans...';
                    setTimeout(() => wixLocation.to('/membership-plans'), 1500);
                } else {
                    console.log('[SignUp] Signup fee not paid, redirecting to payment page');
                    statusText?.text = 'Success! Redirecting to payment...';
                    setTimeout(() => wixLocation.to('/signup-payment'), 1500);
                }
                
            } catch (error) {
                console.error('[SignUp] Error:', error);
                
                // Show error message
                if (statusText) {
                    statusText.text = '❌ ' + (error.message || 'Something went wrong. Please try again.');
                    statusText.show();
                }
                
                // Re-enable submit button
                submitBtn.enable();
                loadingSpinner?.hide();
            }
        });
    }
    
    console.log('[SignUp] Page initialization complete');
});
