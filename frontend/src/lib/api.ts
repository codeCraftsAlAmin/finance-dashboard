import type * as T from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

/** Turns a FastAPI error body (a string, or a list of validation issues) into one sentence. */
async function readError(response: Response): Promise<string> {
  const fallback = `Something went wrong (${response.status}). Try again.`;
  try {
    const body = (await response.json()) as { detail?: string | ValidationIssue[] };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      const issue = body.detail[0];
      const field = issue.loc?.filter((part) => part !== "body").join(" ");
      const message = (issue.msg ?? "Invalid value").replace(/^Value error, /, "");
      return field ? `${field}: ${message}` : message;
    }
  } catch {
    // Not JSON (for example a proxy error page): use the fallback.
  }
  return fallback;
}

async function request<T>(
  path: string,
  init: RequestInit & { vaultToken?: string } = {},
): Promise<T> {
  const { vaultToken, ...rest } = init;
  const headers: Record<string, string> = {};
  if (rest.body) headers["Content-Type"] = "application/json";
  if (vaultToken) headers["X-Vault-Token"] = vaultToken;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...rest, credentials: "same-origin", headers });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw new ApiError(response.status, await readError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const body = (value: unknown) => JSON.stringify(value);
const post = <T>(path: string, value?: unknown, extra: { vaultToken?: string } = {}) =>
  request<T>(path, { method: "POST", body: value === undefined ? undefined : body(value), ...extra });
const patch = <T>(path: string, value: unknown) => request<T>(path, { method: "PATCH", body: body(value) });
const put = <T>(path: string, value: unknown, extra: { vaultToken?: string } = {}) =>
  request<T>(path, { method: "PUT", body: body(value), ...extra });
const del = (path: string) => request<void>(path, { method: "DELETE" });

function query(params: Record<string, string | number | undefined | null>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : "";
}

export const api = {
  // auth
  me: () => request<T.User>("/auth/me"),
  login: (email: string, password: string) => post<T.User>("/auth/login", { email, password }),
  register: (input: { name: string; email: string; password: string; timezone: string }) =>
    post<T.User>("/auth/register", input),
  logout: () => post<void>("/auth/logout"),
  updateMe: (input: Partial<Pick<T.User, "name" | "timezone" | "currency">>) =>
    patch<T.User>("/auth/me", input),

  overview: () => request<T.Overview>("/overview"),

  // categories
  categories: () => request<T.Category[]>("/categories"),
  createCategory: (input: Omit<T.Category, "id">) => post<T.Category>("/categories", input),
  updateCategory: (id: number, input: Partial<Pick<T.Category, "name" | "color">>) =>
    patch<T.Category>(`/categories/${id}`, input),
  deleteCategory: (id: number) => del(`/categories/${id}`),

  // transactions
  transactions: (f: { month?: string; kind?: T.Kind; category_id?: number; q?: string } = {}) =>
    request<T.Transaction[]>(`/transactions${query(f)}`),
  transactionSummary: (month?: string, months = 6) =>
    request<T.TransactionSummary>(`/transactions/summary${query({ month, months })}`),
  createTransaction: (input: T.TransactionInput) => post<T.Transaction>("/transactions", input),
  updateTransaction: (id: number, input: Partial<T.TransactionInput>) =>
    patch<T.Transaction>(`/transactions/${id}`, input),
  deleteTransaction: (id: number) => del(`/transactions/${id}`),

  // recurring
  board: (kind?: T.Kind, months = 6) => request<T.Board>(`/recurring/board${query({ kind, months })}`),
  createRecurring: (input: T.RecurringInput) => post<T.RecurringItem>("/recurring", input),
  updateRecurring: (id: number, input: Partial<T.RecurringInput>) =>
    patch<T.RecurringItem>(`/recurring/${id}`, input),
  deleteRecurring: (id: number) => del(`/recurring/${id}`),
  setPayment: (id: number, month: string, input: { paid: boolean; paid_on?: string; amount_minor?: number }) =>
    put<T.MonthCell>(`/recurring/${id}/payments/${month}`, input),

  // loans
  loans: () => request<T.Loan[]>("/loans"),
  loanSummary: () => request<T.LoanSummary>("/loans/summary"),
  createLoan: (input: T.LoanInput) => post<T.Loan>("/loans", input),
  updateLoan: (id: number, input: Partial<T.LoanInput>) => patch<T.Loan>(`/loans/${id}`, input),
  deleteLoan: (id: number) => del(`/loans/${id}`),
  addLoanPayment: (id: number, input: { date: string; amount_minor: number; note?: string | null }) =>
    post<T.Loan>(`/loans/${id}/payments`, input),
  deleteLoanPayment: (id: number, paymentId: number) =>
    request<T.Loan>(`/loans/${id}/payments/${paymentId}`, { method: "DELETE" }),

  // books
  books: () => request<T.Book[]>("/books"),
  bookSummary: () => request<T.BookSummary>("/books/summary"),
  createBook: (input: T.BookInput) => post<T.Book>("/books", input),
  updateBook: (id: number, input: Partial<T.BookInput>) => patch<T.Book>(`/books/${id}`, input),
  purchaseBook: (id: number, input: { date?: string; record_expense: boolean }) =>
    post<T.Book>(`/books/${id}/purchase`, input),
  deleteBook: (id: number) => del(`/books/${id}`),

  // dates
  dates: () => request<T.ImportantDate[]>("/dates"),
  createDate: (input: T.DateInput) => post<T.ImportantDate>("/dates", input),
  updateDate: (id: number, input: Partial<T.DateInput>) => patch<T.ImportantDate>(`/dates/${id}`, input),
  deleteDate: (id: number) => del(`/dates/${id}`),

  // tools
  tools: () => request<T.LearnTool[]>("/tools"),
  toolSummary: () => request<T.ToolSummary>("/tools/summary"),
  createTool: (input: T.ToolInput) => post<T.LearnTool>("/tools", input),
  updateTool: (id: number, input: Partial<T.ToolInput>) => patch<T.LearnTool>(`/tools/${id}`, input),
  deleteTool: (id: number) => del(`/tools/${id}`),

  // challenges
  challenges: () => request<T.Challenge[]>("/challenges"),
  challengeSummary: () => request<T.ChallengeSummary>("/challenges/summary"),
  createChallenge: (input: T.ChallengeInput) => post<T.Challenge>("/challenges", input),
  updateChallenge: (id: number, input: { title?: string; goal?: string | null }) =>
    patch<T.Challenge>(`/challenges/${id}`, input),
  deleteChallenge: (id: number) => del(`/challenges/${id}`),
  setChallengeDay: (id: number, day: string, done: boolean) =>
    put<T.Challenge>(`/challenges/${id}/days/${day}`, { done }),
  completeChallenge: (id: number, outcome: string | null) =>
    post<T.Challenge>(`/challenges/${id}/complete`, { outcome }),

  // vault
  vaultStatus: () => request<{ initialized: boolean }>("/vault/status"),
  vaultSetup: (master_password: string) => post<T.VaultUnlock>("/vault/setup", { master_password }),
  vaultUnlock: (master_password: string) => post<T.VaultUnlock>("/vault/unlock", { master_password }),
  vaultReset: (password: string) => post<void>("/vault/reset", { password }),
  accounts: () => request<T.VaultAccount[]>("/vault/accounts"),
  createAccount: (input: T.VaultAccountInput, token: string) =>
    post<T.VaultAccount>("/vault/accounts", input, { vaultToken: token }),
  updateAccount: (id: number, input: Partial<Pick<T.VaultAccountInput, "service" | "username" | "url" | "category">>) =>
    patch<T.VaultAccount>(`/vault/accounts/${id}`, input),
  updateSecret: (id: number, input: { password: string; notes?: string | null }, token: string) =>
    put<T.VaultAccount>(`/vault/accounts/${id}/secret`, input, { vaultToken: token }),
  revealAccount: (id: number, token: string) =>
    request<{ password: string; notes: string | null }>(`/vault/accounts/${id}/secret`, { vaultToken: token }),
  deleteAccount: (id: number) => del(`/vault/accounts/${id}`),
};
