// Simple test page code - add this to a test page in Wix
// Page: /simple-test (create a new page for testing)

import { quickPayFastCheck } from 'backend/simple-diagnostic.jsw';
import { testPaystackRecovery, getDiagnosticInfo } from 'backend/simple-autofix-test.jsw';
import { comprehensivePaystackDiagnostic } from 'backend/comprehensive-paystack-diagnostic.jsw';
import wixUsers from 'wix-users';
import wixLocation from 'wix-location';

$w.onReady(function () {
    console.log('🧪 Simple Test Page Ready');
    $w('#PAYMENTTEST').onClick(async () => {
  const result = await quickPayFastCheck();
  $w('#PAYMENTTESTTEXT').text = `Status: ${result.status}\nEnvironment: ${result.environment}\nURL: ${result.baseUrl}\nMerchant ID: ${result.merchantId}`;
});
    // Add test buttons
    if ($w('#testButton')) {
        $w('#testButton').onClick(runPaystackTest);
        console.log('✅ Test button click handler attached');
    } else {
        console.warn('⚠️ #testButton element not found');
    }
    
    if ($w('#diagnosticButton')) {
        $w('#diagnosticButton').onClick(runDiagnostic);
        console.log('✅ Diagnostic button click handler attached');
    } else {
        console.warn('⚠️ #diagnosticButton element not found');
    }
    
    if ($w('#comprehensiveButton')) {
        $w('#comprehensiveButton').onClick(runComprehensiveDiagnostic);
        console.log('✅ Comprehensive diagnostic button click handler attached');
    } else {
        console.warn('⚠️ #comprehensiveButton element not found');
    }
    
    // Auto-run test if email is provided
    const query = wixLocation.query;
    const testEmail = query.email;
    if (testEmail) {
        console.log(`🎯 Auto-testing email from URL: ${testEmail}`);
        setTimeout(() => runPaystackTestForEmail(testEmail), 1000);
    }
    
    // Define functions within the onReady scope
    async function runPaystackTest() {
        console.log('🧪 Starting Paystack test...');
        
        try {
            // Get current user's email
            const currentUser = wixUsers.currentUser;
            
            if (!currentUser.loggedIn) {
                console.log('❌ No user logged in');
                if ($w('#resultText')) {
                    $w('#resultText').text = 'Please log in first';
                }
                return;
            }
            
            const userEmail = await currentUser.getEmail();
            console.log(`📧 Testing with logged-in user email: ${userEmail}`);
            
            await runPaystackTestForEmail(userEmail);
            
        } catch (error) {
            console.error('❌ Test error:', error);
            if ($w('#resultText')) {
                $w('#resultText').text = `Error: ${error.message}`;
            }
        }
    }

    async function runPaystackTestForEmail(email) {
        console.log(`🧪 Testing Paystack recovery for: ${email}`);
        
        if ($w('#resultText')) {
            $w('#resultText').text = `Testing ${email}... Please wait...`;
        }
        
        try {
            const result = await testPaystackRecovery(email);
            
            console.log('📋 Test result:', result);
            
            // Only show non-sensitive Paystack result fields
            let paystackSummary = '';
            if (result.success && result.paystack_result) {
                // Example: show only status and reference
                paystackSummary = `Status: ${result.paystack_result.status || 'N/A'}, Reference: ${result.paystack_result.reference || 'N/A'}`;
            }
            const resultText = result.success 
                ? `✅ SUCCESS!\n${paystackSummary}\nProfiles Found: ${result.profiles_found}`
                : `❌ FAILED: ${result.error}`;
                
            if ($w('#resultText')) {
                $w('#resultText').text = resultText;
            }
            
            // Show detailed logs in console
            if (result.success && result.profiles.length > 0) {
                console.log('📊 Profile details:');
                result.profiles.forEach((profile, index) => {
                    console.log(`Profile ${index + 1}:`, profile);
                });
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            if ($w('#resultText')) {
                $w('#resultText').text = `Error: ${error.message}`;
            }
        }
    }

    async function runDiagnostic() {
        console.log('🔍 Running diagnostic...');
        
        if ($w('#resultText')) {
            $w('#resultText').text = 'Running diagnostic... Please wait...';
        }
        
        try {
            const result = await getDiagnosticInfo();
            
            console.log('📊 Diagnostic result:', result);
            
            const resultText = result.error 
                ? `❌ Diagnostic failed: ${result.error}`
                : `✅ Diagnostic complete!\nRecent Profiles: ${result.recent_profiles.length}\nRecent Transactions: ${result.recent_transactions.length}`;
                
            if ($w('#resultText')) {
                $w('#resultText').text = resultText;
            }
            
        } catch (error) {
            console.error('❌ Diagnostic failed:', error);
            if ($w('#resultText')) {
                $w('#resultText').text = `Error: ${error.message}`;
            }
        }
    }

    async function runComprehensiveDiagnostic() {
        console.log('🔍 Running COMPREHENSIVE diagnostic...');
        
        // Show initial progress
        if ($w('#resultText')) {
            $w('#resultText').text = '🔍 STARTING COMPREHENSIVE DIAGNOSTIC...\n\nThis will take 30-60 seconds.\nAnalyzing all Paystack data sources...\n\n⏳ Please wait...';
        }
        
        try {
            // Get current user's email
            const currentUser = wixUsers.currentUser;
            
            if (!currentUser.loggedIn) {
                console.log('❌ No user logged in');
                if ($w('#resultText')) {
                    $w('#resultText').text = 'Please log in first to run comprehensive diagnostic';
                }
                return;
            }
            
            const userEmail = await currentUser.getEmail();
            console.log(`📧 Running comprehensive diagnostic for: ${userEmail}`);
            
            // Update progress
            if ($w('#resultText')) {
                $w('#resultText').text = `🔍 COMPREHENSIVE DIAGNOSTIC RUNNING...\n\nEmail: ${userEmail}\n\n🔄 Extracting data from Paystack APIs...\n⏳ This may take 30-60 seconds...`;
            }
            
            console.log('🚀 Calling comprehensive diagnostic backend function...');
            const result = await comprehensivePaystackDiagnostic(userEmail);
            
            console.log('📊 Comprehensive diagnostic result:', result);
            
            if (result.success) {
                const diagnostic = result.diagnostic;
                
                // Create comprehensive result summary
                let resultText = `🔍 COMPREHENSIVE DIAGNOSTIC COMPLETE!\n`;
                resultText += `📧 Email: ${userEmail}\n`;
                resultText += `⏰ Completed: ${new Date().toLocaleString()}\n`;
                resultText += `═══════════════════════════════════════\n\n`;
                
                // Summary section with emoji indicators
                resultText += `📊 DATA SUMMARY:\n`;
                const customerCount = diagnostic.paystack_data.customers?.total_found || 0;
                const transactionCount = diagnostic.paystack_data.transactions?.total_found || 0;
                const subscriptionCount = diagnostic.paystack_data.subscriptions?.total_found || 0;
                const profileCount = diagnostic.cms_data.emergency_profiles?.total_found || 0;
                
                resultText += `${customerCount > 0 ? '✅' : '❌'} Paystack Customers: ${customerCount}\n`;
                resultText += `${transactionCount > 0 ? '✅' : '❌'} Paystack Transactions: ${transactionCount}\n`;
                resultText += `${subscriptionCount > 0 ? '✅' : '❌'} Paystack Subscriptions: ${subscriptionCount}\n`;
                resultText += `${profileCount > 0 ? '✅' : '❌'} CMS Profiles: ${profileCount}\n`;
                resultText += `\n`;
                
                // Status indicator
                if (subscriptionCount > 0) {
                    resultText += `🎉 SUBSCRIPTION DATA FOUND!\n\n`;
                } else if (customerCount > 0 || transactionCount > 0) {
                    resultText += `⚠️ PAYSTACK DATA EXISTS BUT NO SUBSCRIPTIONS!\n\n`;
                } else {
                    resultText += `❌ NO PAYSTACK DATA FOUND!\n\n`;
                }
                
                // Issues section with priority indicators
                if (diagnostic.analysis.potential_issues.length > 0) {
                    resultText += `🚨 ISSUES IDENTIFIED (${diagnostic.analysis.potential_issues.length}):\n`;
                    diagnostic.analysis.potential_issues.forEach((issue, index) => {
                        resultText += `${index + 1}. ${issue.replace(/_/g, ' ')}\n`;
                    });
                    resultText += `\n`;
                }
                
                // Top priority recommendations
                if (diagnostic.recommendations.length > 0) {
                    resultText += `💡 PRIORITY ACTIONS NEEDED:\n`;
                    diagnostic.recommendations.slice(0, 3).forEach((rec, index) => {
                        const priorityEmoji = rec.priority === 'CRITICAL' ? '🔴' : rec.priority === 'HIGH' ? '🟡' : '🟢';
                        resultText += `${index + 1}. ${priorityEmoji} [${rec.priority}] ${rec.recommendation}\n`;
                    });
                    resultText += `\n`;
                }
                
                // Key findings with details
                if (diagnostic.paystack_data.customers?.total_found > 0) {
                    const customer = diagnostic.paystack_data.customers.found[0];
                    resultText += `👤 PAYSTACK CUSTOMER FOUND:\n`;
                    resultText += `• Code: ${customer.customer_code || 'N/A'}\n`;
                    resultText += `• Email: ${customer.email || 'N/A'}\n`;
                    resultText += `• Created: ${customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}\n`;
                    resultText += `• Method: ${customer.found_by || 'N/A'}\n\n`;
                }
                
                if (diagnostic.paystack_data.transactions?.total_found > 0) {
                    const latestTx = diagnostic.paystack_data.transactions.found[0];
                    const successfulTxs = diagnostic.paystack_data.transactions.found.filter(t => t.status === 'success').length;
                    resultText += `💰 TRANSACTION DATA:\n`;
                    resultText += `• Total Found: ${diagnostic.paystack_data.transactions.total_found}\n`;
                    resultText += `• Successful: ${successfulTxs}\n`;
                    resultText += `• Latest Reference: ${latestTx.reference || 'N/A'}\n`;
                    resultText += `• Latest Amount: R${(latestTx.amount/100) || 'N/A'}\n`;
                    resultText += `• Latest Status: ${latestTx.status || 'N/A'}\n`;
                    resultText += `• Latest Date: ${latestTx.created_at ? new Date(latestTx.created_at).toLocaleDateString() : 'N/A'}\n\n`;
                }
                
                if (diagnostic.paystack_data.subscriptions?.total_found > 0) {
                    const subscription = diagnostic.paystack_data.subscriptions.found[0];
                    const activeSubs = diagnostic.paystack_data.subscriptions.found.filter(s => s.status === 'active').length;
                    resultText += `📋 SUBSCRIPTION DATA FOUND!\n`;
                    resultText += `• Total Found: ${diagnostic.paystack_data.subscriptions.total_found}\n`;
                    resultText += `• Active: ${activeSubs}\n`;
                    resultText += `• Code: ${subscription.subscription_code || 'N/A'}\n`;
                    resultText += `• Status: ${subscription.status || 'N/A'}\n`;
                    resultText += `• Plan: ${subscription.plan?.name || 'N/A'}\n`;
                    resultText += `• Amount: R${(subscription.amount/100) || 'N/A'}\n`;
                    resultText += `• Method: ${subscription.found_by || 'N/A'}\n\n`;
                }
                
                // API Status
                resultText += `� API STATUS:\n`;
                resultText += `• Secret Key: ${diagnostic.secret_key_info?.configured ? '✅ Configured' : '❌ Missing'}\n`;
                resultText += `• Environment: ${diagnostic.secret_key_info?.is_live ? '🟢 LIVE' : '🟡 TEST'}\n`;
                resultText += `• Total API Calls: ${(diagnostic.paystack_data.customers?.search_methods?.length || 0) + (diagnostic.paystack_data.transactions?.search_methods?.length || 0) + (diagnostic.paystack_data.subscriptions?.search_methods?.length || 0)}\n\n`;
                
                resultText += `═══════════════════════════════════════\n`;
                resultText += `🔍 DETAILED ANALYSIS IN BROWSER CONSOLE\n`;
                resultText += `Press F12 → Console tab for full details`;
                
                if ($w('#resultText')) {
                    $w('#resultText').text = resultText;
                }
                
                // Log comprehensive data to console with organized groups
                console.group('🔍 COMPREHENSIVE PAYSTACK DIAGNOSTIC RESULTS');
                console.log('� Email Analyzed:', userEmail);
                console.log('⏰ Analysis Timestamp:', diagnostic.timestamp);
                console.log('🔑 Secret Key Info:', diagnostic.secret_key_info);
                console.groupEnd();
                
                console.group('👤 CUSTOMER DATA ANALYSIS');
                console.log('📊 Summary:', diagnostic.paystack_data.customers);
                if (diagnostic.paystack_data.customers?.found?.length > 0) {
                    console.log('✅ Customers Found:', diagnostic.paystack_data.customers.found);
                } else {
                    console.warn('❌ No customers found via any method');
                }
                console.log('� Search Methods Used:', diagnostic.paystack_data.customers?.search_methods);
                console.groupEnd();
                
                console.group('�💰 TRANSACTION DATA ANALYSIS');
                console.log('📊 Summary:', diagnostic.paystack_data.transactions);
                if (diagnostic.paystack_data.transactions?.found?.length > 0) {
                    console.log('✅ Transactions Found:', diagnostic.paystack_data.transactions.found);
                    console.log('💰 Successful Transactions:', diagnostic.paystack_data.transactions.found.filter(t => t.status === 'success'));
                } else {
                    console.warn('❌ No transactions found via any method');
                }
                console.log('� Search Methods Used:', diagnostic.paystack_data.transactions?.search_methods);
                console.groupEnd();
                
                console.group('�📋 SUBSCRIPTION DATA ANALYSIS');
                console.log('📊 Summary:', diagnostic.paystack_data.subscriptions);
                if (diagnostic.paystack_data.subscriptions?.found?.length > 0) {
                    console.log('✅ Subscriptions Found:', diagnostic.paystack_data.subscriptions.found);
                    console.log('� Active Subscriptions:', diagnostic.paystack_data.subscriptions.found.filter(s => s.status === 'active'));
                } else {
                    console.warn('❌ NO SUBSCRIPTIONS FOUND - This is likely the main issue!');
                }
                console.log('🔍 Search Methods Used:', diagnostic.paystack_data.subscriptions?.search_methods);
                console.groupEnd();
                
                console.group('📊 AVAILABLE PLANS');
                console.log('📋 All Plans in Account:', diagnostic.paystack_data.plans);
                console.groupEnd();
                
                console.group('🗄️ LOCAL CMS DATA');
                console.log('📊 Emergency Profiles:', diagnostic.cms_data.emergency_profiles);
                console.log('📊 Paystack Transactions:', diagnostic.cms_data.paystack_transactions);
                console.groupEnd();
                
                console.group('🧠 ANALYSIS & RECOMMENDATIONS');
                console.log('📊 Data Analysis:', diagnostic.analysis);
                console.log('💡 Recommendations:', diagnostic.recommendations);
                console.groupEnd();
                
                console.group('🎯 NEXT STEPS');
                if (subscriptionCount === 0) {
                    console.log('🔴 CRITICAL: No subscriptions found in Paystack API');
                    console.log('🔍 Check: Are subscriptions created correctly in Paystack?');
                    console.log('🔍 Check: API permissions for subscription access?');
                    console.log('🔍 Check: Email address exact match?');
                }
                if (customerCount > 0 && subscriptionCount === 0) {
                    console.log('🟡 Customer exists but no subscriptions linked');
                }
                console.groupEnd();
                
            } else {
                const errorMessage = `❌ COMPREHENSIVE DIAGNOSTIC FAILED\n\nError: ${result.error}\n\nThis could indicate:\n• API connection issues\n• Invalid secret key\n• Network problems\n\nCheck browser console for details`;
                
                if ($w('#resultText')) {
                    $w('#resultText').text = errorMessage;
                }
                
                console.error('❌ Comprehensive diagnostic failed:', result);
            }
            
        } catch (error) {
            console.error('❌ Comprehensive diagnostic failed:', error);
            const errorMessage = `❌ DIAGNOSTIC ERROR\n\nError: ${error.message}\n\nThis could indicate:\n• Backend function not found\n• API connection issues\n• Authentication problems\n\nCheck browser console for full error details`;
            
            if ($w('#resultText')) {
                $w('#resultText').text = errorMessage;
            }
        }
    }
});