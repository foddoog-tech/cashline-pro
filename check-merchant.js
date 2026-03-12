const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const d = await prisma.user.findFirst({
    where: { role: 'MERCHANT' },
    orderBy: { createdAt: 'desc' },
    include: { merchant: true }
  });
  console.log(JSON.stringify(d, null, 2));
}

check().finally(() => prisma.$disconnect());
