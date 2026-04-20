import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HIT_DIE: Record<string, number> = {
  "Bárbaro": 12, "Guerrero": 10, "Paladín": 10, "Explorador": 10,
  "Bardo": 8, "Clérigo": 8, "Druida": 8, "Monje": 8,
  "Pícaro": 8, "Brujo": 8, "Hechicero": 6, "Mago": 6,
};

async function main() {
  const players = await prisma.player.findMany();
  let updated = 0;

  for (const p of players) {
    // Solo migrar si classes está vacío (evitar doble migración)
    const existingClasses = JSON.parse(p.classes ?? "[]");
    if (existingClasses.length > 0) continue;

    const className = p.class ?? "Guerrero";
    const level = p.level ?? 1;
    const subclass = p.subclass ?? "";
    const hitDie = HIT_DIE[className] ?? 8;

    const classes = [{ class: className, level, subclass }];
    const hpRolls = [{ level: 1, value: hitDie, rolled: false }];

    await prisma.player.update({
      where: { id: p.id },
      data: {
        classes: JSON.stringify(classes),
        hpRolls: JSON.stringify(hpRolls),
      },
    });
    updated++;
  }

  console.log(`Migrados ${updated} de ${players.length} jugadores.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
