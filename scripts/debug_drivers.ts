
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Drivers in Database ---');
    try {
        // Correct query based on schema
        const drivers = await prisma.driver.findMany({
            include: {
                user: true,
            },
            orderBy: {
                user: {
                    createdAt: 'desc',
                }
            },
            take: 10,
        });

        if (drivers.length === 0) {
            console.log('❌ No drivers found in the database.');
        } else {
            console.log(`✅ Found ${drivers.length} drivers:`);
            drivers.forEach(d => {
                console.log(`- DriverUserID: ${d.userId}`);
                console.log(`  Name: ${d.user.fullName}`);
                console.log(`  Role: ${d.user.role}`); // Check implicit role
                console.log(`  Phone: ${d.user.phone}`);
                console.log(`  IsApproved: ${d.isApproved}`);
                console.log(`  IsAvailable: ${d.isAvailable}`);
                console.log(`  Created: ${d.user.createdAt}`);
                // Check if there are any other fields that might indicate "Pending" status
                // In this schema, isApproved=false usually means Pending.
                console.log('-------------------');
            });
        }
    } catch (error) {
        console.error('Error fetching drivers:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
