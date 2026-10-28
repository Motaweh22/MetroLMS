import { useState, useEffect, useCallback } from 'react';
import { whatsappApi } from '../services/whatsappApi';
import type { WhatsAppSupportScenario, ResolvedSupportContactDTO } from '../types';

export interface UsePublicSupportContactsResult {
  contacts: ResolvedSupportContactDTO[];
  count: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to resolve eligible public WhatsApp support contacts for a given scenario.
 * Enforces zero-hardcoding: returns an empty list if no contacts are eligible.
 */
export function usePublicSupportContacts(
  scenario: WhatsAppSupportScenario
): UsePublicSupportContactsResult {
  const [contacts, setContacts] = useState<ResolvedSupportContactDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await whatsappApi.getPublicSupportContacts(scenario);
      setContacts(response.contacts || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل بيانات جهات التواصل عبر واتساب';
      setError(msg);
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [scenario]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    count: contacts.length,
    isLoading,
    error,
    refetch: fetchContacts,
  };
}
