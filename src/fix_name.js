const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixName() {
    await prisma.zaloAccount.updateMany({
        where: { name: { contains: 'bạn bè' } },
        data: { name: 'Xuân Anh IT' }
    });
    console.log('Fixed account name to Xuân Anh IT in DB');
}

fixName().catch(console.error).finally(() => prisma.$disconnect());
