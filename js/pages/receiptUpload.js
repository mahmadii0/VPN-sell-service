import { SCREENS, LOCK_KEYS } from '../core/constants.js';
import { getState, setState } from '../state/store.js';
import { navigate, back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { compressImage, blobToPreviewUrl, revokePreviewUrl } from '../utils/image.js';
import { formatPrice } from '../utils/format.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { upload } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';
import { acquireLock, releaseLock } from '../utils/validate.js';

const MAX_INPUT_SIZE = 5 * 1024 * 1024;

export function renderReceiptUpload({ params } = {}) {
  const frag = useTemplate('tpl-receipt-upload');
  const root = frag.firstElementChild;

  const plan = params?.plan ?? getState().selectedPlan;
  if (!plan) { back(); return frag; }

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
    fileInput.addEventListener('change', () => handleFileChange(root, fileInput));
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
    toast('حجم تصویر باید کمتر از ۵ مگابایت باشد', { variant: 'error' });
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

  previewSlot.innerHTML = '<div class="pulse-receipt__loading">در حال پردازش تصویر…</div>';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const compressed = await compressImage(file);
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
    toast('ابتدا تصویر رسید را انتخاب کنید', { variant: 'warning' });
    return;
  }

  const submitBtn = root.querySelector('[data-action="submit"]');
  setLoading(submitBtn, true);

  try {
    const formData = new FormData();
    formData.append('order_id', `ord_${Date.now()}`);
    formData.append('amount', String(plan.price));
    formData.append('receipt', blob, 'receipt.jpg');

    const res = await upload(ENDPOINTS.PAYMENT_RECEIPT_UPLOAD.path, formData);

    setState({
      paymentState: 'WAITING_ADMIN_APPROVAL',
      paymentResult: {
        paymentId: res.payment_id,
        status: res.status,
        submittedAt: res.submitted_at,
        amount: plan.price
      }
    });

    navigate(SCREENS.PAYMENT_RESULT, { paymentId: res.payment_id });
  } catch (err) {
    console.error('[receipt] upload failed:', err);
    toast(err?.message || 'ارسال رسید ناموفق بود', { variant: 'error' });
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
