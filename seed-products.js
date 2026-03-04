const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // جلب كل التجار
    const merchants = await p.merchant.findMany({
        where: { isApproved: true },
        select: { userId: true, storeName: true }
    });

    console.log(`\n📊 إضافة منتجات لـ ${merchants.length} تاجر...`);

    const productTemplates = [
        // GROCERY
        { name: 'أرز بسمتي 5 كيلو', price: 3500, category: 'GROCERY', unit: 'كيس', stock: 150 },
        { name: 'زيت زيتون 1 لتر', price: 2200, category: 'GROCERY', unit: 'زجاجة', stock: 80 },
        { name: 'سكر أبيض 2 كيلو', price: 1200, category: 'GROCERY', unit: 'كيس', stock: 200 },
        { name: 'شاي أحمر 500 غم', price: 1800, category: 'GROCERY', unit: 'علبة', stock: 100 },
        { name: 'معكرونة 500 غم', price: 500, category: 'GROCERY', unit: 'علبة', stock: 300 },
        { name: 'صابون غسيل', price: 900, category: 'GROCERY', unit: 'كيس', stock: 120 },
        { name: 'ملح طعام 1 كيلو', price: 300, category: 'GROCERY', unit: 'كيس', stock: 400 },
        { name: 'زبدة 250 غم', price: 800, category: 'GROCERY', unit: 'قطعة', stock: 60 },
    ];

    const restaurantTemplates = [
        { name: 'برجر لحم', price: 2500, category: 'FOOD', unit: 'وجبة', stock: 50 },
        { name: 'دجاج مشوي', price: 3000, category: 'FOOD', unit: 'وجبة', stock: 40 },
        { name: 'بيتزا مشكلة', price: 4500, category: 'FOOD', unit: 'قطعة', stock: 25 },
        { name: 'مندي لحم', price: 8000, category: 'FOOD', unit: 'طبق', stock: 20 },
        { name: 'سمك مقلي', price: 3500, category: 'FOOD', unit: 'وجبة', stock: 30 },
        { name: 'شاورما دجاج', price: 1800, category: 'FOOD', unit: 'قطعة', stock: 60 },
        { name: 'فول ومدمس', price: 800, category: 'FOOD', unit: 'طبق', stock: 80 },
        { name: 'عصير ليمون', price: 500, category: 'DRINKS', unit: 'كوب', stock: 100 },
    ];

    let totalAdded = 0;

    for (const merchant of merchants) {
        // تحقق كم منتج موجود
        const existing = await p.product.count({ where: { merchantId: merchant.userId } });

        if (existing >= 4) {
            console.log(`✅ ${merchant.storeName} — لديه ${existing} منتج (تخطي)`);
            continue;
        }

        // اختر template حسب نوع المتجر
        const isFoodStore = merchant.storeName.includes('مطعم') || merchant.storeName.includes('مصعد') || merchant.storeName.includes('Restaurant');
        const templates = isFoodStore ? restaurantTemplates : productTemplates;

        // أضف منتجات
        const toAdd = templates.slice(0, 6); // 6 منتجات لكل تاجر

        for (const tmpl of toAdd) {
            await p.product.create({
                data: {
                    merchantId: merchant.userId,
                    name: tmpl.name,
                    price: tmpl.price,
                    category: tmpl.category,
                    unit: tmpl.unit,
                    stock: tmpl.stock,
                    isAvailable: true,
                    status: 'APPROVED',
                    description: `${tmpl.name} - جودة عالية`,
                }
            });
            totalAdded++;
        }
        console.log(`✅ ${merchant.storeName} — أُضيف ${toAdd.length} منتج`);
    }

    console.log(`\n🎉 تم إضافة ${totalAdded} منتج جديد`);

    // تحقق نهائي
    const finalCount = await p.product.count({ where: { isAvailable: true } });
    console.log(`📊 إجمالي المنتجات النشطة: ${finalCount}`);
}

main()
    .catch(e => console.error('❌', e.message))
    .finally(() => p.$disconnect());
