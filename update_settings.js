const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.setting.upsert({
        where: { key: 'google_callback_url' },
        update: { value: 'https://huymetv.com/api/google-auth' },
        create: { key: 'google_callback_url', value: 'https://huymetv.com/api/google-auth' }
    });
    
    await prisma.setting.upsert({
        where: { key: 'google_client_id' },
        update: { value: '1016109515017-bgce8jul7abuuv0i4f9ti6jm48j5118p.apps.googleusercontent.com' },
        create: { key: 'google_client_id', value: '1016109515017-bgce8jul7abuuv0i4f9ti6jm48j5118p.apps.googleusercontent.com' }
    });

    console.log("Settings updated successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
