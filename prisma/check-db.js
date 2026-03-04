const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
    console.log('=== قاعدة البيانات ===');

    const merchants = await p.merchant.findMany({
        where: { isApproved: true },
        include: { user: { select: { email: true } } }
    });
    console.log('\n✅ التجار المعتمدون: ' + merchants.length);
    merchants.forEach(m => {
        console.log('  → ' + m.storeName + ' | ID: ' + m.userId + ' | email: ' + m.user.email);
    });

    const products = await p.product.findMany({
        where: { status: 'APPROVED' },
        select: { name: true, price: true, merchantId: true }
    });
    console.log('\n✅ المنتجات المعتمدة: ' + products.length);
    products.slice(0, 5).forEach(prod => {
        console.log('  → ' + prod.name + ' - ' + prod.price + ' ر.ي');
    });
    if (products.length > 5) console.log('  ... و' + (products.length - 5) + ' منتجات أخرى');

    const customers = await p.user.count({ where: { role: 'CUSTOMER' } });
    console.log('\n✅ حسابات العملاء: ' + customers);

    const orders = await p.order.count();
    console.log('✅ الطلبات الكلية: ' + orders);

    await p.$disconnect();
}

check().catch(async e => {
    console.error('❌ خطأ:', e.message);
    await p.$disconnect();
    process.exit(1);
});
