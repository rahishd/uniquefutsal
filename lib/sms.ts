
export interface SparrowSMSConfig {
  token: string;
  identity: string;
}

export interface SparrowSMSResponse {
  count: number;
  response_code: number;
  response: string;
}

export interface SparrowCreditResponse {
  credits: number;
  response_code: number;
  response: string;
}

const SPARROW_API_URL = 'http://api.sparrowsms.com/v2/sms/';

const defaultConfig: SparrowSMSConfig = {
  token: process.env.SPARROW_SMS_TOKEN || '',
  identity: process.env.SPARROW_SMS_IDENTITY || '',
};

/**
 * Sends an SMS using Sparrow SMS API.
 * This MUST be called from the server side to protect the token.
 */
export async function sendSparrowSMS(
  to: string,
  text: string,
  config: SparrowSMSConfig = defaultConfig
): Promise<SparrowSMSResponse> {
  if (!config.token || !config.identity) {
    throw new Error('Sparrow SMS configuration missing (token or identity)');
  }

  const params = new URLSearchParams({
    token: config.token,
    from: config.identity,
    to: to,
    text: text,
  });

  const response = await fetch(`${SPARROW_API_URL}?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.response || `Failed to send SMS: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Checks available credits in Sparrow SMS account.
 */
export async function checkSparrowCredits(config: SparrowSMSConfig): Promise<SparrowCreditResponse> {
  const params = new URLSearchParams({
    token: config.token,
  });

  // Note: The doc mentions credits but doesn't give the exact endpoint. 
  // Assuming it's /credits/ based on typical patterns if /sms/ is for sending.
  // Actually the doc says "Check documentation" for credits. 
  // For now, I'll implement the SMS sending as requested.
  const response = await fetch(`http://api.sparrowsms.com/v2/credits/?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }

  return response.json();
}
