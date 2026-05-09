import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { listingAPI, chatAPI, paymentAPI } from '../../services/api';
import { loadRazorpayScript } from '../../utils/razorpay';
import { useAuth } from '../../context/AuthContext';
import {
  HeartIcon, HeartFilledIcon, MapPinIcon, ClockIcon, EyeIcon, TagIcon,
  MessageCircleIcon, EditIcon, TrashIcon, ImageIcon, StarIcon,
  ChevronRightIcon,
} from '../../components/Icons';
import { toast } from '../../components/ui/Toast';
import AppImage from '../../components/common/AppImage';
import { resolveImageUrl } from '../../utils/image';
import LiveTrackingMap from '../../components/location/LiveTrackingMap';
import LeafletLocationMap from '../../components/location/LeafletLocationMap';
import BackButton from '../../components/common/BackButton';

const isValidObjectId = (value) => (
  /^[a-fA-F0-9]{24}$/.test(`${value || ''}`)
);

const shouldDebugLocation = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('cx_debug_location') === 'true';
};

const buyerLocationStorageKey = 'cx_buyer_location';
const buyerGeocodeCacheKey = 'cx_buyer_geocode_cache';

const buildDefaultBuyerLocation = () => ({
  mode: 'manual',
  manualAddress: '',
  displayText: '',
  coordinates: { lat: '', lng: '' },
});

const loadBuyerLocation = () => {
  if (typeof window === 'undefined') return buildDefaultBuyerLocation();
  try {
    const raw = window.localStorage?.getItem(buyerLocationStorageKey);
    if (!raw) return buildDefaultBuyerLocation();
    const parsed = JSON.parse(raw);
    const base = buildDefaultBuyerLocation();
    return {
      ...base,
      ...parsed,
      manualAddress: parsed?.manualAddress ?? parsed?.address ?? base.manualAddress,
      displayText: parsed?.displayText ?? parsed?.locationText ?? parsed?.address ?? base.displayText,
      coordinates: {
        ...base.coordinates,
        ...(parsed?.coordinates || {}),
      },
    };
  } catch (_) {
    return buildDefaultBuyerLocation();
  }
};

const loadBuyerGeocodeCache = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage?.getItem(buyerGeocodeCacheKey);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
};

const saveBuyerGeocodeCache = (cache) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(buyerGeocodeCacheKey, JSON.stringify(cache));
  } catch (_) {
    // ignore
  }
};

const sanitizeAddress = (input = '') => (
  `${input || ''}`
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/\s*[.\-]+\s*$/g, '')
    .replace(/\s*,\s*$/g, '')
    .trim()
);

const buildGeocodeCandidates = (input = '') => {
  const sanitized = sanitizeAddress(input);
  const parts = sanitized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = [];
  if (sanitized) candidates.push(sanitized);
  if (parts.length > 1) candidates.push(parts.slice(1).join(', '));
  if (parts.length > 2) candidates.push(parts.slice(-2).join(', '));

  return candidates.filter((candidate, index) => (
    candidate && candidates.indexOf(candidate) === index
  ));
};

const parseCoordinate = (value, min, max) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
};

const toRadians = (value) => (value * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const radius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
};

