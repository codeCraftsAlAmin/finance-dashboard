export type ISODate = string; // "2026-11-05"
export type MonthKey = string; // "2026-11"
export type Month = MonthKey;
export type Kind = "income" | "expense";

export interface User {
  id: number;
  email: string;
  name: string;
  timezone: string;
  currency: string;
  has_vault: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  kind: Kind;
  name: string;
  color: string;
}
export type CategoryMini = Pick<Category, "id" | "name" | "color">;

export interface Transaction {
  id: number;
  kind: Kind;
  amount_minor: number;
  date: ISODate;
  title: string;
  note: string | null;
  category: CategoryMini | null;
}
export interface TransactionInput {
  kind: Kind;
  amount_minor: number;
  date: ISODate;
  title: string;
  note?: string | null;
  category_id?: number | null;
}

export interface CategoryTotal {
  category_id: number | null;
  name: string;
  color: string;
  amount_minor: number;
}
export interface DayTotal {
  date: ISODate;
  income_minor: number;
  expense_minor: number;
}
export interface MonthTotal {
  month: Month;
  income_minor: number;
  expense_minor: number;
}
export interface TransactionSummary {
  month: Month;
  income_minor: number;
  expense_minor: number;
  balance_minor: number;
  savings_rate: number | null;
  expense_by_category: CategoryTotal[];
  income_by_category: CategoryTotal[];
  daily: DayTotal[];
  trend: MonthTotal[];
}

export type PaymentStatus = "paid" | "due" | "overdue" | "upcoming";
export interface MonthCell {
  month: Month;
  status: PaymentStatus;
  is_current: boolean;
  due_date: ISODate;
  paid_on: ISODate | null;
  amount_minor: number;
}
export interface RecurringItem {
  id: number;
  kind: Kind;
  name: string;
  amount_minor: number;
  due_day: number;
  start_month: Month;
  end_month: Month | null;
  category: CategoryMini | null;
  note: string | null;
  current: MonthCell | null;
}
export interface RecurringInput {
  kind: Kind;
  name: string;
  amount_minor: number;
  due_day: number;
  start_month: Month;
  end_month?: Month | null;
  category_id?: number | null;
  note?: string | null;
}
export interface BoardRow {
  item: RecurringItem;
  cells: MonthCell[];
  paid_count: number;
  unpaid_count: number;
}
export interface Board {
  months: Month[];
  current_month: Month;
  rows: BoardRow[];
}

export type Direction = "lent" | "borrowed";
export interface LoanPayment {
  id: number;
  date: ISODate;
  amount_minor: number;
  note: string | null;
}
export interface Loan {
  id: number;
  person: string;
  direction: Direction;
  amount_minor: number;
  date: ISODate;
  reason: string | null;
  due_date: ISODate | null;
  paid_minor: number;
  remaining_minor: number;
  settled: boolean;
  overdue: boolean;
  payments: LoanPayment[];
}
export interface LoanInput {
  person: string;
  direction: Direction;
  amount_minor: number;
  date: ISODate;
  reason?: string | null;
  due_date?: ISODate | null;
}
export interface PersonBalance {
  person: string;
  net_minor: number;
  lent_minor: number;
  borrowed_minor: number;
}
export interface LoanSummary {
  lent_outstanding_minor: number;
  borrowed_outstanding_minor: number;
  net_minor: number;
  open_count: number;
  settled_count: number;
  people: PersonBalance[];
}

export type BookStatus = "to_buy" | "to_read" | "reading" | "read";
export interface Book {
  id: number;
  title: string;
  author: string;
  price_minor: number | null;
  status: BookStatus;
  rating: number | null;
  purchased_on: ISODate | null;
  finished_on: ISODate | null;
  notes: string | null;
}
export interface BookInput {
  title: string;
  author: string;
  price_minor?: number | null;
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
}
export interface BookSummary {
  to_buy_count: number;
  to_buy_total_minor: number;
  to_read_count: number;
  reading_count: number;
  read_count: number;
  read_this_year: number;
  spent_on_books_minor: number;
  read_by_month: { month: Month; count: number }[];
}

export type DateKind = "birthday" | "anniversary" | "exam" | "deadline" | "memory" | "other";
export interface ImportantDate {
  id: number;
  title: string;
  date: ISODate;
  kind: DateKind;
  repeat_yearly: boolean;
  notes: string | null;
  next_date: ISODate;
  days_until: number;
  is_past: boolean;
  years: number | null;
}
export interface DateInput {
  title: string;
  date: ISODate;
  kind: DateKind;
  repeat_yearly: boolean;
  notes?: string | null;
}

export type Priority = "high" | "medium" | "low";
export type ToolStatus = "next" | "learning" | "done";
export interface LearnTool {
  id: number;
  name: string;
  details: string | null;
  source_url: string | null;
  priority: Priority;
  status: ToolStatus;
  created_at: string;
}
export interface ToolInput {
  name: string;
  details?: string | null;
  source_url?: string | null;
  priority?: Priority;
  status?: ToolStatus;
}
export interface ToolSummary {
  next_count: number;
  learning_count: number;
  done_count: number;
  by_priority: Record<Priority, number>;
}

export interface VaultAccount {
  id: number;
  service: string;
  username: string;
  url: string | null;
  category: string;
  has_notes: boolean;
  updated_at: string;
}
export interface VaultAccountInput {
  service: string;
  username: string;
  url?: string | null;
  category: string;
  password: string;
  notes?: string | null;
}
export interface VaultUnlock {
  token: string;
  expires_in: number;
}

export interface Overview {
  today: ISODate;
  month: Month;
  income_minor: number;
  expense_minor: number;
  balance_minor: number;
  savings_rate: number | null;
  unpaid_bills_minor: number;
  expected_income_minor: number;
  trend: MonthTotal[];
  expense_by_category: CategoryTotal[];
  monthly_items: {
    id: number;
    kind: Kind;
    name: string;
    amount_minor: number;
    status: PaymentStatus;
    due_date: ISODate;
  }[];
  upcoming_dates: {
    id: number;
    title: string;
    kind: DateKind;
    next_date: ISODate;
    days_until: number;
    years: number | null;
  }[];
  loans: LoanSummary;
  books: {
    reading: { id: number; title: string; author: string }[];
    to_buy_count: number;
    read_count: number;
  };
  tools: {
    next: { id: number; name: string; priority: Priority }[];
    learning_count: number;
    done_count: number;
  };
  recent_transactions: {
    id: number;
    kind: Kind;
    title: string;
    amount_minor: number;
    date: ISODate;
    category: { name: string; color: string } | null;
  }[];
}

export type ChallengeState = "upcoming" | "active" | "overdue" | "completed";
export interface Checkin {
  date: ISODate;
  note: string | null;
}
export interface Challenge {
  id: number;
  title: string;
  goal: string | null;
  start_date: ISODate;
  end_date: ISODate;
  duration_days: number;
  state: ChallengeState;
  completed_on: ISODate | null;
  completed_early: boolean;
  days_early: number;
  outcome: string | null;
  days_done: number;
  days_elapsed: number;
  days_left: number;
  percent: number;
  current_streak: number;
  best_streak: number;
  checked_today: boolean;
  checkins: Checkin[];
}
export interface ChallengeInput {
  title: string;
  goal?: string | null;
  start_date: ISODate;
  duration_days: number;
}
export interface ChallengeSummary {
  active_count: number;
  completed_count: number;
  early_count: number;
  total_days_done: number;
  best_streak: number;
}
