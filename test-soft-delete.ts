import prisma from './src/lib/prisma';

async function testSoftDelete() {
    try {
        console.log('--- Testing Soft Delete ---');

        // 1. Create a dummy user
        const user = await prisma.user.create({
            data: {
                phone: '9999999999',
                fullName: 'Test Soft Delete',
                passwordHash: 'hash',
                role: 'CUSTOMER'
            }
        });
        console.log('✅ Created user:', user.id);

        // 2. Delete the user (should be an update)
        await prisma.user.delete({
            where: { id: user.id }
        });
        console.log('✅ Called delete()');

        // 3. Try to find the user with findUnique (middleware should add deletedAt: null)
        const found = await prisma.user.findUnique({
            where: { id: user.id }
        });
        console.log('Found with findUnique:', found ? 'YES (Error!)' : 'NO (Success - hidden)');

        // 4. Check the DB directly to see if it's still there with deletedAt set
        const raw: any = await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = '${user.id}'`);
        console.log('Raw DB record deletedAt:', raw[0]?.deleted_at);

        // Cleanup (hard delete)
        await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = '${user.id}'`);
        console.log('✅ Hard deleted for cleanup');

    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testSoftDelete();
