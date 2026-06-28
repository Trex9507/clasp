import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Brands
  const brands = [
    { name: 'Hermès', verificationType: 'serial' as const, verificationInstructions: 'Enter the serial number stamped on the item (usually on a leather tab). Upload a close-up photo of the stamp.' },
    { name: 'Rolex', verificationType: 'serial' as const, verificationInstructions: 'Enter the serial number engraved between the lugs at 6 o\'clock. Upload a photo showing the engraving.' },
    { name: 'Chanel', verificationType: 'serial' as const, verificationInstructions: 'Enter the serial number from the authenticity sticker inside the item. Upload a photo of the sticker.' },
    { name: 'Louis Vuitton', verificationType: 'date_code' as const, verificationInstructions: 'Enter the date code found on the interior tag or stamped inside. Upload a photo of the code.' },
    { name: 'Gucci', verificationType: 'date_code' as const, verificationInstructions: 'Enter the serial/date code from the leather tag inside the item. Upload a photo of the tag.' },
    { name: 'Nike', verificationType: 'tag' as const, verificationInstructions: 'Enter the style code from the tongue or inner tag (e.g., CW2288-111). Upload a photo of the tag.' },
    { name: 'Jordan', verificationType: 'tag' as const, verificationInstructions: 'Enter the style code from the size tag inside the shoe. Upload a photo of the tag.' },
    { name: 'Adidas', verificationType: 'tag' as const, verificationInstructions: 'Enter the article number from the tongue tag (e.g., FY2903). Upload a photo of the tag.' },
    { name: 'Zara', verificationType: 'none' as const, verificationInstructions: null },
    { name: 'H&M', verificationType: 'none' as const, verificationInstructions: null },
    { name: 'Mango', verificationType: 'none' as const, verificationInstructions: null },
    { name: 'Uniqlo', verificationType: 'none' as const, verificationInstructions: null },
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { name: b.name },
      update: {},
      create: b,
    });
  }
  console.log(`Seeded ${brands.length} brands`);

  // Categories (two-level)
  const tree: Record<string, string[]> = {
    'Women': ['Bags', 'Shoes', 'Clothing', 'Accessories', 'Jewellery'],
    'Men': ['Bags', 'Shoes', 'Clothing', 'Accessories', 'Watches'],
    'Kids': ['Shoes', 'Clothing', 'Accessories'],
  };

  let catCount = 0;
  for (const [parentName, children] of Object.entries(tree)) {
    const parent = await prisma.category.upsert({
      where: { id: parentName.toLowerCase() },
      update: {},
      create: { id: parentName.toLowerCase(), name: parentName },
    });
    catCount++;
    for (const childName of children) {
      const childId = `${parentName.toLowerCase()}-${childName.toLowerCase()}`;
      await prisma.category.upsert({
        where: { id: childId },
        update: {},
        create: { id: childId, name: childName, parentId: parent.id },
      });
      catCount++;
    }
  }
  console.log(`Seeded ${catCount} categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
