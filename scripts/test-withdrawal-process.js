const axios = require('axios');

async function process() {
    try {
        const login = await axios.post('http://localhost:5000/api/v1/auth/login', {
            phone: '+967777777777',
            password: 'Admin@123'
        });

        // Correct token path based on auth.controller.ts
        const token = login.data.data.tokens.accessToken;
        console.log('Token fetched');
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Get Pending Withdrawals
        const withdrawalsRes = await axios.get('http://localhost:5000/api/v1/admin/finance/withdrawals?status=pending', { headers });
        const pending = withdrawalsRes.data.data.withdrawals;

        if (pending.length === 0) {
            console.log('No pending withdrawals found');
            return;
        }

        const withdrawal = pending[0];
        console.log(`Processing withdrawal ${withdrawal.id} for ${withdrawal.amount}...`);

        // 2. Approve
        const processRes = await axios.post(`http://localhost:5000/api/v1/admin/finance/withdrawals/${withdrawal.id}/process`, {
            action: 'approve',
            notes: 'Test Approval'
        }, { headers });

        console.log('Process Result:', processRes.data.message);

        // 3. Verify Wallet Balance
        // Driver ID was 261df07b-828c-41eb-aa8c-262a30c96c52
        const detailsRes = await axios.get(`http://localhost:5000/api/v1/admin/approvals/261df07b-828c-41eb-aa8c-262a30c96c52`, { headers });
        console.log('Driver Balance After:', detailsRes.data.data.wallet.balance);

    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

process();
