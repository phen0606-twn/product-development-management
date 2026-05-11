export const formatCurrency = (value: number | null | undefined, currency = 'TWD') =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value ?? 0);

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '未設定';
  return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' }).format(new Date(value));
};

export const formatFullDate = (value: string | null | undefined) => {
  if (!value) return '未設定';
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
};

export const monthEnd = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};
