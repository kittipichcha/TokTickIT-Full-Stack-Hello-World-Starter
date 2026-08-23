import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = ['Account and Access', 'Hardware', 'Software', 'Network'];

  for (const name of categories) {
    // Upsert ensures the seed is safe to run multiple times without duplicates
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const requesters = [
    { name: 'Ada Lovelace', email: 'ada@example.com', isActive: true },
    { name: 'Grace Hopper', email: 'grace@example.com', isActive: true },
    { name: 'Katherine Johnson', email: 'katherine@example.com', isActive: true },
    { name: 'Alan Turing', email: 'alan@example.com', isActive: true },
    { name: 'Edsger Dijkstra', email: 'edsger@example.com', isActive: false },
  ];

  for (const requester of requesters) {
    await prisma.devRequester.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    });
  }

  console.log('Seed completed. Categories and development requesters inserted/verified.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

