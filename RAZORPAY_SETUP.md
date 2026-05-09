# Razorpay Test Integration — Setup

The Buy Now button on the listing detail page now opens Razorpay Checkout.
This is wired in **test mode** so no real money moves.

## 1. Get a Test API Key Pair

1. Sign in at https://dashboard.razorpay.com.
2. Toggle the **Test Mode** switch (top right of the dashboard).
3. Go to **Settings → API Keys** and click **Generate Test Key**.
4. Copy the `Key Id` (starts with `rzp_test_…`) and the `Key Secret`.

## 2. Configure the Backend

Open `backend/.env` and fill in the two new values:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_CURRENCY=INR
```

Restart the backend (`npm run dev`) so the new env vars are picked up. The frontend
does **not** need a Razorpay env var — the publishable Key Id is sent down by the
`/api/payments/orders` endpoint.

## 3. How the Flow Works

1. Buyer clicks **Buy Now** on `/marketplace/:id`.
2. Frontend calls `POST /api/payments/orders` with the listing id.
3. Backend creates a Razorpay order (amount = `listing.price` × 100 paise) and
   returns the `orderId` + the publishable `keyId`.
4. Frontend opens Razorpay Checkout with that order.
5. After payment, Checkout invokes our `handler` with `razorpay_order_id`,
   `razorpay_payment_id` and `razorpay_signature`.
6. Frontend calls `POST /api/payments/verify`. The backend verifies the HMAC-SHA256
   signature, marks the listing as `sold`, and creates a completed `Transaction`
   record with `paymentMethod: 'razorpay'`.
7. Buyer is redirected to `/transactions`.

## 4. Test Cards

Razorpay test mode accepts these card numbers (any future expiry, any CVV, any name):

- **Success:** `4111 1111 1111 1111`
- **Failure:** `5267 3181 8797 5449` (declined)

Test UPI: use VPA `success@razorpay` for success, `failure@razorpay` for failure.

Full reference: https://razorpay.com/docs/payments/payments/test-card-upi-details/

## 5. Files Touched

Backend:
- `config/index.js` — added `razorpay` config block
- `models/Transaction.js` — added `'razorpay'` to `paymentMethod` enum, added
  `razorpay.{orderId, paymentId, signature}` sub-document
- `controllers/paymentController.js` — new `createOrder` + `verifyPayment`
- `routes/payments.js` — new router mounted at `/api/payments`
- `server.js` — registers the new router

Frontend:
- `services/api.js` — added `paymentAPI`
- `utils/razorpay.js` — Checkout script loader
- `pages/marketplace/ListingDetail.js` — Buy Now button + handler

## 6. Notes / Limitations

- The frontend `handleBuyNow` blocks self-purchase, sold/reserved listings and
  zero-priced listings.
- The backend re-checks all of the above before creating the order — never trust
  the client.
- A `paymentMethod: 'razorpay'` transaction is created with status `completed`.
  The wallet/escrow flow is intentionally bypassed for direct purchases.
- When you go to **production**, replace the test key with a live key
  (`rzp_live_…`) and consider also enabling **Razorpay webhooks** to confirm
  payment status independently of the browser callback.
