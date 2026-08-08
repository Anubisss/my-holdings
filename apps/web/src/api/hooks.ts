import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  Account,
  AppConfig,
  CashInput,
  Holding,
  HoldingInput,
  Notes,
  PortfolioSummary,
  WatchlistInput,
  WatchlistItem,
} from '../types';
import { apiFetch } from './client';

const accountsKey = ['accounts'] as const;
const configKey = ['config'] as const;
const watchlistKey = ['watchlist'] as const;
const summaryKey = ['summary'] as const;
const notesKey = ['notes'] as const;

const REFETCH_INTERVAL = 20_000;

export const useConfig = () =>
  useQuery({
    queryKey: configKey,
    queryFn: () => apiFetch<AppConfig>('/config'),
    staleTime: Infinity,
  });

export const useAccounts = () =>
  useQuery({
    queryKey: accountsKey,
    queryFn: () => apiFetch<Account[]>('/accounts'),
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });

export const useSummary = () =>
  useQuery({
    queryKey: summaryKey,
    queryFn: () => apiFetch<PortfolioSummary>('/summary'),
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });

export const useCreateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
};

export const useRenameAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
    },
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
};

export const useUpdateCash = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cash }: { id: string; cash: CashInput }) =>
      apiFetch<Account>(`/accounts/${id}/cash`, { method: 'PUT', body: JSON.stringify(cash) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
};

export const useCreateHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, input }: { accountId: string; input: HoldingInput }) =>
      apiFetch<Holding>(`/accounts/${accountId}/holdings`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
};

export const useUpdateHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HoldingInput }) =>
      apiFetch<Holding>(`/holdings/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
};

export const useDeleteHolding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/holdings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey });
      queryClient.invalidateQueries({ queryKey: summaryKey });
    },
  });
};

export const useWatchlist = () =>
  useQuery({
    queryKey: watchlistKey,
    queryFn: () => apiFetch<WatchlistItem[]>('/watchlist'),
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });

export const useCreateWatchlistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WatchlistInput) =>
      apiFetch<WatchlistItem>('/watchlist', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: watchlistKey }),
  });
};

export const useUpdateWatchlistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WatchlistInput }) =>
      apiFetch<WatchlistItem>(`/watchlist/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: watchlistKey }),
  });
};

export const useDeleteWatchlistItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/watchlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: watchlistKey }),
  });
};

export const useNotes = () =>
  useQuery({
    queryKey: notesKey,
    queryFn: () => apiFetch<Notes>('/notes'),
  });

export const useSaveNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticker, body }: { ticker: string; body: string }) =>
      apiFetch<void>(`/notes/${encodeURIComponent(ticker)}`, {
        method: 'PUT',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey }),
  });
};
