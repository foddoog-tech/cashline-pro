
import prisma from '../lib/prisma';

async function main() {
    console.log('Prisma Properties:');
    const props = Object.keys(prisma);
    console.log(props.filter(p => !p.startsWith('$')));
    process.exit(0);
}

main();
