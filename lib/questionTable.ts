// ভার্সিটি 'ক', 'খ' ও SSC-এর প্রশ্ন আলাদা টেবিলে রাখা হয়।
export const questionTable = (platform: string) => platform === 'ka' ? 'ka_questions' : platform === 'kha' ? 'kha_questions' : platform === 'ssc' ? 'ssc_questions' : 'questions';
/** সব প্রশ্নের টেবিল */
export const QUESTION_TABLES = ['questions', 'ka_questions', 'kha_questions', 'ssc_questions'];
/** শুধু id জানা থাকলে id prefix দেখে টেবিল */
export const tableOfId = (id: string) => String(id).startsWith('ka_') ? 'ka_questions' : String(id).startsWith('kha_') ? 'kha_questions' : /^(ssc[_-])/.test(String(id)) ? 'ssc_questions' : 'questions';
