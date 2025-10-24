# PayFast Integration Documentation

## Overview
Complete PayFast payment gateway integration for EmergiTag signup payments and subscriptions. This integration provides a robust alternative to Paystack and enables dual gateway functionality.

## Architecture Components

### 1. Configuration Management (`payfast-config.jsw`)
**Purpose**: Centralized PayFast configuration management with environment-specific settings.

**Key Features**:
- Environment-specific credential management (sandbox/live)
- Automatic URL routing based on environment
- Comprehensive validation and error handling
- Secure credential storage via Wix Secrets Backend

**Usage**:
```javascript
import { getPayFastConfig, getPayFastPaymentUrl } from 'backend/payfast-config.jsw';

const config = await getPayFastConfig();
const credentials = config.getCredentials();
const paymentUrl = getPayFastPaymentUrl();
```

### 2. PayFast Utilities (`payfastUtils.jsw`)
**Purpose**: Core PayFast utility functions for signature validation, ITN parsing, and parameter handling.

**Key Features**:
- PayFast signature validation with detailed results
- ITN (Instant Transaction Notification) parsing
- Signup parameter generation with proper encoding
- IP address validation for PayFast servers
- Comprehensive error handling and logging

**Usage**:
```javascript
import { 
    validatePayFastParams, 
    generatePayFastSignature,
    parsePayFastITN,
    createPayFastSignupParams 
} from 'backend/payfastUtils.jsw';
```

### 3. URL Generation (`payfastUrl.jsw`)
**Purpose**: Enhanced PayFast payment URL generation for signup and subscription payments.

**Key Features**:
- Signup payment URL generation with user context
- Subscription payment URL generation with recurring billing
- Automatic signature generation and validation
- Comprehensive error handling and logging

**Usage**:
```javascript
import { 
    generatePayFastUrl, 
    generatePayFastSubscriptionUrl,
    validatePayFastConfiguration 
} from 'backend/payfastUrl.jsw';

const paymentUrl = await generatePayFastUrl(userId, 5.00);
```

### 4. ITN Handler (`payfast-itn-handler.jsw`)
**Purpose**: Complete PayFast ITN processing with comprehensive validation and CMS synchronization.

**Key Features**:
- Multi-stage ITN validation (IP, signature, data)
- Payment status processing (COMPLETE, FAILED, CANCELLED)
- CMS profile synchronization
- Comprehensive error logging and recovery

**Usage**:
```javascript
import { handlePayFastITN, processPayFastWebhook } from 'backend/payfast-itn-handler.jsw';

const result = await handlePayFastITN(itnData, sourceIp);
```

### 5. Signup Payment Detection (`payfast-signup-detector.jsw`)
**Purpose**: PayFast-specific signup payment detection with confidence scoring.

**Key Features**:
- Multi-strategy payment detection
- Reference pattern matching
- CMS record searching
- Confidence-based result scoring

**Usage**:
```javascript
import { 
    searchPayFastSignupPayments, 
    validatePayFastSignupPayment 
} from 'backend/payfast-signup-detector.jsw';

const result = await searchPayFastSignupPayments(userId, options);
```

### 6. Dual Gateway Detection (`signup-payment-detector-dual.jsw`)
**Purpose**: Unified signup payment detection across both Paystack and PayFast.

**Key Features**:
- Parallel payment provider searching
- Cross-provider result analysis
- Comprehensive payment statistics
- Automatic CMS profile updates

**Usage**:
```javascript
import { 
    detectSignupPayment, 
    searchSignupPaymentsAcrossProviders,
    getPaymentStatistics 
} from 'backend/signup-payment-detector-dual.jsw';

const result = await detectSignupPayment(userId, options);
```

## Configuration Requirements

### Wix Secrets Backend Setup
Add the following secrets in Wix Secrets Manager:

**For Sandbox Environment**:
- `payfastMerchantId`: PayFast merchant ID (test)
- `payfastMerchantKey`: PayFast merchant key (test)
- `payfastPassphrase`: PayFast passphrase (optional, but recommended)

**For Live Environment**:
- `payfastLiveMerchantId`: PayFast live merchant ID
- `payfastLiveMerchantKey`: PayFast live merchant key  
- `payfastLivePassphrase`: PayFast live passphrase

**Environment Control**:
- `payfastEnvironment`: Set to "live" for production, "sandbox" for testing

### HTTP Functions Setup
Configure the following HTTP functions for ITN handling:

1. **PayFast ITN Endpoint**: `/_functions/payfast-itn`
   ```javascript
   import { processPayFastWebhook } from 'backend/payfast-itn-handler.jsw';
   
   export function post_payfastItn(request) {
       return processPayFastWebhook(request);
   }
   ```

