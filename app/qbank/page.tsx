import ComingSoon from '@/components/ComingSoon';
import { currentPlatform } from '@/lib/currentPlatform';
import { turso } from '@/lib/turso';
import QBankClient from './QBankClient';

export default async function QBankPage() {
    const platform = await currentPlatform();
    if (platform !== 'med') {
        const r = await turso.execute({ sql: 'SELECT 1 FROM questions WHERE platform = ? LIMIT 1', args: [platform] });
        if (r.rows.length === 0) return <ComingSoon platform={platform} />;
    }
    return <QBankClient />;
}
