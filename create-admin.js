const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function createAdminUser() {
    console.log('\n🔐 إنشاء مستخدم Admin افتراضي...\n');

    try {
        // التحقق من وجود Admin
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' }
        });

        if (existingAdmin) {
            console.log('⚠️  يوجد مستخدم Super Admin بالفعل!');
            console.log('📧 الهاتف:', existingAdmin.phone);
            console.log('👤 الاسم:', existingAdmin.fullName);
            console.log('\n💡 إذا نسيت كلمة المرور، يمكنك حذف المستخدم وإعادة تشغيل هذا السكريبت\n');
            return;
        }

        // بيانات Admin الافتراضي
        const adminData = {
            phone: '+967777777777',
            password: 'Admin@123',
            fullName: 'Super Admin',
            email: 'admin@cashline.app'
        };

        console.log('📝 بيانات المستخدم:');
        console.log('   الهاتف:', adminData.phone);
        console.log('   كلمة المرور:', adminData.password);
        console.log('   الاسم:', adminData.fullName);
        console.log('   البريد:', adminData.email);
        console.log('');

        // تشفير كلمة المرور
        const passwordHash = await bcrypt.hash(adminData.password, 10);

        // إنشاء المستخدم
        const user = await prisma.user.create({
            data: {
                phone: adminData.phone,
                passwordHash: passwordHash,
                role: 'SUPER_ADMIN',
                fullName: adminData.fullName,
                email: adminData.email,
                isActive: true
            }
        });

        // إنشاء سجل Admin
        await prisma.admin.create({
            data: {
                userId: user.id,
                permissions: ['users', 'orders', 'finance', 'settings', 'merchants', 'drivers']
            }
        });

        console.log('✅ تم إنشاء مستخدم Super Admin بنجاح!');
        console.log('');
        console.log('🔑 بيانات تسجيل الدخول:');
        console.log('   الهاتف:', adminData.phone);
        console.log('   كلمة المرور:', adminData.password);
        console.log('');
        console.log('⚠️  تأكد من تغيير كلمة المرور بعد أول تسجيل دخول!');
        console.log('');

    } catch (error) {
        console.error('❌ حدث خطأ أثناء إنشاء المستخدم:');
        console.error(error.message);

        if (error.code === 'P2002') {
            console.log('\n💡 المستخدم موجود بالفعل! استخدم رقم هاتف مختلف.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

// إنشاء مستخدمين تجريبيين آخرين
async function createTestUsers() {
    console.log('\n👥 إنشاء مستخدمين تجريبيين...\n');

    try {
        // مستخدم زبون
        const customerPassword = await bcrypt.hash('Customer@123', 10);
        const customer = await prisma.user.create({
            data: {
                phone: '+967711111111',
                passwordHash: customerPassword,
                role: 'CUSTOMER',
                fullName: 'أحمد محمد',
                email: 'customer@test.com',
                customer: {
                    create: {
                        address: 'صنعاء، شارع الزبيري',
                        lat: 15.3694,
                        lng: 44.1910,
                        building: 'بناية 5',
                        floor: '3',
                        apartment: '12'
                    }
                }
            }
        });
        console.log('✅ تم إنشاء زبون تجريبي:', customer.phone);

        // مستخدم تاجر
        const merchantPassword = await bcrypt.hash('Merchant@123', 10);
        const merchant = await prisma.user.create({
            data: {
                phone: '+967722222222',
                passwordHash: merchantPassword,
                role: 'MERCHANT',
                fullName: 'محمد علي',
                email: 'merchant@test.com',
                merchant: {
                    create: {
                        type: 'MERCHANT',
                        storeName: 'متجر الخير',
                        description: 'متجر لبيع المواد الغذائية',
                        idImageUrl: 'https://example.com/id.jpg',
                        address: 'صنعاء، شارع حدة',
                        lat: 15.3547,
                        lng: 44.2066,
                        bankName: 'بنك اليمن الدولي',
                        accountNumber: '1234567890',
                        accountName: 'محمد علي',
                        isApproved: true
                    }
                }
            }
        });
        console.log('✅ تم إنشاء تاجر تجريبي:', merchant.phone);

        // مستخدم مندوب
        const driverPassword = await bcrypt.hash('Driver@123', 10);
        const driver = await prisma.user.create({
            data: {
                phone: '+967733333333',
                passwordHash: driverPassword,
                role: 'DRIVER',
                fullName: 'خالد حسن',
                email: 'driver@test.com',
                driver: {
                    create: {
                        vehicleType: 'دراجة نارية',
                        vehicleNumber: 'ABC-123',
                        idImageUrl: 'https://example.com/id.jpg',
                        licenseImageUrl: 'https://example.com/license.jpg',
                        bankName: 'بنك التضامن',
                        accountNumber: '9876543210',
                        accountName: 'خالد حسن',
                        isApproved: true,
                        isAvailable: true
                    }
                }
            }
        });
        console.log('✅ تم إنشاء مندوب تجريبي:', driver.phone);

        console.log('\n📋 ملخص المستخدمين التجريبيين:');
        console.log('');
        console.log('1. زبون:');
        console.log('   الهاتف: +967711111111');
        console.log('   كلمة المرور: Customer@123');
        console.log('');
        console.log('2. تاجر:');
        console.log('   الهاتف: +967722222222');
        console.log('   كلمة المرور: Merchant@123');
        console.log('');
        console.log('3. مندوب:');
        console.log('   الهاتف: +967733333333');
        console.log('   كلمة المرور: Driver@123');
        console.log('');

    } catch (error) {
        if (error.code === 'P2002') {
            console.log('⚠️  المستخدمون التجريبيون موجودون بالفعل!');
        } else {
            console.error('❌ خطأ:', error.message);
        }
    }
}

async function main() {
    await createAdminUser();

    console.log('─────────────────────────────────────────');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('\n❓ هل تريد إنشاء مستخدمين تجريبيين؟ (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            await createTestUsers();
        }

        readline.close();
        await prisma.$disconnect();
        console.log('\n✅ تم الانتهاء!\n');
    });
}

main();
