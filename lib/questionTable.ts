// ভার্সিটি 'ক' আর 'খ' এর প্রশ্ন আলাদা টেবিলে (ka_questions, kha_questions; গঠন questions এর মতোই), বাকি প্ল্যাটফর্ম questions এ।
export const questionTable = (platform: string) => (platform === 'ka' ? 'ka_questions' : platform === 'kha' ? 'kha_questions' : 'questions');
/** সব প্রশ্নের টেবিল */
export const QUESTION_TABLES = ['questions', 'ka_questions', 'kha_questions'];
/** শুধু id জানা থাকলে: id এর শুরু ("ka_", "kha_") দেখে টেবিল */
export const tableOfId = (id: string) => (String(id).startsWith('ka_') ? 'ka_questions' : String(id).startsWith('kha_') ? 'kha_questions' : 'questions');