2. **PayFast Return URL**: Configure in PayFast dashboard
   - Success: `https://yourdomain.com/payment-success`
   - Cancel: `https://yourdomain.com/payment-cancelled`
   - Notify: `https://yourdomain.com/_functions/payfast-itn`

## Emergency_Profiles CMS Integration

### Required Fields
Ensure the following fields exist in your `Emergency_Profiles` collection:

```javascript
{
    // Existing fields...
    "signUpPaid": Boolean,
    "signUpReference": String,
    "joinedDate": Date,
    "paymentProvider": String,  // "paystack" or "payfast"
    "paymentAmount": Number,
    "paymentDetectionConfidence": Number,
    "paystackCustomerCode": String,
    "lastUpdated": Date
}
```

## Integration Workflow

### 1. Signup Payment Flow
```javascript
// 1. Generate PayFast payment URL
const paymentUrl = await generatePayFastUrl(userId, 5.00);

// 2. Redirect user to PayFast
// User completes payment...

// 3. PayFast sends ITN to your webhook
// ITN is automatically processed by payfast-itn-handler.jsw

// 4. User profile is updated with payment status
// CMS Emergency_Profiles is synchronized
```

### 2. Dashboard Access Validation
```javascript
// Enhanced subscription detector now includes dual gateway detection
const detection = await detectUserSubscriptions(email, userId);

// Check results
if (detection.success) {
    const hasAccess = detection.plan_assignment.access !== 'limited';
    const signupPaid = detection.signup_payment_status?.paymentDetected;
    
    console.log('User access level:', detection.plan_assignment.tier);
    console.log('Signup payment confirmed:', signupPaid);
}
```

### 3. Payment Detection and Recovery
```javascript
// Comprehensive payment detection across both providers
const result = await detectSignupPayment(userId, {
    timeWindow: 90,
    includePartialMatches: true
});

if (result.paymentDetected) {
    console.log(`Payment found via ${result.provider}`);
    console.log(`Confidence: ${result.confidence}%`);
}
```

## Error Handling and Recovery

### Common Issues and Solutions

1. **Signature Validation Failures**
   - Verify passphrase configuration
   - Check parameter encoding
   - Ensure all required parameters are present

2. **ITN Processing Failures**
   - Validate PayFast IP addresses
   - Check ITN data completeness
   - Review webhook endpoint configuration

3. **Payment Detection Issues**
   - Increase time window for searches
   - Check reference pattern generation
   - Verify CMS data integrity

### Debugging Tools

```javascript
// Configuration validation
const validation = await validatePayFastConfiguration();
console.log('Config valid:', validation.isValid);

// Payment statistics
const stats = await getPaymentStatistics({ timeRange: 30 });
console.log('Payment stats:', stats);

// Cross-provider search
const searchResults = await searchSignupPaymentsAcrossProviders(userId);
console.log('All providers:', searchResults);
```

## Security Considerations

1. **Signature Validation**: All PayFast communications are signature-validated
2. **IP Validation**: ITNs are validated against PayFast server IPs
3. **Secure Configuration**: All credentials stored in Wix Secrets Backend
4. **Error Logging**: Comprehensive logging without exposing sensitive data

## Testing and Validation

### Sandbox Testing
1. Use PayFast sandbox credentials
2. Test signup payment flow
3. Verify ITN processing
4. Confirm CMS updates

### Production Deployment
1. Update credentials to live environment
2. Set `payfastEnvironment` to "live"
3. Test with small amounts
4. Monitor error logs

## Monitoring and Analytics

The integration provides comprehensive monitoring through:

1. **Payment Statistics Dashboard**
   - Conversion rates by provider
   - Payment success/failure rates
   - Revenue tracking

2. **Error Logging**
   - ITN processing failures
   - Signature validation issues
   - Configuration problems

3. **Detection Confidence Metrics**
   - Payment detection accuracy
   - Provider-specific success rates
   - Cross-provider validation

## Support and Maintenance

### Regular Maintenance Tasks
1. Monitor PayFast ITN logs
2. Review payment detection accuracy
3. Update reference patterns as needed
4. Validate configuration integrity

### Troubleshooting Checklist
1. Verify Wix Secrets configuration
2. Check PayFast dashboard settings
3. Review HTTP function deployment
4. Validate CMS field structure
5. Test signature generation

This comprehensive PayFast integration provides a robust, secure, and scalable payment solution that complements the existing Paystack integration and enables advanced payment detection across both providers.