import {
  emptyViewSet,
  type ViewSetState,
} from '../../generation/ViewSetSession';
import { VIEW_IDS } from '../../generation/viewPrompts';

export function approvedViews(): ViewSetState {
  const state = emptyViewSet();
  const reference = {
    image: { url: 'https://fal.media/front.png', contentType: 'image/png' },
    metadata: {
      provider: 'fal',
      modelId: 'image-model',
      promptVersion: 'v1',
      finalPrompt: 'front',
      parameters: {},
      sourcePhotoId: 'photo',
      timestamp: '2026-01-01',
      providerRequestId: 'front_1',
    },
  };
  const views = { ...state.views };
  for (const view of VIEW_IDS)
    views[view] = {
      ...views[view],
      status: 'ready',
      review: 'accepted',
      result: {
        image: {
          url: `https://fal.media/${view}.png`,
          contentType: 'image/png',
        },
        metadata: {
          provider: 'fal',
          modelId: 'image-model',
          promptVersion: 'v1',
          finalPrompt: view,
          parameters: {},
          referenceRequestId: 'front_1',
          view,
          timestamp: '2026-01-01',
          providerRequestId: `req_${view}`,
        },
      },
    };
  return { ...state, reference, views };
}
