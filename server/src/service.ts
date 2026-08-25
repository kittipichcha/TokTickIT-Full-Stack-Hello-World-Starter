import { getPrisma } from "./prisma.js";

export interface Category {
  id: number;
  name: string;
}

export interface DevRequester {
  id: number;
  name: string;
  email: string;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: [
        { id: "asc" },
        { name: "asc" },
      ],
    });
    return categories;
  } catch (err) {
    throw new Error("Failed to fetch categories from database");
  }
}

export async function getActiveDevRequesters(): Promise<DevRequester[]> {
  const prisma = getPrisma();
  return prisma.devRequester.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function isActiveDevRequester(id: number): Promise<boolean> {
  const prisma = getPrisma();
  const requester = await prisma.devRequester.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return requester !== null;
}
