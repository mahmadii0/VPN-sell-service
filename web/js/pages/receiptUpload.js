import { SCREENS, LOCK_KEYS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import {
  compressImage,
  blobToPreviewUrl,
  revokePreviewUrl
} from '../utils/image.js';
import { formatPrice } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { upload } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import { refreshShop } from '../services/shop.js';
import {
  acquireLock,
  releaseLock,
  hasValidImageSignature
} from '../utils/validate.js';

const MAX_INPUT_SIZE = 5 * 1024 * 1024;

export function renderReceiptUpload({ params } = {}) {
  const frag = useTemplate('tpl-receipt-upload');
  const root = frag.firstElementChild;
  const plan = params?.plan ?? getState().selectedPlan;

  if (!plan) {
    back();
    return frag;
  }

  fillStaticIcons(root);
  fillSummary(root, plan);
  bindActions(root, plan);

  return {
    node: frag,
    cleanup: () => {
      if (root._previewUrl) revokePreviewUrl(root._previewUrl);
    }
  };
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };

  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;

    const name = iconMap[raw] || raw;
    const size = slot.closest('.pulse-icon-btn') ? 20 : 24;
    const svg = iconNode(name, { size });

    if (svg) slot.replaceWith(svg);
  });
}

function fillSummary(root, plan) {
  const amount = root.querySelector('[data-bind="amount"]');
  if (amount) amount.textContent = formatPrice(plan.price);
}

function bindActions(root, plan) {
  const fileInput = root.querySelector('[data-role="file-input"]');

  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');

    if (action === 'back') back();
    else if (action === 'pick') fileInput?.click();
    else if (action === 'submit') submitReceipt(root, plan);
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      handleFileChange(root, fileInput);
    });
  }
}

async function handleFileChange(root, input) {
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast('فقط تصویر مجاز است', { variant: 'error' });
    input.value = '';
    return;
  }

  if (file.size > MAX_INPUT_SIZE) {
    toast('حجم تصویر باید کمتر از ۵ مگابایت باشد', {
      variant: 'error'
    });
    input.value = '';
    return;
  }

  const valid = await hasValidImageSignature(file);

  if (!valid) {
    toast('فایل انتخابی یک تصویر معتبر نیست', {
      variant: 'error'
    });
    input.value = '';
    return;
  }

  const previewSlot = root.querySelector('[data-slot="preview"]');
  const placeholder = root.querySelector('[data-slot="placeholder"]');
  const submitBtn = root.querySelector('[data-action="submit"]');

  if (root._previewUrl) {
    revokePreviewUrl(root._previewUrl);
    root._previewUrl = null;
  }

  root._compressedBlob = null;
  previewSlot.innerHTML =
      '<div class="pulse-receipt__loading">در حال پردازش تصویر…</div>';

  if (submitBtn) submitBtn.disabled = true;

  try {
    const compressed = await compressImage(file);

    if (compressed.size > 4 * 1024 * 1024) {
      throw new Error('receipt_too_large');
    }

    const url = blobToPreviewUrl(compressed);

    previewSlot.innerHTML = '';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'رسید پرداخت';
    img.className = 'pulse-receipt__image';
    previewSlot.appendChild(img);

    if (placeholder) placeholder.hidden = true;
    if (submitBtn) submitBtn.disabled = false;

    root._compressedBlob = compressed;
    root._previewUrl = url;
  } catch (err) {
    console.error('[receipt] compression failed:', err);
    previewSlot.innerHTML = '';

    toast('پردازش تصویر ناموفق بود', { variant: 'error' });

    if (placeholder) placeholder.hidden = false;
    if (submitBtn) submitBtn.disabled = true;

    input.value = '';
  }
}

async function submitReceipt(root, plan) {
  if (!acquireLock(LOCK_KEYS.RECEIPT_UPLOAD)) return;

  const blob = root._compressedBlob;

  if (!blob) {
    releaseLock(LOCK_KEYS.RECEIPT_UPLOAD);
    toast('ابتدا تصویر رسید را انتخاب کنید', {
      variant: 'warning'
    });
    return;
  }

  const submitBtn = root.querySelector('[data-action="submit"]');
  setLoading(submitBtn, true);

  try {
    const formData = new FormData();
    formData.append('package_id', plan.id);
    formData.append('receipt', blob, 'receipt.jpg');

    const res = await upload(ENDPOINTS.ORDER_CREATE.path, formData);

    if (
        !res ||
        !Number.isSafeInteger(res.id) ||
        res.id <= 0 ||
        res.status !== 'pending'
    ) {
      throw new Error(
          'پاسخ ثبت سفارش معتبر نیست؛ ثبت رسید تأیید نشد. قبل از ارسال مجدد با پشتیبانی بررسی کنید.'
      );
    }

    setState({
      paymentState: 'WAITING_ADMIN_APPROVAL',
      paymentResult: {
        paymentId: res.id,
        status: res.status,
        submittedAt: new Date().toISOString(),
        amount: plan.price
      }
    });

    void refreshShop({ sections: ['orders'] }).catch(() => {
      toast(
          'سفارش ثبت شد؛ به‌روزرسانی فهرست ناموفق بود. رسید را دوباره نفرستید.',
          { variant: 'warning' }
      );
    });

    navigate(SCREENS.PAYMENT_RESULT, { paymentId: res.id });
  } catch (err) {
    console.error('[receipt] upload failed:', err);
    toast(err?.message || 'ارسال رسید ناموفق بود', {
      variant: 'error'
    });
  } finally {
    setLoading(submitBtn, false);
    releaseLock(LOCK_KEYS.RECEIPT_UPLOAD);
  }
}

function setLoading(btn, loading) {
  if (!btn) return;

  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);
}
