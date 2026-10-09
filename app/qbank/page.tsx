import { turso } from '@/lib/turso';
import QBankClient from './QBankClient';

export const dynamic = 'force-dynamic';

export default async function QBankPage() {
    let allMappings: { subject: string; chapter: string; topic: string; source: string }[] = [];

    try {
        // নির্ভরশীল ফিল্টারের (Dependent filter) জন্য শুধু ক্যাটাগরিগুলো আনা হচ্ছে (হালকা কুয়েরি)
        const mappingRes = await turso.execute('SELECT DISTINCT subject, chapter, topic, source FROM questions');

        allMappings = mappingRes.rows.map(r => ({
            subject: String(r.subject || ''),
            chapter: String(r.chapter || ''),
            topic: String(r.topic || ''),
            source: String(r.source || ''),
        }));

    } catch (error) {
        console.error("Mapping Fetch Error:", error);
    }

    return <QBankClient allMappings={allMappings} />;
}