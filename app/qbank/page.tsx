import { headers } from 'next/headers';
import ComingSoon from '@/components/ComingSoon';
import { platformFromHost } from '@/lib/platform';
import { turso } from '@/lib/turso';
import QBankClient from './QBankClient';

export default async function QBankPage() {
    const h = await headers();
    const platform = platformFromHost(h.get('x-forwarded-host') || h.get('host'));
    if (platform !== 'med') {
        const r = await turso.execute({ sql: 'SELECT 1 FROM questions WHERE platform = ? LIMIT 1', args: [platform] });
        if (r.rows.length === 0) return <ComingSoon platform={platform} />;
    }
    return <QBankClient />;
}
