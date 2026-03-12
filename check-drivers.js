const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentDrivers() {
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: {
      driver: true,
    },
  });

  console.log(JSON.stringify(drivers, null, 2));
}

checkRecentDrivers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
