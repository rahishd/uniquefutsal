'use client';

import { useState } from 'react';
import { sendSmsAction } from '@/app/actions/sms';

export function useSms() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSms = async (to: string, text: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await sendSmsAction(to, text);
      if (!result.success) {
        setError(result.error || 'Failed to send SMS');
        return { success: false, error: result.error };
      }
      return { success: true, data: result.data };
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendSms,
    isLoading,
    error,
  };
}
