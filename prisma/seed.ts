import { PrismaClient } from "@prisma/client";
import { FOOD_ITEMS } from "../src/lib/exchange-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding food exchange knowledge base…");
  await prisma.foodExchange.deleteMany();

  await prisma.foodExchange.createMany({
    data: FOOD_ITEMS.map((f) => ({
      group: f.group,
      subgroup: f.subgroup ?? "",
      name: f.name,
      amountG: f.amountG,
      protein: f.protein,
      fat: f.fat,
      cho: f.cho,
      energy: f.energy,
      note: f.note ?? "",
    })),
  });

  const count = await prisma.foodExchange.count();
  console.log(`Seeded ${count} food exchange items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
