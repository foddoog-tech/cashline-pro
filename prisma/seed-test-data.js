/**
 * ✅ Customer Test Seed - CashLine
 * ينشئ حساب عميل حقيقي بـ bcrypt hash صحيح
 * الهاتف: +967771234567
 * كلمة المرور: test123456
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');   // الـ backend يستخدم 'bcrypt' (وليس 'bcryptjs')

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 إنشاء بيانات الاختبار...\n');

    const PHONE = '+967771234567';
    const PASSWORD = 'test123456';
    const hash = await bcrypt.hash(PASSWORD, 12);

    // ── 1. عميل الاختبار ──────────────────────────────────────────────────
    console.log('👤 إنشاء عميل الاختبار...');
    let customer = null;
    try { customer = await prisma.user.findUnique({ where: { phone: PHONE } }); } catch (_) { }

    if (!customer) {
        customer = await prisma.user.create({
            data: {
                phone: PHONE,
                passwordHash: hash,
                role: 'CUSTOMER',
                fullName: 'عميل الاختبار',
                isActive: true,
                customer: {
                    create: {
                        address: 'صنعاء، شارع حدة',
                        lat: 15.3694,
                        lng: 44.1910,
                    }
                }
            }
        });
        console.log('   ✅ تم! الهاتف: ' + PHONE + ' | كلمة المرور: ' + PASSWORD);
    } else {
        // تحديث الـ hash لضمان عمل الـ password
        await prisma.user.update({
            where: { phone: PHONE },
            data: { passwordHash: hash, isActive: true }
        });
        console.log('   ✅ موجود — تم تحديث كلمة المرور إلى: ' + PASSWORD);
    }

    // ── 2. تحقق من التجار الموجودين ───────────────────────────────────────
    console.log('\n🏪 التحقق من التجار...');
    const merchants = await prisma.merchant.findMany({
        where: { isApproved: true },
        include: { user: { select: { phone: true } } }
    });
    console.log('   التجار المعتمدون: ' + merchants.length);
    merchants.forEach(m => console.log('   → ' + m.storeName + ' | phone: ' + m.user.phone));

    // إذا لا يوجد تجار، ننشئ واحداً
    if (merchants.length === 0) {
        console.log('\n   لا يوجد تجار! إنشاء تاجر اختبار...');
        const mHash = await bcrypt.hash(PASSWORD, 12);
        const mPhone = '+967779876543';

        let mUser = null;
        try { mUser = await prisma.user.findUnique({ where: { phone: mPhone } }); } catch (_) { }

        if (!mUser) {
            mUser = await prisma.user.create({
                data: {
                    phone: mPhone,
                    passwordHash: mHash,
                    role: 'MERCHANT',
                    fullName: 'أحمد التاجر',
                    isActive: true,
                    merchant: {
                        create: {
                            storeName: 'سوبرماركت كاش لاين',
                            type: 'MERCHANT',
                            address: 'صنعاء، حدة',
                            lat: 15.3750,
                            lng: 44.1850,
                            isApproved: true,
                            bankName: 'البنك الأهلي',
                            accountNumber: '1234567890',
                            accountName: 'أحمد التاجر',
                            licenseNumber: 'LIC-001',
                            idImageUrl: 'https://placehold.co/400x300/0A192F/D4AF37/png?text=ID',
                            commissionRate: 0.05,
                        }
                    }
                }
            });
            console.log('   ✅ تاجر جديد: ' + mPhone);

            // إضافة منتجات
            const products = [
                { name: 'أرز بسمتي 5 كيلو', price: 3500, stock: 100, category: 'GROCERY', unit: 'كيس', imageUrl: 'https://placehold.co/300x300/0A192F/D4AF37/png?text=Rice' },
                { name: 'زيت عباد الشمس', price: 2800, stock: 50, category: 'GROCERY', unit: 'زجاجة', imageUrl: 'https://placehold.co/300x300/1E3A5F/D4AF37/png?text=Oil' },
                { name: 'سكر أبيض 2 كيلو', price: 1200, stock: 200, category: 'GROCERY', unit: 'كيس', imageUrl: 'https://placehold.co/300x300/FFFFFF/0A192F/png?text=Sugar' },
                { name: 'شاي أحمر 500 غم', price: 1800, stock: 80, category: 'GROCERY', unit: 'علبة', imageUrl: 'https://placehold.co/300x300/8B0000/FFD700/png?text=Tea' },
            ];
            for (const p of products) {
                await prisma.product.create({
                    data: { ...p, merchantId: mUser.id, isAvailable: true, status: 'APPROVED' }
                });
                console.log('   📦 ' + p.name);
            }
        }
    }

    // ── تحقق من المنتجات ──────────────────────────────────────────────────
    const products = await prisma.product.count({ where: { status: 'APPROVED' } });
    console.log('\n📦 المنتجات المعتمدة: ' + products);

    console.log('\n════════════════════════════════════════');
    console.log('✅ جاهز للاختبار!');
    console.log('🔑 الهاتف:       ' + PHONE);
    console.log('🔑 كلمة المرور:  ' + PASSWORD);
    console.log('════════════════════════════════════════\n');
}

main()
    .catch(e => { console.error('❌', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
