import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Required seed data per Lab 2 specification (Section 5.3)

  // 1. Seed exactly four required Categories (preserve existing from Lab 1)
  const categories = [
    { name: 'Account and Access' },
    { name: 'Hardware' },
    { name: 'Software' },
    { name: 'Network' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { isActive: true }, // Ensure all required categories are marked active
      create: { name: cat.name, isActive: true },
    });
  }
  console.log('✅ Categories seeded:', categories.map((c) => c.name));

  // 2. Seed at least six realistic Related Systems
  const relatedSystems = [
    { name: 'Email' },
    { name: 'Campus Wi-Fi' },
    { name: 'VPN' },
    { name: 'LEB2 App' },
    { name: 'Grade Submission App' },
    { name: 'Printer' },
    { name: 'Corporate Laptop' },
  ];

  for (const sys of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name: sys.name },
      update: {},
      create: { name: sys.name, isActive: true },
    });
  }
  console.log('✅ Related Systems seeded:', relatedSystems.map((s) => s.name));

  // 3. Seed at least four active Development Requesters
  const activeRequesters = [
    {
      name: 'Jennifer Anderson',
      email: 'jennifer.anderson@example.com',
      isActive: true,
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      isActive: true,
    },
    {
      name: 'David Lee',
      email: 'david.lee@example.com',
      isActive: true,
    },
    {
      name: 'Michael Brown',
      email: 'michael.brown@example.com',
      isActive: true,
    },
  ];

  for (const requester of activeRequesters) {
    await prisma.devRequester.upsert({
      where: { email: requester.email },
      update: { isActive: requester.isActive },
      create: requester,
    });
  }
  console.log('✅ Active Development Requesters seeded:', activeRequesters.map((r) => r.name));

  // 4. Seed at least one inactive Development Requester
  const inactiveRequester = {
    name: 'Robert Chen',
    email: 'robert.chen@example.com',
    isActive: false,
  };

  await prisma.devRequester.upsert({
    where: { email: inactiveRequester.email },
    update: { isActive: inactiveRequester.isActive },
    create: inactiveRequester,
  });
  console.log('✅ Inactive Development Requester seeded:', inactiveRequester.name);

  console.log('\n✅ Lab 2 seed completed successfully! All required data inserted/verified.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

