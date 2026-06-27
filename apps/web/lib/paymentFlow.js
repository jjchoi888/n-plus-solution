const PAYMENT_CONTEXT_KEY = "nplus_pending_payment_context";
const PAYMENT_CONTEXT_MAX_AGE_MS = 1000 * 60 * 30;

const safeParseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeReservationIds = (value) => {
  const values = Array.isArray(value) ? value : [value];

  return Array.from(
    new Set(
      values
        .flatMap((item) => (Array.isArray(item) ? item : [item]))
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
};

const normalizeReservationStatus = (status) => String(status || "").trim().toUpperCase();

const PENDING_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "INITIATED",
  "UNPAID",
  "PAYMENT_PENDING",
  "AWAITING_PAYMENT",
]);

const FAILED_STATUSES = new Set([
  "FAILED",
  "FAIL",
  "ERROR",
  "CANCELLED",
  "CANCELED",
  "DECLINED",
  "VOID",
  "REJECTED",
  "EXPIRED",
  "REFUNDED",
]);

const SUCCESS_STATUSES = new Set([
  "SUCCESS",
  "PAID",
  "APPROVED",
  "BOOKED",
  "CONFIRMED",
  "COMPLETED",
  "RESERVED",
  "CHECKED_IN",
]);

export const extractReservationIds = (payload) => {
  const result = new Set();

  const visit = (candidate) => {
    if (!candidate) return;

    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = safeParseJson(trimmed);
        if (parsed) visit(parsed);
      }
      return;
    }

    if (typeof candidate !== "object") return;

    [
      candidate.res_ids,
      candidate.resIds,
      candidate.reservation_ids,
      candidate.reservationIds,
      candidate.res_id,
      candidate.resId,
      candidate.reservation_id,
      candidate.reservationId,
    ]
      .flatMap(normalizeReservationIds)
      .forEach((reservationId) => result.add(reservationId));

    visit(candidate.data);
    visit(candidate.booking);
    visit(candidate.bookings);
    visit(candidate.reservation);
    visit(candidate.reservations);
    visit(candidate.result);
    visit(candidate.results);
  };

  visit(payload);
  return Array.from(result);
};

export const savePendingPaymentContext = (context) => {
  if (typeof window === "undefined") return;

  const nextContext = {
    createdAt: Date.now(),
    routeType: context?.routeType === "hotel" ? "hotel" : "portal",
    hotelCode: String(context?.hotelCode || "").trim(),
    guestEmail: String(context?.guestEmail || "").trim(),
    lang: String(context?.lang || "").trim(),
    reservationIds: normalizeReservationIds(context?.reservationIds),
  };

  window.localStorage.setItem(PAYMENT_CONTEXT_KEY, JSON.stringify(nextContext));
};

export const getPendingPaymentContext = () => {
  if (typeof window === "undefined") return null;

  const rawValue = window.localStorage.getItem(PAYMENT_CONTEXT_KEY);
  if (!rawValue) return null;

  const parsed = safeParseJson(rawValue);
  if (!parsed || typeof parsed !== "object") {
    window.localStorage.removeItem(PAYMENT_CONTEXT_KEY);
    return null;
  }

  const createdAt = Number(parsed.createdAt || 0);
  if (!createdAt || Date.now() - createdAt > PAYMENT_CONTEXT_MAX_AGE_MS) {
    window.localStorage.removeItem(PAYMENT_CONTEXT_KEY);
    return null;
  }

  return {
    ...parsed,
    routeType: parsed.routeType === "hotel" ? "hotel" : "portal",
    hotelCode: String(parsed.hotelCode || "").trim(),
    guestEmail: String(parsed.guestEmail || "").trim(),
    lang: String(parsed.lang || "").trim(),
    reservationIds: normalizeReservationIds(parsed.reservationIds),
  };
};

export const clearPendingPaymentContext = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PAYMENT_CONTEXT_KEY);
};

export const isReservationPendingStatus = (status) =>
  PENDING_STATUSES.has(normalizeReservationStatus(status));

export const isReservationFailedStatus = (status) =>
  FAILED_STATUSES.has(normalizeReservationStatus(status));

export const isReservationSuccessfulStatus = (status) =>
  SUCCESS_STATUSES.has(normalizeReservationStatus(status));
