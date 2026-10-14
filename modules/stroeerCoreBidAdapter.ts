import { buildUrl, deepAccess, deepSetValue, generateUUID, getWinDimensions, getWindowSelf, getWindowTop, isEmpty, isStr, logWarn } from '../src/utils.js';
import { type AdapterRequest, type BidderSpec, type ServerResponse, registerBidder } from '../src/adapters/bidderFactory.js';
import type { BidRequest, ClientBidderRequest } from '../src/adapterManager.js';
import type { BidResponse } from '../src/bidfactory.js';
import type { UserSync } from '../src/userSync.js';
import type { Size } from '../src/types/common.d.ts';
import type { MediaType } from '../src/mediaTypes.js';
import type { ConsentDataForKey } from '../src/consentHandler.js';
import { CONSENT_GDPR } from '../src/consentHandler.js';
import { BANNER, VIDEO } from '../src/mediaTypes.js';
import { getBoundingClientRect } from '../libraries/boundingClientRect/boundingClientRect.js';
import { getGlobal } from '../src/prebidGlobal.js';

const GVL_ID = 136;
const BIDDER_CODE = 'stroeerCore' as const;
const DEFAULT_HOST = 'hb.adscale.de';
const DEFAULT_PATH = '/dsh';
const DEFAULT_PORT = '';
const FIVE_MINUTES_IN_SECONDS = 300;
const USER_SYNC_IFRAME_URL = 'https://js.adscale.de/pbsync.html';

/**
 * Bid parameters for the Stroeer Core bid adapter.
 */
export type StroeerCoreBidParams = {
  /** Required. Slot ID. */
  sid: string;
  /** Optional. Special format parameters, passed through to the endpoint as-is. */
  sfp?: Record<string, unknown>;
  /** Optional. Overrides the endpoint host. Default `hb.adscale.de`. */
  host?: string;
  /** Optional. Overrides the endpoint port. */
  port?: string;
  /** Optional. Overrides the endpoint port for secure requests; takes precedence over `port`. */
  securePort?: string;
  /** Optional. Overrides the endpoint path. Default `/dsh`. */
  path?: string;
};

declare module '../src/adUnits' {
  interface BidderParams {
    [BIDDER_CODE]: StroeerCoreBidParams;
  }
}

type StroeerBidRequest = BidRequest<typeof BIDDER_CODE>;

type StroeerFloorPrice = {
  def?: number;
  cur: string;
  siz: { w: number; h: number; p: number }[];
};

type StroeerBaseBid = {
  bid: string;
  sid: string;
  viz: boolean | undefined;
  sfp: Record<string, unknown> | undefined;
  tid: string | undefined;
};

type StroeerBannerBid = StroeerBaseBid & {
  ban: {
    siz: Size[];
    fp: StroeerFloorPrice | undefined;
  };
};

type StroeerVideoBid = StroeerBaseBid & {
  vid: {
    ctx: string | undefined;
    siz: Size | undefined;
    mim: string[] | undefined;
    fp: StroeerFloorPrice | undefined;
  };
};

type StroeerBasePayload = {
  id: string;
  ref: string | undefined;
  mpa: boolean;
  timeout: number;
  url: string | undefined;
  schain: unknown;
  ver: { pb: string };
  user?: { eids: unknown };
  gdpr?: { consent: string | undefined; applies: boolean | undefined };
};

type StroeerRequestPayload = StroeerBasePayload & {
  bids: (StroeerBannerBid | StroeerVideoBid)[];
};

type StroeerServerBid = {
  bidId: string;
  cpm?: number;
  width?: number;
  height?: number;
  ad?: string;
  vastXml?: string;
  meta?: Record<string, unknown>;
};

type StroeerServerResponseBody = {
  bids: StroeerServerBid[];
};

