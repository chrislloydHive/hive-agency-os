import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Base as AirtableBase } from 'airtable';

import { getProjectsBase } from '@/lib/airtable';
import { getMuxClient, getMuxWebhookSecret } from '@/lib/mux/client';
import { processMuxWebhook } from '@/lib/mux/processMuxWebhook';
import {
  CRAS_MUX_ASPECT_RATIO_FIELD,
  CRAS_MUX_ASSET_ID_FIELD,
  CRAS_MUX_DURATION_FIELD,
  CRAS_MUX_ERROR_FIELD,
  CRAS_MUX_PLAYBACK_ID_FIELD,
  CRAS_MUX_STATUS_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
} from '@/lib/mux/crasMuxFields';

vi.mock('@/lib/airtable', () => ({
  getProjectsBase: vi.fn(),
}));

vi.mock('@/lib/mux/client', () => ({
  getMuxClient: vi.fn(),
  getMuxWebhookSecret: vi.fn(),
}));

const mockGetProjectsBase = vi.mocked(getProjectsBase);
const mockGetMuxClient = vi.mocked(getMuxClient);
const mockGetMuxWebhookSecret = vi.mocked(getMuxWebhookSecret);

const CRAS_ID = 'rec12345678901234';

function headersForMux(): Headers {
  return new Headers({ 'mux-signature': 'test' });
}

describe('processMuxWebhook', () => {
  let update: ReturnType<typeof vi.fn>;
  let firstPage: ReturnType<typeof vi.fn>;
  let verifySignature: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    update = vi.fn().mockResolvedValue({});
    firstPage = vi.fn();
    verifySignature = vi.fn().mockResolvedValue(undefined);
    mockGetMuxWebhookSecret.mockReturnValue('whsec_test');
    mockGetMuxClient.mockReturnValue({
      webhooks: { verifySignature },
    } as any);
    mockGetProjectsBase.mockReturnValue(
      (() =>
        ({
          update,
          select: () => ({ firstPage }),
        }) as any) as unknown as AirtableBase,
    );
  });

  it('returns not handled when webhook secret is missing', async () => {
    mockGetMuxWebhookSecret.mockReturnValue(undefined);
    const res = await processMuxWebhook('{}', headersForMux());
    expect(res).toEqual({ handled: false, reason: 'MUX_WEBHOOK_SIGNING_SECRET not configured' });
    expect(verifySignature).not.toHaveBeenCalled();
  });

  it('returns not handled when Mux client is missing', async () => {
    mockGetMuxClient.mockReturnValue(null);
    const res = await processMuxWebhook('{}', headersForMux());
    expect(res).toEqual({ handled: false, reason: 'Mux client not configured' });
  });

  it('rejects invalid signature', async () => {
    verifySignature.mockRejectedValue(new Error('bad sig'));
    const res = await processMuxWebhook('{}', headersForMux());
    expect(res).toEqual({ handled: false, reason: 'signature: bad sig' });
    expect(update).not.toHaveBeenCalled();
  });

  it('video.asset.ready updates CRAS with playback, duration, aspect ratio', async () => {
    const body = JSON.stringify({
      type: 'video.asset.ready',
      data: {
        id: 'mux_asset_1',
        passthrough: CRAS_ID,
        duration: 42.5,
        aspect_ratio: '16:9',
        playback_ids: [
          { id: 'pb_private', policy: 'signed' },
          { id: 'pb_public', policy: 'public' },
        ],
      },
    });
    const res = await processMuxWebhook(body, headersForMux());
    expect(res).toEqual({ handled: true, type: 'video.asset.ready', crasRecordId: CRAS_ID });
    expect(verifySignature).toHaveBeenCalledWith(body, expect.any(Headers), 'whsec_test');
    expect(update).toHaveBeenCalledWith(CRAS_ID, {
      [CRAS_MUX_STATUS_FIELD]: 'ready',
      [CRAS_MUX_ASSET_ID_FIELD]: 'mux_asset_1',
      [CRAS_MUX_PLAYBACK_ID_FIELD]: 'pb_public',
      [CRAS_MUX_DURATION_FIELD]: 42.5,
      [CRAS_MUX_ASPECT_RATIO_FIELD]: '16:9',
    });
  });

  it('video.asset.errored writes status and error message', async () => {
    const body = JSON.stringify({
      type: 'video.asset.errored',
      data: {
        id: 'mux_asset_err',
        passthrough: CRAS_ID,
        errors: { type: 'invalid_input', messages: ['bad container', 'codec'] },
      },
    });
    const res = await processMuxWebhook(body, headersForMux());
    expect(res).toEqual({ handled: true, type: 'video.asset.errored', crasRecordId: CRAS_ID });
    expect(update).toHaveBeenCalledWith(CRAS_ID, {
      [CRAS_MUX_STATUS_FIELD]: 'errored',
      [CRAS_MUX_ERROR_FIELD]: 'bad container; codec',
      [CRAS_MUX_ASSET_ID_FIELD]: 'mux_asset_err',
    });
  });

  it('video.upload.asset_created resolves CRAS by upload id when passthrough missing', async () => {
    firstPage.mockResolvedValue([{ id: CRAS_ID }]);
    const body = JSON.stringify({
      type: 'video.upload.asset_created',
      data: { id: 'up_lookup', asset_id: 'mux_new_asset' },
    });
    const res = await processMuxWebhook(body, headersForMux());
    expect(res).toEqual({
      handled: true,
      type: 'video.upload.asset_created',
      crasRecordId: CRAS_ID,
    });
    expect(firstPage).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(CRAS_ID, {
      [CRAS_MUX_ASSET_ID_FIELD]: 'mux_new_asset',
      [CRAS_MUX_UPLOAD_ID_FIELD]: 'up_lookup',
    });
  });

  it('returns ignored reason for unknown event types', async () => {
    const body = JSON.stringify({ type: 'video.live_stream.active', data: {} });
    const res = await processMuxWebhook(body, headersForMux());
    expect(res).toEqual({ handled: false, reason: 'ignored event: video.live_stream.active' });
    expect(update).not.toHaveBeenCalled();
  });
});
