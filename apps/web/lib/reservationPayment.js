export const RESERVATION_PAYMENT_METHODS = [
  { value: 'CARD', label: 'Card' },
  { value: 'QR', label: 'QR Ph' },
  { value: 'E-WALLET', label: 'E-wallet' }
];

export const DEFAULT_RESERVATION_PAYMENT_METHOD = 'CARD';

export const normalizeReservationPaymentMethod = (value = DEFAULT_RESERVATION_PAYMENT_METHOD) => {
  const raw = String(value || '').trim().toUpperCase();

  if (raw.includes('GCASH') || raw.includes('MAYA') || raw.includes('PAYMAYA') || raw.includes('EWALLET') || raw.includes('E-WALLET')) {
    return 'E-WALLET';
  }

  if (raw.includes('QR')) {
    return 'QR';
  }

  if (raw.includes('CARD') || raw.includes('CREDIT') || raw.includes('DEBIT') || raw.includes('VISA') || raw.includes('MASTERCARD')) {
    return 'CARD';
  }

  return DEFAULT_RESERVATION_PAYMENT_METHOD;
};

export const getReservationPaymentFields = (method = DEFAULT_RESERVATION_PAYMENT_METHOD) => {
  const paymentMethod = normalizeReservationPaymentMethod(method);

  return {
    payment_method: paymentMethod,
    payment_method_type: paymentMethod,
    payment_method_name: paymentMethod,
    payment_channel: 'PG'
  };
};

export const RESERVATION_PAYMENT_FIELDS = getReservationPaymentFields(DEFAULT_RESERVATION_PAYMENT_METHOD);