const forwardGeocodeBuyer = async (query, signal) => {
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept-Language': 'en',
    },
    signal,
  });

  if (!response.ok) return null;
  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : null;
  if (!result?.lat || !result?.lon) return null;

  const lat = parseCoordinate(result.lat, -90, 90);
  const lng = parseCoordinate(result.lon, -180, 180);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const text = result.display_name || query;
  return { lat, lng, text };
};

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, toggleSavedItem, isItemSaved } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('idle');
  const [trackingError, setTrackingError] = useState(null);
  const [geocodeRetrying, setGeocodeRetrying] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);

  const [buyerLocation, setBuyerLocation] = useState(() => loadBuyerLocation());
  const [buyerStatus, setBuyerStatus] = useState('idle');
  const [buyerError, setBuyerError] = useState(null);
  const [buyerGeocodeStatus, setBuyerGeocodeStatus] = useState('idle');
  const [buyerGeocodeError, setBuyerGeocodeError] = useState(null);

  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastCoordsRef = useRef(null);
  const pollRef = useRef(null);
  const trackingActiveRef = useRef(false);
  const buyerWatchIdRef = useRef(null);
  const buyerLastUpdateRef = useRef(0);
  const buyerGeocodeAbortRef = useRef(null);

  useEffect(() => {
    let isActive = true;
    const listingId = `${id || ''}`.trim();

    setLoading(true);
    setError(null);
    setListing(null);

    if (!isValidObjectId(listingId)) {
      if (isActive) {
        setError({ type: 'invalid_id' });
        setLoading(false);
      }
      return () => {
        isActive = false;
      };
    }

    const fetchListing = async () => {
      try {
        const { data } = await listingAPI.getById(listingId);
        const payload = data?.data;

        if (!payload || typeof payload !== 'object') {
          if (isActive) {
            setError({ type: 'failed' });
          }
          return;
        }

        if (payload?.deleted || payload?.isDeleted) {
          if (isActive) {
            setError({ type: 'deleted' });
          }
          return;
        }

        if (isActive) {
          setListing(payload);
        }
      } catch (err) {
        if (!isActive) return;

        if (err?.response?.status === 404) {
          setError({ type: 'not_found' });
          return;
        }

        setError({ type: 'failed' });
        toast.error('Failed to load listing');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchListing();

    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    trackingActiveRef.current = trackingActive;
  }, [trackingActive]);

  const isFavorited = listing ? isItemSaved(listing._id, 'listing') : false;
  const isOwner = user?._id === listing?.seller?._id;

  const normalizedLocation = useMemo(() => {
    if (!listing?.location) return null;
    if (typeof listing.location === 'string') {
      return {
        address: listing.location,
        locationText: listing.location,
        mode: 'manual',
        trackingActive: false,
        coordinates: { lat: null, lng: null },
        updatedAt: null,
      };
    }

    return {
      ...listing.location,
      locationText: listing.location.locationText || listing.location.address || null,
      coordinates: listing.location.coordinates || { lat: null, lng: null },
    };
  }, [listing]);

  const remoteTrackingActive = Boolean(normalizedLocation?.trackingActive);
  const isLiveProductLocation = normalizedLocation?.mode === 'live';
  const isManualProductLocation = normalizedLocation?.mode === 'manual';

  const sellerLat = parseCoordinate(normalizedLocation?.coordinates?.lat, -90, 90);
  const sellerLng = parseCoordinate(normalizedLocation?.coordinates?.lng, -180, 180);

  const buyerTrackingActive = buyerLocation.mode === 'live';
  const rawBuyerLat = parseCoordinate(buyerLocation?.coordinates?.lat, -90, 90);
  const rawBuyerLng = parseCoordinate(buyerLocation?.coordinates?.lng, -180, 180);
  const buyerLat = isLiveProductLocation && !buyerTrackingActive ? null : rawBuyerLat;
  const buyerLng = isLiveProductLocation && !buyerTrackingActive ? null : rawBuyerLng;

  const distanceKm = useMemo(
    () => haversineKm(sellerLat, sellerLng, buyerLat, buyerLng),
    [sellerLat, sellerLng, buyerLat, buyerLng]
  );

  const distanceLabel = useMemo(() => {
    if (!Number.isFinite(distanceKm)) return null;
    return `${distanceKm.toFixed(1)} km away`;
  }, [distanceKm]);

  const sellerMapsUrl = Number.isFinite(sellerLat) && Number.isFinite(sellerLng)
    ? `https://www.google.com/maps?q=${sellerLat},${sellerLng}`
    : null;

  const sellerHasCoords = Number.isFinite(sellerLat) && Number.isFinite(sellerLng);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(
        buyerLocationStorageKey,
        JSON.stringify(buyerLocation)
      );
    } catch (_) {
      // ignore storage errors
    }
  }, [buyerLocation]);

  const updateBuyerLocation = (patch) => {
    setBuyerLocation((prev) => ({
      ...prev,
      ...patch,
      coordinates: {
        ...(prev.coordinates || {}),
        ...(patch.coordinates || {}),
      },
    }));
  };

  const stopBuyerLive = () => {
    if (buyerWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(buyerWatchIdRef.current);
      buyerWatchIdRef.current = null;
    }
    setBuyerStatus('idle');
    setBuyerGeocodeStatus('idle');
    setBuyerLocation((prev) => ({
      ...prev,
      mode: 'manual',
      displayText: prev.manualAddress || '',
    }));
  };

  const startBuyerLive = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported in this browser');
      return;
    }

    if (buyerWatchIdRef.current !== null) return;

    setBuyerError(null);
    setBuyerStatus('starting');
    setBuyerLocation((prev) => ({
      ...prev,
      mode: 'live',
      displayText: 'Live detected location',
    }));
    setBuyerGeocodeStatus('idle');

    if (shouldDebugLocation()) {
      console.debug('[location] buyer tracking start');
    }

    buyerWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - buyerLastUpdateRef.current < 4000) return;
        buyerLastUpdateRef.current = now;

        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);

        setBuyerLocation((prev) => ({
          ...prev,
          mode: 'live',
          displayText: 'Live detected location',
          coordinates: { lat, lng },
        }));

        setBuyerStatus('active');
        setBuyerGeocodeError(null);

        if (shouldDebugLocation()) {
          console.debug('[location] buyer geolocation update', { lat, lng });
        }
      },
      (error) => {
        if (buyerWatchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(buyerWatchIdRef.current);
          buyerWatchIdRef.current = null;
        }

        setBuyerLocation((prev) => ({
          ...prev,
          mode: 'manual',
          displayText: prev.manualAddress || '',
        }));
        setBuyerStatus('error');

        const message =
          error?.code === 1
            ? 'Location permission denied'
            : error?.code === 3
              ? 'Location request timed out'
              : 'Unable to fetch live location';

        setBuyerError(message);
        toast.error(message);

        if (shouldDebugLocation()) {
          console.debug('[location] buyer geolocation error', error);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => () => {
    if (buyerWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(buyerWatchIdRef.current);
      buyerWatchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (buyerLocation.mode === 'live') {
      setBuyerGeocodeStatus('idle');
      setBuyerGeocodeError(null);
      return;
    }

    const address = buyerLocation.manualAddress?.trim() || '';
    if (!address) {
      setBuyerGeocodeStatus('idle');
      setBuyerGeocodeError(null);
      setBuyerLocation((prev) => ({
        ...prev,
        coordinates: { lat: '', lng: '' },
        displayText: prev.manualAddress || '',
      }));
      return;
    }

    const sanitized = sanitizeAddress(address);
    const cache = loadBuyerGeocodeCache();
    const cached = cache?.[sanitized];
    const cacheFresh = cached?.updatedAt && (Date.now() - cached.updatedAt < 24 * 60 * 60 * 1000);
    if (cached?.lat && cached?.lng && cacheFresh) {
      setBuyerGeocodeStatus('success');
      setBuyerGeocodeError(null);
      setBuyerLocation((prev) => ({
        ...prev,
        displayText: prev.manualAddress,
        coordinates: { lat: cached.lat, lng: cached.lng },
      }));
      return;
    }

    if (buyerGeocodeAbortRef.current) {
      buyerGeocodeAbortRef.current.abort();
      buyerGeocodeAbortRef.current = null;
    }

    const controller = new AbortController();
    buyerGeocodeAbortRef.current = controller;
    const requestAddress = address;

    setBuyerGeocodeStatus('loading');
    setBuyerGeocodeError(null);

    const timeoutId = setTimeout(async () => {
      const candidates = buildGeocodeCandidates(address);

      if (shouldDebugLocation()) {
        console.debug('[buyer geocode] candidates', {
          address,
          sanitized,
          candidates,
        });
      }

      let resolved = null;
      for (const candidate of candidates) {
        try {
          if (shouldDebugLocation()) {
            console.debug('[buyer geocode] request', { candidate });
          }
          const result = await forwardGeocodeBuyer(candidate, controller.signal);
          if (shouldDebugLocation()) {
            console.debug('[buyer geocode] response', result);
          }
          if (result?.lat && result?.lng) {
            resolved = result;
            break;
          }
        } catch (error) {
          if (error?.name === 'AbortError') {
            return;
          }
        }
      }

      if (resolved?.lat && resolved?.lng) {
        const nextCache = {
          ...cache,
          [sanitized]: {
            lat: resolved.lat,
            lng: resolved.lng,
            text: resolved.text || address,
            updatedAt: Date.now(),
          },
        };
        saveBuyerGeocodeCache(nextCache);
        setBuyerGeocodeStatus('success');
        setBuyerGeocodeError(null);
        setBuyerLocation((prev) => {
          if (prev.manualAddress?.trim() !== requestAddress) return prev;
          return {
            ...prev,
            displayText: prev.manualAddress,
            coordinates: { lat: resolved.lat, lng: resolved.lng },
          };
        });
      } else {
        setBuyerGeocodeStatus('error');
        setBuyerGeocodeError('Could not detect your approximate location');
        setBuyerLocation((prev) => {
          if (prev.manualAddress?.trim() !== requestAddress) return prev;
          return {
            ...prev,
            coordinates: { lat: '', lng: '' },
          };
        });
      }
    }, 700);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [buyerLocation.manualAddress, buyerLocation.mode]);

  const applyLocationUpdate = (nextLocation) => {
    if (!nextLocation) return;
    setListing((prev) => {
      if (!prev) return prev;
      return { ...prev, location: nextLocation };
    });
  };

  const sendLocationUpdate = async (payload) => {
    if (!listing?._id) return null;
    try {
      if (shouldDebugLocation()) {
        console.debug('[location] update request', payload);
      }
      const { data } = await listingAPI.updateLocation(listing._id, payload);
      const nextLocation = data?.data;
      if (nextLocation) {
        applyLocationUpdate(nextLocation);
      }
      if (shouldDebugLocation()) {
        console.debug('[location] update response', nextLocation);
      }
      return nextLocation;
    } catch (err) {
      if (shouldDebugLocation()) {
        console.debug('[location] update failed', err);
      }
      return null;
    }
  };

  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported in this browser');
      return;
    }

    if (watchIdRef.current !== null) return;

    setTrackingError(null);
    setTrackingStatus('starting');

    if (shouldDebugLocation()) {
      console.debug('[location] tracking start');
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        lastCoordsRef.current = { lat, lng };
        const baseLocation = normalizedLocation || {
          address: 'Campus',
          locationText: 'Campus',
          mode: 'live',
          trackingActive: true,
          coordinates: { lat: null, lng: null },
        };

        setTrackingActive(true);
        setTrackingStatus('active');

        applyLocationUpdate({
          ...baseLocation,
          mode: 'live',
          trackingActive: true,
          coordinates: { lat, lng },
          updatedAt: new Date().toISOString(),
        });

        if (shouldDebugLocation()) {
          console.debug('[location] geolocation update', { lat, lng });
        }

        const now = Date.now();
        if (now - lastSentRef.current < 8000) return;
        lastSentRef.current = now;

        sendLocationUpdate({
          locationLat: lat,
          locationLng: lng,
          locationMode: 'live',
          trackingActive: true,
        });
      },
      (error) => {
        watchIdRef.current = null;
        setTrackingActive(false);
        setTrackingStatus('error');
        setTrackingError(error?.message || 'Unable to fetch live location');

        if (shouldDebugLocation()) {
          console.debug('[location] geolocation error', error);
        }

        if (error?.code === 1) {
          toast.error('Location permission denied');
        } else if (error?.code === 3) {
          toast.error('Location request timed out');
        } else {
          toast.error('Unable to fetch live location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const stopLiveTracking = async () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTrackingStatus('idle');
    setTrackingActive(false);

    if (shouldDebugLocation()) {
      console.debug('[location] tracking stop');
    }

    const fallbackCoords = lastCoordsRef.current || normalizedLocation?.coordinates || {};

    await sendLocationUpdate({
      locationLat: fallbackCoords.lat,
      locationLng: fallbackCoords.lng,
      locationMode: normalizedLocation?.mode || 'manual',
      trackingActive: false,
    });
  };

  useEffect(() => () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackingActiveRef.current) {
      stopLiveTracking();
    }
  }, []);

  useEffect(() => {
    if (!listing?._id || !normalizedLocation?.trackingActive || isOwner) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const pollLocation = async () => {
      try {
        if (shouldDebugLocation()) {
          console.debug('[location] poll start');
        }
        const { data } = await listingAPI.getLocation(listing._id);
        const nextLocation = data?.data;
        if (nextLocation) {
          applyLocationUpdate(nextLocation);
        }
        if (shouldDebugLocation()) {
          console.debug('[location] poll response', nextLocation);
        }
      } catch (err) {
        if (shouldDebugLocation()) {
          console.debug('[location] poll failed', err);
        }
      }
    };

    pollLocation();
    pollRef.current = setInterval(pollLocation, 10000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [listing?._id, normalizedLocation?.trackingActive, isOwner]);

  useEffect(() => {
    if (!shouldDebugLocation()) return;
    console.debug('[distance] inputs', {
      sellerLat,
      sellerLng,
      buyerLat,
      buyerLng,
      distanceKm,
    });
    if ([sellerLat, sellerLng, buyerLat, buyerLng].every(Number.isFinite)) {
      console.debug('[distance] radians', {
        sellerLat: toRadians(sellerLat),
        sellerLng: toRadians(sellerLng),
        buyerLat: toRadians(buyerLat),
        buyerLng: toRadians(buyerLng),
      });
    }
  }, [sellerLat, sellerLng, buyerLat, buyerLng, distanceKm]);

  useEffect(() => {
    if (!shouldDebugLocation()) return;
    console.debug('[buyer] state', {
      mode: buyerLocation.mode,
      manualAddress: buyerLocation.manualAddress,
      displayText: buyerLocation.displayText,
      coords: buyerLocation.coordinates,
      geocodeStatus: buyerGeocodeStatus,
    });
  }, [buyerLocation, buyerGeocodeStatus]);

  const handleFavorite = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      await toggleSavedItem(listing._id, 'listing');
    } catch (err) {
      toast.error(err.message || 'Failed to update saved state');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    setDeleting(true);
    try {
      await listingAPI.delete(id);
      toast.success('Listing deleted');
      navigate('/marketplace');
    } catch (err) {
      toast.error('Failed to delete listing');
    } finally {
      setDeleting(false);
    }
  };

  const handleBuyNow = async () => {
    console.log('[buy-now] click', {
      listingId: listing?._id,
      status: listing?.status,
      price: listing?.price,
      isAuthenticated,
      isOwner,
    });

    if (!isAuthenticated) return navigate('/login');
    if (!listing?._id) {
      console.warn('[buy-now] no listing id');
      return;
    }
    if (isOwner) {
      toast.error('You cannot buy your own listing');
      return;
    }
    if (listing.status && listing.status !== 'available' && listing.status !== 'active') {
      toast.error(`This listing is ${listing.status}`);
      return;
    }
    if (!Number.isFinite(Number(listing.price)) || Number(listing.price) <= 0) {
      toast.error('This listing has no payable price');
      return;
    }

    setPaying(true);
    let opened = false;
    try {
      console.log('[buy-now] loading razorpay script');
      const Razorpay = await loadRazorpayScript();
      console.log('[buy-now] razorpay loaded?', Boolean(Razorpay));
      if (!Razorpay) {
        toast.error('Could not load Razorpay. Disable ad-blockers and retry.');
        return;
      }

      console.log('[buy-now] requesting order from backend');
      const { data } = await paymentAPI.createOrder(listing._id);
      console.log('[buy-now] order response', data);
      const order = data?.data;
      if (!order?.orderId || !order?.keyId) {
        toast.error('Failed to create payment order');
        return;
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'CommuneX',
        description: order.listing?.title || listing.title,
        prefill: {
          name: order.buyer?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: order.buyer?.email || user?.email || '',
        },
        notes: {
          listingId: listing._id,
        },
        theme: { color: '#2563eb' },
        handler: async (response) => {
          console.log('[buy-now] checkout success', response);
          try {
            await paymentAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              listingId: listing._id,
            });
            toast.success('Payment successful');
            setListing((prev) => (prev ? { ...prev, status: 'sold' } : prev));
            navigate('/transactions');
          } catch (err) {
            console.error('[buy-now] verify failed', err);
            const msg = err?.response?.data?.message || 'Payment verification failed';
            toast.error(msg);
          }
        },
        modal: {
          ondismiss: () => {
            console.log('[buy-now] checkout dismissed');
            setPaying(false);
          },
        },
      };

      console.log('[buy-now] opening razorpay checkout');
      const rp = new Razorpay(options);
      rp.on('payment.failed', (resp) => {
        console.error('[buy-now] payment.failed', resp);
        const msg = resp?.error?.description || 'Payment failed';
        toast.error(msg);
        setPaying(false);
      });
      rp.open();
      opened = true;
    } catch (err) {
      console.error('[buy-now] error', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      const msg =
        serverMsg ||
        err?.message ||
        'Could not start payment';
      toast.error(status ? `${status}: ${msg}` : msg);
    } finally {
      if (!opened) setPaying(false);
    }
  };

  const handleContact = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const { data } = await chatAPI.createConversation({
        recipientId: listing.seller._id,
        listingId: listing._id,
      });
      navigate(`/chat/${data.data._id}`);
    } catch (err) {
      toast.error('Failed to start conversation');
    }
  };

  const retryManualGeocode = async () => {
    if (!listing?._id || !normalizedLocation) return;

    const address =
      normalizedLocation.locationText ||
      normalizedLocation.address ||
      locationLabel || '';

    if (!address.trim()) {
      toast.error('Provide a location address to geocode');
      return;
    }

    setGeocodeRetrying(true);
    const next = await sendLocationUpdate({
      locationAddress: address.trim(),
      locationMode: 'manual',
      forceGeocode: true,
    });
    setGeocodeRetrying(false);

    if (!next?.coordinates?.lat || !next?.coordinates?.lng) {
      toast.error('Unable to resolve coordinates. Try a more specific address.');
    } else {
      toast.success('Location coordinates updated');
    }
  };

  const handleCopyAddress = async () => {
    if (!locationLabel) return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(locationLabel);
      setCopyStatus('Address copied');
    } catch (err) {
      setCopyStatus('Could not copy address');
    }

    setTimeout(() => {
      setCopyStatus(null);
    }, 1800);
  };

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getInitials = (u) => {
    if (!u) return '??';
    return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading listing...</p>
      </div>
    );
  }

  if (error) {
    const errorTitle =
      error.type === 'invalid_id'
        ? 'Invalid listing link'
        : error.type === 'deleted'
          ? 'This listing no longer exists'
          : error.type === 'not_found'
            ? 'Listing not found'
            : 'Failed to load listing';

    const errorMessage =
      error.type === 'invalid_id'
        ? 'The link to this listing appears to be invalid.'
        : error.type === 'deleted'
          ? 'The item may have been deleted by the owner.'
          : error.type === 'not_found'
            ? 'This listing may have been removed or is no longer available.'
            : 'Something went wrong while loading this item.';

    return (
      <div className="page-container">
        <BackButton fallback="/marketplace" />

        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
          }}
        >
          <h2>{errorTitle}</h2>

          <p
            style={{
              marginTop: 12,
              opacity: 0.7,
            }}
          >
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="page-container">
        <BackButton fallback="/marketplace" />

        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
          }}
        >
          <h2>Failed to load listing</h2>

          <p
            style={{
              marginTop: 12,
              opacity: 0.7,
            }}
          >
            Something went wrong while loading this item.
          </p>
        </div>
      </div>
    );
  }

  const images = listing.images || [];
  const locationLabel =
    normalizedLocation?.locationText ||
    normalizedLocation?.address ||
    (typeof listing.location === 'string' ? listing.location : null);

  return (
    <div className="page-container">
      <BackButton fallback="/marketplace" />
      <div className="breadcrumb">
        <Link to="/marketplace">Marketplace</Link>
        <ChevronRightIcon size={14} />
        <span>{listing.category}</span>
        <ChevronRightIcon size={14} />
        <span>{listing.title}</span>
      </div>

      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-main-image">
            {images.length > 0 ? (
              <AppImage
                src={resolveImageUrl(images[selectedImage]?.url)}
                height={400}
              />
            ) : (
              <div className="card-image-placeholder" style={{ height: 400 }}>
                <ImageIcon size={64} />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="detail-thumbnails">
              {images.map((img, i) => (
                <div
                  key={i}
                  className={`detail-thumbnail ${selectedImage === i ? 'active' : ''}`}
                  onClick={() => setSelectedImage(i)}
                >
                  <img src={resolveImageUrl(img.url)} alt={`${listing.title} ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-info-header">
            <div>
              <span className="card-category">{listing.category}</span>
              {listing.condition && (
                <span className="tag" style={{ marginLeft: 8 }}>{listing.condition}</span>
              )}
              <span className={`badge ${listing.status === 'available' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 8 }}>
                {listing.status}
              </span>
            </div>
          </div>

          <h1 className="detail-title">{listing.title}</h1>

          <div className="detail-price">
            {listing.price === 0 ? 'Free' : `₹${listing.price?.toLocaleString()}`}
            {listing.negotiable && <span className="badge badge-success" style={{ marginLeft: 12 }}>Negotiable</span>}
          </div>

          <div className="detail-meta">
            <span><ClockIcon size={16} /> Listed {timeAgo(listing.createdAt)}</span>
            <span><EyeIcon size={16} /> {listing.views || 0} views</span>
            {locationLabel && <span><MapPinIcon size={16} /> {locationLabel}</span>}
          </div>

          <div className="detail-section">
            <h3>Location</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <MapPinIcon size={16} />
                  <span>Product Location</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
                  <div className="text-muted" style={{ flex: 1 }}>
                    {locationLabel || 'Location not available'}
                  </div>
                  {isManualProductLocation && locationLabel && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleCopyAddress}
                        aria-label="Copy address"
                        title="Copy address"
                        style={{ padding: 6, minHeight: 'auto', lineHeight: 0 }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      {copyStatus && (
                        <span
                          className="text-muted"
                          style={{
                            position: 'absolute',
                            top: -22,
                            right: 0,
                            fontSize: '0.75rem',
                            background: 'var(--cx-bg-elevated)',
                            border: '1px solid var(--cx-border)',
                            padding: '2px 6px',
                            borderRadius: 6,
                            boxShadow: 'var(--cx-shadow-sm)',
                          }}
                        >
                          {copyStatus === 'Address copied' ? 'Copied' : 'Could not copy'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!sellerHasCoords && (
                  <div style={{ marginTop: 8 }}>
                    <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                      {normalizedLocation?.geocodeError || ''}
                    </div>
                  </div>
                )}
              </div>

              {isLiveProductLocation && (
                <>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <MapPinIcon size={16} />
                      <span>Your Location</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className={`btn ${buyerTrackingActive ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={buyerTrackingActive ? stopBuyerLive : startBuyerLive}
                      >
                        {buyerTrackingActive ? 'Stop Live Location' : 'Use Live Location'}
                      </button>
                      {buyerStatus === 'starting' && (
                        <span className="badge badge-warning">Detecting...</span>
                      )}
                      {buyerStatus === 'active' && (
                        <span className="badge badge-success">Live</span>
                      )}
                    </div>
                    {buyerTrackingActive && (
                      <div className="text-muted" style={{ marginTop: 6, fontSize: '0.82rem' }}>
                        Live detected location
                      </div>
                    )}
                    {buyerError && (
                      <p className="text-muted" style={{ marginTop: 8 }}>
                        {buyerError}
                      </p>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <MapPinIcon size={16} />
                      <span>Distance</span>
                    </div>
                    <div className="text-muted" style={{ marginTop: 6 }}>
                      {distanceLabel || 'Distance unavailable'}
                    </div>
                  </div>
                </>
              )}

              {sellerMapsUrl && (
                <a className="btn btn-ghost" href={sellerMapsUrl} target="_blank" rel="noreferrer">
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>

          {normalizedLocation && isLiveProductLocation && (
            <LiveTrackingMap location={normalizedLocation} title={`${listing.title} tracking`} showMapsLink={false} />
          )}
          {normalizedLocation && isManualProductLocation && sellerHasCoords && (
            <div className="tracking-card" style={{ padding: 0 }}>
              <LeafletLocationMap
                lat={sellerLat}
                lng={sellerLng}
                label={locationLabel || 'Product location'}
                className="tracking-map"
              />
            </div>
          )}

          <div className="detail-section">
            <h3>Description</h3>
            <p className="detail-description">{listing.description}</p>
          </div>

          {listing.tags?.length > 0 && (
            <div className="detail-section">
              <h3>Tags</h3>
              <div className="detail-tags">
                {listing.tags.map((tag, i) => (
                  <span key={i} className="tag"><TagIcon size={12} /> {tag}</span>
                ))}
              </div>
            </div>
          )}

          {isOwner && (
            <div className="detail-section">
              <h3>Live Tracking</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className={`btn ${trackingActive ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={trackingActive ? stopLiveTracking : startLiveTracking}
                >
                  {trackingActive ? 'Stop Live Tracking' : 'Start Live Tracking'}
                </button>
                {trackingStatus === 'active' && (
                  <span className="badge badge-success">Tracking active</span>
                )}
                {trackingStatus === 'starting' && (
                  <span className="badge badge-warning">Starting...</span>
                )}
                {!trackingActive && remoteTrackingActive && (
                  <span className="badge badge-info">Tracking active on server</span>
                )}
              </div>
              {trackingError && (
                <p className="text-muted" style={{ marginTop: 8 }}>
                  {trackingError}
                </p>
              )}
            </div>
          )}

          <div className="detail-section">
            <h3>Seller</h3>
            <div className="detail-seller-card" onClick={() => navigate(`/profile/${listing.seller?._id}`)} style={{ cursor: 'pointer' }}>
              <div className="detail-seller-avatar">{getInitials(listing.seller)}</div>
              <div className="detail-seller-info">
                <div className="detail-seller-name">
                  {listing.seller?.firstName} {listing.seller?.lastName}
                </div>
                <div className="detail-seller-meta">
                  {listing.seller?.department && <span>{listing.seller.department}</span>}
                  {listing.seller?.rating?.average > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StarIcon size={14} /> {listing.seller.rating.average.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="detail-actions">
            {isOwner ? (
              <>
                <button className="btn btn-primary" onClick={() => navigate(`/marketplace/edit/${listing._id}`)}>
                  <EditIcon size={18} /> Edit Listing
                </button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  <TrashIcon size={18} /> {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  onClick={handleBuyNow}
                  disabled={
                    paying ||
                    listing.status === 'sold' ||
                    listing.status === 'reserved' ||
                    !listing.price
                  }
                >
                  {paying
                    ? 'Processing...'
                    : listing.status === 'sold'
                      ? 'Sold'
                      : listing.status === 'reserved'
                        ? 'Reserved'
                        : `Buy Now${listing.price ? ` · ₹${Number(listing.price).toLocaleString()}` : ''}`}
                </button>
                <button className="btn btn-secondary" onClick={handleContact}>
                  <MessageCircleIcon size={18} /> Contact Seller
                </button>
                <button className={`btn ${isFavorited ? 'btn-secondary' : 'btn-ghost'}`} onClick={handleFavorite}>
                  {isFavorited ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
                  {isFavorited ? 'Saved' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;