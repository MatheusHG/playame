import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'matheushgo2000@gmail.com';
  const password = 'I!D+2a3?6Ze*';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.users.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash: passwordHash,
      email_confirmed: true,
    },
  });

  const existingRole = await prisma.user_roles.findFirst({
    where: { user_id: user.id, role: 'SUPER_ADMIN' },
  });

  if (!existingRole) {
    await prisma.user_roles.create({
      data: {
        user_id: user.id,
        role: 'SUPER_ADMIN',
        company_id: null,
      },
    });
  }

  console.log(`Super Admin criado: ${email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
