// Refactored CollectAddresses Lightbox - Enhanced Error Prevention
// - Removes unsupported DOM/CSS manipulations on $w components  
// - Avoids duplicate event handlers and runaway retries
// - Adds comprehensive guarded element access with try-catch blocks
// - Safe element method calls with fallback error handling
// - Minimizes PII logging and controls debug output
// - Supports simple fallback inputs if present in Editor
// - Prevents "onMouseIn is not a function" and "hide is not a function" errors
// - All Wix element method calls are wrapped in protective try-catch blocks
// - Optional elements (loadingSpinner, fallback inputs, fallback buttons) fail silently without warnings

import wixWindow from 'wix-window';
import wixUsers from 'wix-users';
import wixLocation from 'wix-location';
import { saveEmergencyProfile } from 'backend/profile-utils.jsw';
import { createSimplePayfastPayment } from 'backend/payfast-simple.jsw';
import { createPaystackPayment } from 'backend/paystack.jsw';

// Enhanced error prevention for Wix element interactions

// Toggle verbose logging for troubleshooting (never enable in production)
const DEBUG = false;
const dbg = (...args) => { if (DEBUG) console.log('[CollectAddresses]', ...args); };

function formatPhone(input) {
    if (!input) return null;
    let digits = String(input).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '27' + digits.slice(1);
    return digits || null;
}

