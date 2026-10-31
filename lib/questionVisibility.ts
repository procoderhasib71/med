// AI অডিট (explain স্ক্রিপ্ট) error কলামে "Error: ..." বা "pre-explain error: ..." লিখলে প্রশ্নটা ছাত্রদের দেখানো হয় না,
// /admin/ai-review থেকে ঠিক না হওয়া পর্যন্ত। বটের একই নিয়ম Hermes2/tools/mcq_meta.py এর USABLE_SQL এ।
// NULL এ NOT কাজ করে না, তাই আলাদা করে error IS NULL।
export const visibleSql = (col = 'error') =>
    `(${col} IS NULL OR NOT (${col} LIKE 'Error:%' OR ${col} LIKE 'pre-explain error:%'))`;
