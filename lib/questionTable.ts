// ভার্সিটি 'ক' এর প্রশ্ন আলাদা টেবিলে (ka_questions, গঠন questions এর মতোই), বাকি প্ল্যাটফর্ম questions এ।
export const questionTable = (platform: string) => (platform === 'ka' ? 'ka_questions' : 'questions');
/** শুধু id জানা থাকলে: ka প্রশ্নের id "ka_" দিয়ে শুরু */
export const tableOfId = (id: string) => (String(id).startsWith('ka_') ? 'ka_questions' : 'questions');