function validateEmail(email) {
    if (!email) return false;
    // Simple and pragmatic email validation
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateZAFormattedPhone(digits) {
    // Expect 11 digits starting with 27 after formatting (e.g., 27XXXXXXXXX)
    return typeof digits === 'string' && digits.length === 11 && digits.startsWith('27');
}

function getFormattedAddress(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.trim() || null;
    // Common shapes returned by Address/Places inputs
    return value.formatted || value.addressLine || value.formattedAddress || null;
}

$w.onReady(() => {
    console.log('[CollectAddresses] onReady: Lightbox initializing');
    
    // Global error handler for this page
    try {

    // Utility helpers to safely access elements
    const el = (selector) => {
        try { 
            const element = $w(selector);
            // Return a safe proxy that prevents method errors
            if (!element) return undefined;
            
            // Create a safe wrapper for element methods
            const safeElement = Object.create(element);
            
            // Override common methods with safe versions
            const safeMethods = ['hide', 'show', 'enable', 'disable', 'onClick', 'onMouseIn', 'onMouseOut'];
            safeMethods.forEach(method => {
                if (typeof element[method] === 'function') {
                    safeElement[method] = function(...args) {
                        try {
                            return element[method].apply(element, args);
                        } catch (e) {
                            console.warn(`[CollectAddresses] Safe method call failed for ${selector}.${method}:`, e?.message);
                            return undefined;
                        }
                    };
                } else {
                    safeElement[method] = function() {
                        // Only warn for required elements, not optional fallback elements
                        const optionalElements = [
                            'loadingSpinner', 'homeAddressFallback', 'deliveryAddressFallback',
                            'closeBtn', 'dismissBtn', 'cancelButton', 'confirmBtn', 'continueBtn', 
                            'Continue', 'continue', 'continueButton', 'btnContinue', 'saveBtn',
                            'PayfastPay', 'payfastPayButton', 'PaystackPay', 'paystackPayButton'
                        ];
                        const elementId = selector.replace('#', '');
                        const isOptional = optionalElements.includes(elementId);
                        
                        if (!isOptional) {
                            console.warn(`[CollectAddresses] Method ${method} not available on element ${selector}`);
                        }
                        return undefined;
                    };
                }
            });
            
            return safeElement;
        } catch (_) { 
            return undefined; 
        }
    };

    const errorText = el('#errorText');
    const loadingSpinner = el('#loadingSpinner'); // Optional: add this element in Wix Editor for loading feedback
    
    // Create a safe loading spinner wrapper that handles different element types
    // Note: Some Wix elements (like images, containers) may not support standard show/hide methods
    const safeLoadingSpinner = {
        show: () => {
            try {
                if (loadingSpinner) {
                    // Try multiple approaches for different element types
                    if (typeof loadingSpinner.show === 'function') {
                        loadingSpinner.show();
                    } else if (typeof loadingSpinner.expand === 'function') {
                        loadingSpinner.expand(); // For some containers
                    } else if (loadingSpinner.hidden !== undefined) {
                        loadingSpinner.hidden = false; // For elements with hidden property
                    } else {
                        dbg('LoadingSpinner exists but show method not supported for this element type');
                    }
                }
            } catch (e) {
                dbg('Safe loadingSpinner show failed:', e?.message);
            }
        },
        hide: () => {
            try {
                if (loadingSpinner) {
                    // Try multiple approaches for different element types
                    if (typeof loadingSpinner.hide === 'function') {
                        loadingSpinner.hide();
                    } else if (typeof loadingSpinner.collapse === 'function') {
                        loadingSpinner.collapse(); // For some containers
                    } else if (loadingSpinner.hidden !== undefined) {
                        loadingSpinner.hidden = true; // For elements with hidden property
                    } else {
                        dbg('LoadingSpinner exists but hide method not supported for this element type');
                    }
                }
            } catch (e) {
                dbg('Safe loadingSpinner hide failed:', e?.message);
            }
        }
    };
    const submitBtn = el('#submitBtn');
    const cancelBtn = el('#cancelBtn');

    const inputFullName = el('#inputFullName');
    const inputEmail = el('#inputEmail');
    const inputPhone = el('#inputPhone');
    const inputWA = el('#inputWA');

    const SMSConsent = el('#SMSConsent');
    const WAConsent = el('#WAConsent');

    const homeAddress = el('#homeAddress');
    const deliveryAddress = el('#deliveryAddress');

    // Optional manual fallback text inputs (add in Editor if needed)
    const homeAddressFallback = el('#homeAddressFallback');
    const deliveryAddressFallback = el('#deliveryAddressFallback');

    // Initialize UI state safely
    try {
        errorText?.hide?.();
    } catch (e) {
        console.warn('[CollectAddresses] Error hiding errorText:', e?.message);
    }
    // Initialize loading spinner safely
    safeLoadingSpinner.hide();

    // Log initial element availability
    try {
        const found = {
            errorText: !!errorText,
            loadingSpinner: !!loadingSpinner,
            submitBtn: !!submitBtn,
            cancelBtn: !!cancelBtn,
            inputFullName: !!el('#inputFullName'),
            inputEmail: !!el('#inputEmail'),
            inputPhone: !!el('#inputPhone'),
            inputWA: !!el('#inputWA'),
            SMSConsent: !!el('#SMSConsent'),
            WAConsent: !!el('#WAConsent'),
            homeAddress: !!el('#homeAddress'),
            deliveryAddress: !!el('#deliveryAddress'),
            homeAddressFallback: !!el('#homeAddressFallback'),
            deliveryAddressFallback: !!el('#deliveryAddressFallback')
        };
        console.log('[CollectAddresses] Elements found:', found);
    } catch (logErr) {
        console.warn('[CollectAddresses] Element logging failed:', logErr?.message);
    }

    // Initialize address fields (simple, supported operations only)
    try {
        // Enable and show primary address fields safely
        try {
            homeAddress?.enable?.();
        } catch (e) {
            console.warn('[CollectAddresses] Error enabling homeAddress:', e?.message);
        }
        try {
            homeAddress?.show?.();
        } catch (e) {
            console.warn('[CollectAddresses] Error showing homeAddress:', e?.message);
        }
        try {
            deliveryAddress?.enable?.();
        } catch (e) {
            console.warn('[CollectAddresses] Error enabling deliveryAddress:', e?.message);
        }
        try {
            deliveryAddress?.show?.();
        } catch (e) {
            console.warn('[CollectAddresses] Error showing deliveryAddress:', e?.message);
        }

        // If fallbacks are present and primary inputs are missing, show fallbacks
        if (!homeAddress) {
            try {
                homeAddressFallback?.show?.();
            } catch (e) {
                console.warn('[CollectAddresses] Error showing homeAddressFallback:', e?.message);
            }
        }
        if (!deliveryAddress) {
            try {
                deliveryAddressFallback?.show?.();
            } catch (e) {
                console.warn('[CollectAddresses] Error showing deliveryAddressFallback:', e?.message);
            }
        }

        // If primary inputs exist, hide fallbacks if present
        if (homeAddress) {
            try {
                homeAddressFallback?.hide?.();
            } catch (e) {
                console.warn('[CollectAddresses] Error hiding homeAddressFallback:', e?.message);
            }
        }
        if (deliveryAddress) {
            try {
                deliveryAddressFallback?.hide?.();
            } catch (e) {
                console.warn('[CollectAddresses] Error hiding deliveryAddressFallback:', e?.message);
            }
        }
    } catch (initErr) {
        dbg('Address fields init error:', initErr);
    }

    // Helper to collect, validate and save; returns { user, email, savedProfile }
    const collectValidateAndSave = async () => {
        console.log('[CollectAddresses] collectValidateAndSave: start');
        const user = wixUsers.currentUser;
        if (!user.loggedIn) throw new Error('Please log in first.');

        // Collect inputs
        const fullName = (inputFullName?.value || '').trim();
        const email = (inputEmail?.value || '').trim();
        const phoneRaw = (inputPhone?.value || '').trim();
        const waRaw = (inputWA?.value || '').trim();

        const phoneDigits = formatPhone(phoneRaw);
        const whatsAppDigits = formatPhone(waRaw);

        const smsConsent = !!(SMSConsent?.checked);
        const waConsent = !!(WAConsent?.checked);

        // Resolve addresses (prefer primary inputs if available)
        let homeAddressValue = null;
        let deliveryAddressValue = null;

        if (homeAddress && typeof homeAddress.value !== 'undefined') {
            homeAddressValue = getFormattedAddress(homeAddress.value);
        }
        if (!homeAddressValue && homeAddressFallback && typeof homeAddressFallback.value === 'string') {
            homeAddressValue = (homeAddressFallback.value || '').trim() || null;
        }

        if (deliveryAddress && typeof deliveryAddress.value !== 'undefined') {
            deliveryAddressValue = getFormattedAddress(deliveryAddress.value);
        }
        if (!deliveryAddressValue && deliveryAddressFallback && typeof deliveryAddressFallback.value === 'string') {
            deliveryAddressValue = (deliveryAddressFallback.value || '').trim() || null;
        }

        // Validate
        const missing = [];
        if (!fullName) missing.push('Full Name');
        if (!email) missing.push('Email');
        if (!phoneDigits) missing.push('Phone');
        if (!homeAddressValue) missing.push('Home Address');
        if (!deliveryAddressValue) missing.push('Delivery Address');

        if (missing.length) {
                console.warn('[CollectAddresses] Validation failed, missing fields:', missing);
                throw new Error(`Please fill in the following required fields: ${missing.join(', ')}`);
        }

        if (!validateEmail(email)) {
            throw new Error('Please enter a valid email address.');
        }

        if (!validateZAFormattedPhone(phoneDigits)) {
            throw new Error('Please enter a valid South African phone number (e.g., 0XXXXXXXXX or +27XXXXXXXXX).');
        }

        console.log('[CollectAddresses] Saving profile to Emergency_Profiles');
        const { savedProfile } = await saveEmergencyProfile({
            userId: user.id,
            email,
            fullName,
            phone: phoneDigits,
            whatsAppNumber: whatsAppDigits,
            smsConsent,
            waConsent,
            homeAddress: homeAddressValue,
            deliveryAddress: deliveryAddressValue
        });
        console.log('[CollectAddresses] Profile saved OK. id:', savedProfile?._id);
        return { user, email, savedProfile };
    };

    const withUi = async (fn) => {
        // Hide error text safely
        try {
            errorText?.hide?.();
        } catch (e) {
            console.warn('[CollectAddresses] Error hiding errorText in withUi:', e?.message);
        }
        
        // Disable submit button safely
        try {
            submitBtn?.disable?.();
        } catch (e) {
            console.warn('[CollectAddresses] Error disabling submitBtn in withUi:', e?.message);
        }
        
        // Show loading spinner safely (optional element)
        safeLoadingSpinner.show();
        
        try { 
            await fn(); 
        }
        catch (err) {
            const msg = err?.message || 'Something went wrong. Please try again.';
            try {
                if (errorText && typeof errorText.text !== 'undefined') { 
                    errorText.text = msg; 
                }
                errorText?.show?.();
            } catch (e) {
                console.warn('[CollectAddresses] Error showing error message:', e?.message);
            }
            console.error('[CollectAddresses] Action error:', { name: err?.name, message: err?.message });
            if (err?.stack) console.error('[CollectAddresses] Stack:', err.stack);
        } finally {
            // Re-enable submit button safely
            try {
                submitBtn?.enable?.();
            } catch (e) {
                console.warn('[CollectAddresses] Error enabling submitBtn in withUi finally:', e?.message);
            }
            
            // Hide loading spinner safely (optional element)
            safeLoadingSpinner.hide();
        }
    };

    // Unified Continue handler
    const doContinue = async () => {
        console.log('[CollectAddresses] Continue clicked');
        await withUi(async () => {
            const { user, email } = await collectValidateAndSave();
            console.log('[CollectAddresses] Redirecting to /confirm-sign-up');
            wixLocation.to('/confirm-sign-up');
        });
    };

    // Submit handler (save and go to Confirm-Sign-up)
    try {
        if (submitBtn && typeof submitBtn.onClick === 'function') {
            submitBtn.onClick(doContinue);
            console.log('[CollectAddresses] Bound click to #submitBtn');
        } else {
            console.warn('[CollectAddresses] #submitBtn not found or not clickable');
        }
    } catch (bindErr) {
        console.error('[CollectAddresses] Error binding #submitBtn:', bindErr?.message);
    }

    // Cancel handler
    cancelBtn?.onClick(() => {
        wixWindow.lightbox.close(null);
    });

    // Fallback: attach to common alternative IDs (silently fails for optional elements)
    const tryAttach = (id, handler) => {
        try {
            const c = el(id);
            const ok = !!(c && typeof c.onClick === 'function');
            if (ok) { 
                c.onClick(handler); 
                dbg('tryAttach: Successfully bound', id);
                return true; 
            } else if (c) {
                dbg('tryAttach: Element exists but onClick not supported for', id);
            } else {
                dbg('tryAttach: Element not found:', id);
            }
        } catch(e) {
            dbg('tryAttach error for', id, ':', e?.message);
        }
        return false;
    };
    // Submit/Continue fallbacks - try multiple common IDs, fail silently if not clickable
    const continueSelectors = ['#confirmBtn', '#continueBtn', '#Continue', '#continue', '#continueButton', '#btnContinue', '#saveBtn'];  
    let continueBound = false;
    continueSelectors.forEach(sel => { 
        if (tryAttach(sel, doContinue)) { 
            console.log('[CollectAddresses] Continue bound to', sel); 
            continueBound = true; 
        } 
    });
    if (!continueBound && !submitBtn) {
        console.warn('[CollectAddresses] No Continue button bound. Ensure the button ID is one of:', continueSelectors.join(', '), 'or #submitBtn');
        console.warn('[CollectAddresses] Check that your continue/submit button has one of these IDs in the Wix Editor.');
    }
    // Cancel fallbacks - try multiple common IDs, fail silently if not clickable
    ['#closeBtn', '#dismissBtn', '#cancelButton'].forEach(sel => tryAttach(sel, () => wixWindow.lightbox.close(null)));

    // Optional: PayFast / Paystack buttons inside lightbox (if present)
    const handlePayfast = async () => {
        await withUi(async () => {
            const { user, email } = await collectValidateAndSave();
            console.log('[CollectAddresses] Creating PayFast payment URL');
            const url = await createSimplePayfastPayment(user.id, email);
            console.log('[CollectAddresses] Redirecting to PayFast URL');
            wixLocation.to(url);
        });
    };
    const handlePaystack = async () => {
        await withUi(async () => {
            const { user, email } = await collectValidateAndSave();
            console.log('[CollectAddresses] Creating Paystack payment URL');
            const url = await createPaystackPayment(user.id, email);
            console.log('[CollectAddresses] Redirecting to Paystack URL');
            wixLocation.to(url);
        });
    };
    // Attach to likely IDs if those buttons exist on the lightbox
    tryAttach('#PayfastPay', handlePayfast) || tryAttach('#payfastPayButton', handlePayfast);
    tryAttach('#PaystackPay', handlePaystack) || tryAttach('#paystackPayButton', handlePaystack);
    
    } catch (globalError) {
        console.error('[CollectAddresses] Global initialization error:', globalError);
        console.error('[CollectAddresses] This may indicate element ID mismatches or missing elements in the Wix Editor');
    }
});
