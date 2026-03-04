const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // أظهر كل المنتجات مع التاجر
    const products = await p.product.findMany({
        take: 5,
        include: {
            merchant: {
                select: { storeName: true, userId: true }
            }
        }
    });

    console.log('\n=== المنتجات الأولى في DB ===');
    products.forEach(pr => {
        console.log(`📦 ${pr.name} | merchantId: ${pr.merchantId} | merchant: ${pr.merchant.storeName} | available: ${pr.isAvailable} | status: ${pr.status}`);
    });

    // أظهر التجار المتاحين
    const merchants = await p.merchant.findMany({
        where: { isApproved: true },
        select: { userId: true, storeName: true }
    });
    console.log('\n=== التجار المعتمدون ===');
    merchants.forEach(m => console.log(`🏪 ${m.storeName} | userId: ${m.userId}`));
}

main()
    .catch(e => console.error('❌', e.message))
    .finally(() => p.$disconnect());
