'use server';

import { sendSparrowSMS, SparrowSMSResponse } from '@/lib/sms';

export async function sendSmsAction(to: string, text: string): Promise<{ success: boolean; data?: SparrowSMSResponse; error?: string }> {
  try {

    if (!to || to.length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }
    if (!text) {
      return { success: false, error: 'Message text is required' };
    }

    const response = await sendSparrowSMS(to, text);
    return { success: true, data: response };
  } catch (error: any) {
    console.error('SMS Action Error:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}
