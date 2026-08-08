import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = ['Account', 'Access', 'Hardware', 'Software', 'Network'];

  for (const name of categories) {
    // Upsert ensures the seed is safe to run multiple times without duplicates
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Seed completed! Categories inserted/verified:', categories);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

