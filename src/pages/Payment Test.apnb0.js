// PayFast Promise Resolution Test Page
// Test if our fixes resolved the [object Promise] issue

import { quickPayFastTest } from 'backend/test-payfast-flow.jsw';

$w.onReady(function () {
    console.log('🧪 PayFast Test Page Ready');
    
    // Auto-run test on page load for quick verification
    setTimeout(async () => {
        console.log('� Auto-running PayFast test...');
        try {
            const result = await quickPayFastTest();
            console.log('📊 Auto-test result:', result);
            
            // Display result in browser console for easy viewing
            if (result.success) {
                console.log('%c✅ SUCCESS: PayFast URLs no longer contain [object Promise]', 'color: green; font-weight: bold');
                console.log(`Parameters generated: ${result.parameterCount}`);
                console.log(`Promises detected: ${result.hasPromises ? 'YES ❌' : 'NO ✅'}`);
            } else {
                console.log('%c❌ FAILED: PayFast test failed', 'color: red; font-weight: bold');
                console.log('Error:', result.error);
            }
        } catch (error) {
            console.error('Auto-test error:', error);
        }
    }, 2000);
});
