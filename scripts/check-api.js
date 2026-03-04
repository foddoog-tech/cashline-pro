const axios = require('axios');

async function check() {
    try {
        const login = await axios.post('http://localhost:5000/api/v1/auth/login', {
            phone: '+967777777777',
            password: 'Admin@123'
        });
        const token = login.data.data.token;
        console.log('Token fetched');

        const res = await axios.get('http://localhost:5000/api/v1/admin/approvals/f3493026-43a4-4715-bef3-c9c1ad4e212d', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

check();
