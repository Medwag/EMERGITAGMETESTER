// http-functions/payfast-itn.js
// PayFast ITN (Instant Transaction Notification) HTTP Function
import { processPayFastWebhook } from 'backend/payfast-itn-handler.jsw';

export function post_payfastItn(request) {
    return processPayFastWebhook(request);
}

export function get_payfastItn(request) {
    // PayFast sometimes sends a GET request to verify the endpoint exists
    return {
        status: 200,
        body: 'PayFast ITN endpoint active',
        headers: {
            'Content-Type': 'text/plain'
        }
    };
}