export const spec: BidderSpec<typeof BIDDER_CODE> = {
  code: BIDDER_CODE,
  gvlid: GVL_ID,
  supportedMediaTypes: [BANNER, VIDEO],

  isBidRequestValid: (function () {
    const validators: ((bidRequest: StroeerBidRequest) => boolean)[] = [];

    const createValidator = (checkFn: (bidRequest: StroeerBidRequest) => boolean, msg: string) => {
      return (bidRequest: StroeerBidRequest) => {
        if (checkFn(bidRequest)) {
          return true;
        } else {
          logWarn(`${BIDDER_CODE}: Bid setup for ${bidRequest.adUnitCode} is invalid: ${msg}`);
          return false;
        }
      };
    };

    const hasValidMediaType = (bidReq: StroeerBidRequest) => hasBanner(bidReq) || hasVideo(bidReq);

    validators.push(createValidator((bidReq) => hasValidMediaType(bidReq),
      'the media type is invalid'));
    validators.push(createValidator((bidReq) => typeof bidReq.params === 'object',
      'the custom params does not exist'));
    validators.push(createValidator((bidReq) => isStr(bidReq.params.sid),
      'the sid field must be a string'));

    return function (bidRequest: StroeerBidRequest) {
      return validators.every(f => f(bidRequest));
    };
  }()),

  buildRequests: function (validBidRequests: StroeerBidRequest[] = [], bidderRequest: ClientBidderRequest<typeof BIDDER_CODE>): AdapterRequest {
    const anyBid = bidderRequest.bids[0];

    const refererInfo = bidderRequest.refererInfo;

    const basePayload: StroeerBasePayload = {
      id: generateUUID(),
      ref: refererInfo.ref,
      mpa: isMainPageAccessible(),
      timeout: bidderRequest.timeout - (Date.now() - bidderRequest.auctionStart),
      url: refererInfo.page,
      schain: anyBid?.ortb2?.source?.ext?.schain,
      ver: {
        pb: getGlobal().version,
      },
    };

    const eids = anyBid.userIdAsEids;

    if (!isEmpty(eids)) {
      basePayload.user = {
        eids: eids
      };
    }

    const gdprConsent = bidderRequest.gdprConsent;

    if (gdprConsent) {
      basePayload.gdpr = {
        consent: gdprConsent.consentString,
        applies: gdprConsent.gdprApplies
      };
    }

    const ORTB2_PATHS = ['regs.ext.dsa', 'site.ext', 'source.tid'];
    copyDeepPaths(basePayload, bidderRequest.ortb2, ORTB2_PATHS, 'ortb2');

    const bannerBids = validBidRequests
      .filter(hasBanner)
      .map(mapToPayloadBannerBid);

    const videoBids = validBidRequests
      .filter(hasVideo)
      .map(mapToPayloadVideoBid);

    const payload: StroeerRequestPayload = { ...basePayload, bids: [...bannerBids, ...videoBids] };

    return {
      method: 'POST',
      url: buildEndpointUrl(anyBid.params),
      data: payload
    };
  },

  interpretResponse: function (serverResponse: ServerResponse): BidResponse[] {
    const bids: BidResponse[] = [];

    if (serverResponse.body && typeof serverResponse.body === 'object') {
      const body = serverResponse.body as StroeerServerResponseBody;
      body.bids.forEach(bidResponse => {
        const mediaType: MediaType = bidResponse.vastXml != null ? VIDEO : BANNER;

        const bid = {
          requestId: bidResponse.bidId,
          cpm: bidResponse.cpm || 0,
          width: bidResponse.width || 0,
          height: bidResponse.height || 0,
          ttl: FIVE_MINUTES_IN_SECONDS,
          currency: 'EUR',
          netRevenue: true,
          creativeId: '',
          meta: { ...bidResponse.meta },
          mediaType,
          // Prebid core requires desirability on bid responses (BaseBidResponse); the auction
          // recomputes it (adjustDesirability, default = cpm), so this is only the documented default.
          desirability: bidResponse.cpm || 0,
        } as BidResponse;

        if (mediaType === VIDEO) {
          (bid as any).vastXml = bidResponse.vastXml;
        } else {
          (bid as any).ad = bidResponse.ad;
        }

        bids.push(bid);
      });
    }

    return bids;
  },

  getUserSyncs: function (syncOptions, serverResponses, gdprConsent): UserSync[] {
    if (serverResponses.length > 0 && syncOptions.iframeEnabled) {
      return [{
        type: 'iframe',
        url: USER_SYNC_IFRAME_URL + getGdprParams(gdprConsent)
      }];
    }

    return [];
  }
};

const isMainPageAccessible = (): boolean => {
  try {
    return !!getWindowTop().location.href;
  } catch (ignore) {
    return false;
  }
};

const elementInView = (elementId: string): boolean | undefined => {
  // TODO this should use getAdUnitElement
  const resolveElement = (elId: string) => {
    const win = getWindowSelf();

    return win.document.getElementById(elId);
  };

  const visibleInWindow = (el: Element, win: Window): boolean => {
    const rect = getBoundingClientRect(el);
    const inView = (rect.top + rect.height >= 0) && (rect.top <= getWinDimensions().innerHeight);

    if (win !== win.parent) {
      return inView && visibleInWindow(win.frameElement as Element, win.parent);
    }

    return inView;
  };

  try {
    return visibleInWindow(resolveElement(elementId) as Element, getWindowSelf());
  } catch (e) {
    // old browser, element not found, cross-origin etc.
  }
  return undefined;
};

