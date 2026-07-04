interface TelegramWebApp {
  initData: string;
  close: () => void;
}

function telegramWebApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

/** True only when actually opened inside Telegram (not just when the SDK script loaded). */
export function isInsideTelegram(): boolean {
  return Boolean(telegramWebApp()?.initData);
}

export interface VideoRelayEndpoints {
  uploadUrlEndpoint: string;
  finalizeEndpoint: string;
}

/**
 * Uploads the exported video straight to S3 via a presigned URL (bypassing
 * any Lambda payload limit), then asks the finalize endpoint to hand Telegram
 * a fetchable URL so Telegram's own servers pull the video into the chat.
 */
export async function sendVideoToTelegram(
  blob: Blob,
  endpoints: VideoRelayEndpoints,
  onStatus?: (status: string) => void
): Promise<void> {
  const webApp = telegramWebApp();
  if (!webApp?.initData) {
    throw new Error('This only works when opened from Telegram.');
  }
  const initData = webApp.initData;

  onStatus?.('Preparing upload…');
  const uploadUrlResponse = await fetch(endpoints.uploadUrlEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  if (!uploadUrlResponse.ok) {
    throw new Error('Could not start the upload. Make sure your Telegram account is paired with piisAmI.');
  }
  const { uploadUrl, objectKey } = (await uploadUrlResponse.json()) as { uploadUrl: string; objectKey: string };

  onStatus?.('Uploading video…');
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4' },
    body: blob
  });
  if (!putResponse.ok) {
    throw new Error('The video upload failed.');
  }

  onStatus?.('Sending to Telegram…');
  const finalizeResponse = await fetch(endpoints.finalizeEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData, objectKey })
  });
  if (!finalizeResponse.ok) {
    throw new Error('Telegram did not accept the video.');
  }
}
