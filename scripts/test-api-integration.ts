import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1';

async function testApi() {
    console.log('--- Phase 3 API Integration Test (Detailed) ---');

    try {
        // 1. Login
        console.log('Logging in with +967777777777...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            phone: '+967777777777',
            password: 'Admin@123'
        });

        const token = loginRes.data.data.token;
        console.log('✅ Login Successful');

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Get Merchant Details
        const merchantId = 'f3493026-43a4-4715-bef3-c9c1ad4e212d';
        console.log(`Fetching details for merchant: ${merchantId}`);

        try {
            const detailsRes = await axios.get(`${API_URL}/admin/approvals/${merchantId}`, { headers });
            const data = detailsRes.data.data;
            const securityWarning = detailsRes.data.data.securityWarning; // Checked structure in controller, it's inside data

            console.log('--- Merchant Verification ---');
            console.log('Bank Name:', data.businessInfo.bankAccount?.bank);
            console.log('Account Number:', data.businessInfo.bankAccount?.number);
            console.log('Source:', data.businessInfo.bankAccount?.source);
            console.log('Security Warning:', data.securityWarning);

            console.log('Wallet Data:', data.wallet);

            if (data.businessInfo.bankAccount?.number === '1234567890123456' && data.businessInfo.bankAccount?.source === 'encrypted') {
                console.log('✅ BANK DECRYPTION TEST: PASSED');
            } else {
                console.log('❌ BANK DECRYPTION TEST: FAILED');
            }

            if (data.wallet && Number(data.wallet.balance) === 5000) {
                console.log('✅ WALLET BALANCE TEST: PASSED');
            } else {
                console.log('❌ WALLET BALANCE TEST: FAILED (Balance might be different if hold was subtracted improperly or types mismatch)');
                console.log('Actual Balance Type:', typeof data.wallet?.balance, 'Value:', data.wallet?.balance);
            }
        } catch (err: any) {
            console.error('❌ Error fetching merchant details:', err.response?.data || err.message);
        }

        // 3. Get Withdrawals
        console.log('Fetching withdrawals...');
        try {
            const withdrawalRes = await axios.get(`${API_URL}/admin/finance/withdrawals`, { headers });
            const withdrawals = withdrawalRes.data.data.withdrawals;
            console.log(`✅ Found ${withdrawals.length} withdrawals`);
        } catch (err: any) {
            console.error('❌ Error fetching withdrawals:', err.response?.data || err.message);
        }

    } catch (error: any) {
        console.error('❌ Global Test Error:', error.response?.data || error.message);
    }
}

testApi();
