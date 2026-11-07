"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { todayIn } from "./format";
import type * as T from "./types";

export const queryKeys = {
  me: ["me"] as const,
  overview: ["overview"] as const,
  categories: ["categories"] as const,
  transactions: ["transactions"] as const,
  board: ["board"] as const,
  loans: ["loans"] as const,
  books: ["books"] as const,
  dates: ["dates"] as const,
  tools: ["tools"] as const,
  challenges: ["challenges"] as const,
  vault: ["vault"] as const,
};

/** The signed-in user (null until loaded or when signed out). */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
  });
}

/**
 * The signed-in user, for components that only render inside the app shell (which waits for
 * the user to load and redirects when signed out). Throws if used outside it.
 */
export function useUser(): T.User {
  const { data } = useMe();
  if (!data) throw new Error("useUser must be used inside the signed-in app");
  return data;
}

export function useToday(): T.ISODate {
  return todayIn(useMe().data?.timezone ?? "UTC");
}

/**
 * Runs a mutation, then refreshes the data that could be affected. Money moves between pages
 * (paying a bill adds a transaction, buying a book adds an expense), so the safe default is
 * to refresh every data query rather than guess which ones changed.
 */
function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, keys?: QueryKey[]) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      if (keys) await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
      else
        await client.invalidateQueries({
          predicate: (q) => q.queryKey[0] !== "me" && q.queryKey[0] !== "vault",
        });
    },
  });
}

const withId = <I,>(fn: (id: number, input: I) => Promise<unknown>) =>
  ({ id, ...input }: { id: number } & I) => fn(id, input as I);

// -------------------------------------------------------------------------------- account

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: (user) => client.setQueryData(queryKeys.me, user),
  });
}

// ------------------------------------------------------------------------------ overview

export const useOverview = () => useQuery({ queryKey: queryKeys.overview, queryFn: api.overview });

// ------------------------------------------------------------------------- money & categories

export const useCategories = () => useQuery({ queryKey: queryKeys.categories, queryFn: api.categories });

export const useTransactions = (filters: Parameters<typeof api.transactions>[0] = {}) =>
  useQuery({ queryKey: [...queryKeys.transactions, "list", filters], queryFn: () => api.transactions(filters) });

export const useTransactionSummary = (month?: string, months = 6) =>
  useQuery({
    queryKey: [...queryKeys.transactions, "summary", month, months],
    queryFn: () => api.transactionSummary(month, months),
  });

export const useCreateTransaction = () => useAction(api.createTransaction);
export const useUpdateTransaction = () =>
  useAction(withId<Partial<T.TransactionInput>>(api.updateTransaction));
export const useDeleteTransaction = () => useAction(api.deleteTransaction);

export const useCreateCategory = () => useAction(api.createCategory, [queryKeys.categories]);
export const useDeleteCategory = () => useAction(api.deleteCategory);

// ---------------------------------------------------------------------- monthly items (bills)

export const useBoard = (kind?: T.Kind, months = 6) =>
  useQuery({ queryKey: [...queryKeys.board, kind, months], queryFn: () => api.board(kind, months) });

export const useCreateRecurring = () => useAction(api.createRecurring);
export const useUpdateRecurring = () => useAction(withId<Partial<T.RecurringInput>>(api.updateRecurring));
export const useDeleteRecurring = () => useAction(api.deleteRecurring);
export const useSetPayment = () =>
  useAction(
    ({ id, month, ...input }: { id: number; month: string; paid: boolean; paid_on?: string; amount_minor?: number }) =>
      api.setPayment(id, month, input),
  );

// -------------------------------------------------------------------------------- loans

export const useLoans = () => useQuery({ queryKey: queryKeys.loans, queryFn: api.loans });
export const useLoanSummary = () => useQuery({ queryKey: [...queryKeys.loans, "summary"], queryFn: api.loanSummary });
export const useCreateLoan = () => useAction(api.createLoan);
export const useUpdateLoan = () => useAction(withId<Partial<T.LoanInput>>(api.updateLoan));
export const useDeleteLoan = () => useAction(api.deleteLoan);
export const useAddLoanPayment = () =>
  useAction(({ id, ...input }: { id: number; date: string; amount_minor: number; note?: string | null }) =>
    api.addLoanPayment(id, input),
  );
export const useDeleteLoanPayment = () =>
  useAction(({ id, paymentId }: { id: number; paymentId: number }) => api.deleteLoanPayment(id, paymentId));

// -------------------------------------------------------------------------------- books

export const useBooks = () => useQuery({ queryKey: queryKeys.books, queryFn: api.books });
export const useBookSummary = () => useQuery({ queryKey: [...queryKeys.books, "summary"], queryFn: api.bookSummary });
export const useCreateBook = () => useAction(api.createBook);
export const useUpdateBook = () => useAction(withId<Partial<T.BookInput>>(api.updateBook));
export const useDeleteBook = () => useAction(api.deleteBook);
export const usePurchaseBook = () =>
  useAction(({ id, ...input }: { id: number; date?: string; record_expense: boolean }) =>
    api.purchaseBook(id, input),
  );

// -------------------------------------------------------------------------------- dates

export const useDates = () => useQuery({ queryKey: queryKeys.dates, queryFn: api.dates });
export const useCreateDate = () => useAction(api.createDate);
export const useUpdateDate = () => useAction(withId<Partial<T.DateInput>>(api.updateDate));
export const useDeleteDate = () => useAction(api.deleteDate);

// -------------------------------------------------------------------------------- tools

export const useTools = () => useQuery({ queryKey: queryKeys.tools, queryFn: api.tools });
export const useToolSummary = () => useQuery({ queryKey: [...queryKeys.tools, "summary"], queryFn: api.toolSummary });
export const useCreateTool = () => useAction(api.createTool);
export const useUpdateTool = () => useAction(withId<Partial<T.ToolInput>>(api.updateTool));
export const useDeleteTool = () => useAction(api.deleteTool);

// ---------------------------------------------------------------------------- challenges

export const useChallenges = () => useQuery({ queryKey: queryKeys.challenges, queryFn: api.challenges });
export const useChallengeSummary = () =>
  useQuery({ queryKey: [...queryKeys.challenges, "summary"], queryFn: api.challengeSummary });
export const useCreateChallenge = () => useAction(api.createChallenge, [queryKeys.challenges]);
export const useUpdateChallenge = () =>
  useAction(withId<{ title?: string; goal?: string | null }>(api.updateChallenge), [queryKeys.challenges]);
export const useDeleteChallenge = () => useAction(api.deleteChallenge, [queryKeys.challenges]);
export const useSetChallengeDay = () =>
  useAction(({ id, day, done }: { id: number; day: string; done: boolean }) => api.setChallengeDay(id, day, done), [
    queryKeys.challenges,
  ]);
export const useCompleteChallenge = () =>
  useAction(({ id, outcome }: { id: number; outcome: string | null }) => api.completeChallenge(id, outcome), [
    queryKeys.challenges,
  ]);

// -------------------------------------------------------------------------------- vault

export const useVaultStatus = () => useQuery({ queryKey: [...queryKeys.vault, "status"], queryFn: api.vaultStatus });
export const useAccounts = () => useQuery({ queryKey: [...queryKeys.vault, "accounts"], queryFn: api.accounts });
