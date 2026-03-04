const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    log: ['error', 'warn'],
});

async function simpleTest() {
    console.log('\n🔍 اختبار الاتصال بقاعدة البيانات...\n');
    console.log('📍 DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

    try {
        await prisma.$connect();
        console.log('✅ نجح الاتصال بقاعدة البيانات!\n');

        // اختبار استعلام بسيط
        const result = await prisma.$queryRaw`SELECT NOW() as time, version() as version`;
        console.log('⏰ وقت قاعدة البيانات:', result[0].time);
        console.log('📦 إصدار PostgreSQL:', result[0].version.split(' ')[0], result[0].version.split(' ')[1]);

        // التحقق من الجداول الموجودة
        const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

        console.log('\n📊 الجداول الموجودة في قاعدة البيانات:');
        if (tables.length === 0) {
            console.log('   ⚠️  لا توجد جداول! يجب تشغيل Migration أو SQL Script');
        } else {
            tables.forEach((table, index) => {
                console.log(`   ${index + 1}. ${table.table_name}`);
            });
        }

        console.log('\n✅ الاختبار اكتمل بنجاح!\n');

    } catch (error) {
        console.error('\n❌ فشل الاتصال بقاعدة البيانات!\n');
        console.error('رمز الخطأ:', error.code);
        console.error('رسالة الخطأ:', error.message);

        console.log('\n💡 الحلول المقترحة:');
        console.log('1. تحقق من صحة DATABASE_URL في ملف .env');
        console.log('2. تأكد من اتصالك بالإنترنت');
        console.log('3. تحقق من بيانات الاعتماد في Supabase Dashboard');
        console.log('4. راجع ملف DATABASE_CONNECTION_GUIDE.md للمزيد من المساعدة\n');

        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

simpleTest();
