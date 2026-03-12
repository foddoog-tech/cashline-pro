const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentDrivers() {
  const drivers = await prisma.user.findMany({
    where: { 
      role: 'DRIVER',
      createdAt: { gte: new Date('2026-03-11') }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      driver: true,
    },
  });

  console.log(JSON.stringify(drivers, null, 2));
}

checkRecentDrivers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
