import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.agent.upsert({
    where: { telegramUserId: BigInt(100000001) },
    update: {},
    create: {
      telegramUserId: BigInt(100000001),
      name: 'Admin Agent',
      username: 'admin_agent',
      role: 'admin',
      isActive: true,
    },
  });

  const lead = await prisma.agent.upsert({
    where: { telegramUserId: BigInt(100000002) },
    update: {},
    create: {
      telegramUserId: BigInt(100000002),
      name: 'Olga Lead',
      username: 'olga_lead',
      role: 'lead',
      isActive: true,
    },
  });

  const agent = await prisma.agent.upsert({
    where: { telegramUserId: BigInt(100000003) },
    update: {},
    create: {
      telegramUserId: BigInt(100000003),
      name: 'Support Agent',
      username: 'support_agent',
      role: 'agent',
      isActive: true,
    },
  });

  const team = await prisma.agentTeam.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'General Support',
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_agentId: { teamId: team.id, agentId: lead.id } },
    update: {},
    create: { teamId: team.id, agentId: lead.id },
  });
  await prisma.teamMember.upsert({
    where: { teamId_agentId: { teamId: team.id, agentId: agent.id } },
    update: {},
    create: { teamId: team.id, agentId: agent.id },
  });

  const chatGroup = await prisma.chatGroup.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Product: Core',
      color: '#6366f1',
      description: 'Клієнтські групи по основному продукту',
    },
  });

  const chat = await prisma.chat.upsert({
    where: { telegramChatId: BigInt(-1000000000001) },
    update: {},
    create: {
      telegramChatId: BigInt(-1000000000001),
      title: 'Test Client Group',
      chatGroupId: chatGroup.id,
      defaultTeamId: team.id,
      routingStrategy: 'round_robin',
      defaultPriority: 'normal',
    },
  });

  const labels = await Promise.all(
    [
      { name: 'bug', color: '#ef4444' },
      { name: 'billing', color: '#f59e0b' },
      { name: 'feature-request', color: '#22c55e' },
      { name: 'urgent', color: '#dc2626' },
    ].map((l) => prisma.label.upsert({ where: { name: l.name }, update: {}, create: l })),
  );

  await prisma.savedView.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      ownerId: null,
      name: 'Непризначені',
      filter: { status: ['open'], assigneeId: null },
      sort: { field: 'createdAt', direction: 'asc' },
    },
  });

  console.log('Seed complete:', {
    agents: [admin.username, lead.username, agent.username],
    team: team.name,
    chatGroup: chatGroup.name,
    chat: chat.title,
    labels: labels.map((l) => l.name),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
