const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// إعدادات الاختبار
const API_URL = 'http://127.0.0.1:5000/api/v1';
const PHONE = '+9677' + Math.floor(Math.random() * 100000000); // رقم عشوائي
const ID_IMAGE_PATH = path.join(__dirname, 'test_id_card.jpg');

async function runTest() {
    console.log('🚀 بدء اختبار التسجيل الكامل...');

    // 1. إنشاء صورة وهمية للاختبار إذا لم تكن موجودة
    if (!fs.existsSync(ID_IMAGE_PATH)) {
        fs.writeFileSync(ID_IMAGE_PATH, 'fake image content');
        console.log('📸 تم إنشاء صورة وهمية للاختبار.');
    }

    try {
        // 2. رفع الصورة
        console.log('\n📤 جاري رفع صورة الهوية...');
        const formData = new FormData();
        // نحتاج التحايل قليلاً لأن السيرفر يتوقع ملف صورة حقيقي
        // سنرسل ملف نصي لكن نقول للسيرفر أنه image/jpeg
        formData.append('file', fs.createReadStream(ID_IMAGE_PATH), {
            filename: 'test_id_card.jpg',
            contentType: 'image/jpeg',
        });

        const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
            headers: formData.getHeaders(),
        });

        const imageUrl = uploadRes.data.url || uploadRes.data.data?.url;
        console.log('✅ تم رفع الصورة بنجاح!');
        console.log('📎 رابط الصورة:', imageUrl);

        if (!imageUrl) throw new Error('لم يرجع السيرفر رابط الصورة');

        // 3. تسجيل المندوب باستخدام الرابط
        console.log('\n📝 جاري تسجيل المندوب...');
        const driverData = {
            phone: PHONE,
            password: 'Password123',
            fullName: 'تجربة محاكاة مندوب',
            vehicleType: 'motorcycle',
            vehicleNumber: 'TEST-999',
            bankName: 'Saba Bank',
            accountNumber: '11223344',
            accountName: 'تجربة محاكاة',
            idImageUrl: imageUrl, // استخدام الرابط الذي حصلنا عليه
            vehicleImageUrl: imageUrl // استخدام نفس الرابط للتجربة
        };

        const registerRes = await axios.post(`${API_URL}/auth/register/driver`, driverData);

        console.log('\n🎉 النتيجة النهائية:');
        console.log('✅ تم التسجيل بنجاح!');
        console.log('👤 بيانات المندوب:', registerRes.data.data.user);
        console.log('🔢 الحالة:', registerRes.data.message);

    } catch (error) {
        console.error('\n❌ فشل الاختبار:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

runTest();