const buildEndpointUrl = ({ host: hostname = DEFAULT_HOST, port = DEFAULT_PORT, securePort, path: pathname = DEFAULT_PATH }: StroeerCoreBidParams): string => {
  if (securePort) {
    port = securePort;
  }

  return buildUrl({ protocol: 'https', hostname, port, pathname });
};

const getGdprParams = (gdprConsent: null | ConsentDataForKey<typeof CONSENT_GDPR>): string => {
  if (gdprConsent) {
    const consentString = encodeURIComponent(gdprConsent.consentString || '');
    const isGdpr = gdprConsent.gdprApplies ? 1 : 0;

    return `?gdpr=${isGdpr}&gdpr_consent=${consentString}`;
  } else {
    return '';
  }
};

const hasBanner = (bidReq: StroeerBidRequest): boolean => {
  // `mediaType` is a legacy, deprecated single-mediaType override; it is not part of BidRequest's
  // declared shape, but some callers (e.g. s2s) may still set it.
  const legacyMediaType = (bidReq as { mediaType?: MediaType }).mediaType;
  return !!((!bidReq.mediaTypes && !legacyMediaType) ||
    (bidReq.mediaTypes && bidReq.mediaTypes.banner) ||
    legacyMediaType === BANNER);
};

const hasVideo = (bidReq: StroeerBidRequest): boolean => {
  const mediaTypes = bidReq.mediaTypes;
  return !!(mediaTypes &&
    mediaTypes.video &&
    ['instream', 'outstream'].indexOf(mediaTypes.video.context) > -1);
};

const mapToPayloadBaseBid = (bidRequest: StroeerBidRequest): StroeerBaseBid => {
  const bid: StroeerBaseBid = {
    bid: bidRequest.bidId,
    sid: bidRequest.params.sid,
    viz: elementInView(bidRequest.adUnitCode),
    sfp: bidRequest.params.sfp,
    tid: bidRequest.transactionId,
  };
  copyDeepPaths(bid, bidRequest.ortb2Imp, ['ext.gpid'], 'ortb2Imp');
  return bid;
};

const mapToPayloadBannerBid = (bidRequest: StroeerBidRequest): StroeerBannerBid => {
  const sizes: Size[] = deepAccess(bidRequest, 'mediaTypes.banner.sizes') || [];
  return ({
    ban: {
      siz: sizes,
      fp: createFloorPriceObject(BANNER, sizes, bidRequest)
    },
    ...mapToPayloadBaseBid(bidRequest)
  });
};

const mapToPayloadVideoBid = (bidRequest: StroeerBidRequest): StroeerVideoBid => {
  const video = deepAccess(bidRequest, 'mediaTypes.video') || {};
  return {
    vid: {
      ctx: video.context,
      siz: video.playerSize,
      mim: video.mimes,
      fp: createFloorPriceObject(VIDEO, [video.playerSize], bidRequest),
    },
    ...mapToPayloadBaseBid(bidRequest)
  };
};

const createFloorPriceObject = (mediaType: MediaType, sizes: Size[], bidRequest: StroeerBidRequest): StroeerFloorPrice | undefined => {
  if (!bidRequest.getFloor) {
    return undefined;
  }

  const defaultFloor = bidRequest.getFloor({
    currency: 'EUR',
    mediaType: mediaType,
    size: '*'
  }) || {};

  const sizeFloors = sizes.map(size => {
    const floor = bidRequest.getFloor({
      currency: 'EUR',
      mediaType: mediaType,
      size: [size[0], size[1]]
    }) || {};
    return { ...floor, size };
  });

  const floorWithCurrency = (([defaultFloor].concat(sizeFloors)) || []).find(floor => floor.currency);

  if (!floorWithCurrency) {
    return undefined;
  }

  const currency = floorWithCurrency.currency;
  const defaultFloorPrice = defaultFloor.currency === currency ? defaultFloor.floor : undefined;

  return {
    def: defaultFloorPrice,
    cur: currency,
    siz: sizeFloors
      .filter(sizeFloor => sizeFloor.currency === currency)
      .filter(sizeFloor => sizeFloor.floor !== defaultFloorPrice)
      .map(sizeFloor => ({
        w: sizeFloor.size[0],
        h: sizeFloor.size[1],
        p: sizeFloor.floor
      }))
  };
};

const copyDeepPaths = (target: object, source: object, paths: string[], targetPrefix = ''): void => {
  paths.forEach(path => {
    const value = deepAccess(source, path);
    if (value !== undefined) {
      const targetPath = targetPrefix
        ? `${targetPrefix}.${path}`
        : path;

      deepSetValue(target, targetPath, value);
    }
  });
};

registerBidder(spec);
