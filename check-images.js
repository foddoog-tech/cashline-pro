const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const products = await p.product.findMany({
        where: { imageUrl: { not: null } },
        select: { name: true, imageUrl: true, merchantId: true },
        take: 10,
    });

    console.log('\n=== المنتجات التي لها صور ===');
    products.forEach(pr => {
        console.log(`📸 ${pr.name}: "${pr.imageUrl}"`);
    });

    const noImage = await p.product.count({ where: { imageUrl: null } });
    const withImage = await p.product.count({ where: { imageUrl: { not: null } } });
    console.log(`\n📊 بصور: ${withImage} | بدون صور: ${noImage}`);
}

main().catch(e => console.error('❌', e.message)).finally(() => p.$disconnect());
