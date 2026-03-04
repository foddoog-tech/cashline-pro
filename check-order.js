const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // تحقق من أول منتج
    const product = await p.product.findFirst();
    console.log('📦 Sample product:');
    console.log('  name:', product?.name);
    console.log('  stock:', product?.stock);
    console.log('  merchantId:', product?.merchantId);
    console.log('  price:', product?.price?.toString());

    // تحقق من تاجر بـ userId
    const merchant = await p.merchant.findFirst({
        where: { userId: product?.merchantId }
    });
    console.log('\n🏪 Merchant by userId:', merchant ? merchant.storeName : '❌ NOT FOUND');

    // تحقق من أن merchantId في product هو فعلاً userId التاجر
    const merchantById = await p.merchant.findUnique({
        where: { id: product?.merchantId }
    });
    console.log('🏪 Merchant by id:', merchantById ? merchantById.storeName : '❌ NOT FOUND by id');

    // اعرض أول 3 منتجات مع stock
    const products = await p.product.findMany({ take: 3 });
    console.log('\n📋 Products stock check:');
    products.forEach(pr => {
        console.log(`  - ${pr.name}: stock=${pr.stock}, merchantId=${pr.merchantId}`);
    });

    await p.$disconnect();
}

main().catch(e => { console.error('Error:', e.message); p.$disconnect(); });
