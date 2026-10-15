import { z } from 'zod';
import type { PrismaClient, Role } from '../../generated/prisma/client.js';
import { safeUserSelect, type SafeUser } from './auth.types.js';
import { passwordSchema } from './auth.validation.js';
import { hashPassword, verifyPassword } from './password.js';

const demoPasswordsSchema = z.object({
  SEED_ADMIN_PASSWORD: passwordSchema,
  SEED_PELAPOR_PASSWORD: passwordSchema,
  SEED_APPROVER_PASSWORD: passwordSchema,
});

export type DemoPasswords = z.infer<typeof demoPasswordsSchema>;

export function readDemoPasswords(input: NodeJS.ProcessEnv): DemoPasswords {
  const result = demoPasswordsSchema.safeParse(input);

  if (!result.success) {
    throw new Error('All three SEED_*_PASSWORD values must contain 12-72 UTF-8 bytes.');
  }

  return result.data;
}

export async function seedDemoUsers(
  prisma: PrismaClient,
  passwords: DemoPasswords,
): Promise<SafeUser[]> {
  const accounts: { name: string; email: string; role: Role; password: string }[] = [
    {
      name: 'Demo Admin',
      email: 'admin@demo.local',
      role: 'admin',
      password: passwords.SEED_ADMIN_PASSWORD,
    },
    {
      name: 'Demo Reporter',
      email: 'reporter@demo.local',
      role: 'pelapor',
      password: passwords.SEED_PELAPOR_PASSWORD,
    },
    {
      name: 'Demo Approver',
      email: 'approver@demo.local',
      role: 'approver',
      password: passwords.SEED_APPROVER_PASSWORD,
    },
  ];

  // Check existing accounts before any writes; reruns never reset their credentials.
  for (const account of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });

    if (
      existing &&
      (existing.role !== account.role ||
        !(await verifyPassword(account.password, existing.passwordHash)))
    ) {
      throw new Error('An existing demo account has different credentials or role.');
    }
  }

  const prepared = await Promise.all(
    accounts.map(async (account) => ({
      name: account.name,
      email: account.email,
      role: account.role,
      passwordHash: await hashPassword(account.password),
    })),
  );

  return prisma.$transaction(
    prepared.map((account) =>
      prisma.user.upsert({
        where: { email: account.email },
        create: account,
        update: {},
        select: safeUserSelect,
      }),
    ),
  );
}
