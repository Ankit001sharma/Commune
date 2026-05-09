// Lazy-loads the Razorpay Checkout script and resolves once window.Razorpay
// is available. Safe to call multiple times — it reuses the same <script>
// element if the loader was triggered before.

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;

export const loadRazorpayScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only be loaded in the browser'));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay));
      existing.addEventListener('error', () => {
        scriptPromise = null;
        reject(new Error('Failed to load Razorpay Checkout'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay Checkout'));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
};

export default loadRazorpayScript;
