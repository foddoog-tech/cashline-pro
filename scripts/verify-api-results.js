const axios = require('axios');

async function check() {
    try {
        const login = await axios.post('http://localhost:5000/api/v1/auth/login', {
            phone: '+967777777777',
            password: 'Admin@123'
        });
        const token = login.data.data.token;
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Check Encrypted Merchant
        const encryptedId = 'f3493026-43a4-4715-bef3-c9c1ad4e212d';
        const resEnc = await axios.get(`http://localhost:5000/api/v1/admin/approvals/${encryptedId}`, { headers });
        const dataEnc = resEnc.data.data;

        console.log('--- ENCRYPTED MERCHANT TEST ---');
        console.log('Account Number:', dataEnc.businessInfo.bankAccount.number); // 1234567890123456
        console.log('Source:', dataEnc.businessInfo.bankAccount.source); // encrypted
        console.log('Security Warning:', dataEnc.securityWarning); // null
        console.log('-------------------------------');

        // 2. Check Legacy Merchant
        const legacyId = '647997fc-fdbb-49da-b2ef-ed888e446990';
        const resLeg = await axios.get(`http://localhost:5000/api/v1/admin/approvals/${legacyId}`, { headers });
        const dataLeg = resLeg.data.data;

        console.log('--- LEGACY MERCHANT TEST ---');
        console.log('Account Number:', dataLeg.businessInfo.bankAccount.number); // 999888777
        console.log('Source:', dataLeg.businessInfo.bankAccount.source); // legacy
        console.log('Security Warning:', dataLeg.securityWarning); // Data not yet migrated...
        console.log('----------------------------');

    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

check();
