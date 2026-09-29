import { SUPPORT } from '../core/config.js';
import { back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { iconNode } from '../components/icons.js';
import { toast } from '../components/ui.js';
import { showAlert } from '../services/telegram.js';
import { copyToClipboard } from '../utils/dom.js';
import * as haptic from '../utils/haptic.js';

const FAQ = [
  { question: 'چطور اشتراک بخرم؟', answer: 'از صفحه اصلی روی «خرید اشتراک» بزنید و مراحل را دنبال کنید.' },
  { question: 'پرداخت کارت به کارت چقدر طول می‌کشد؟', answer: 'پس از ارسال رسید، تیم پشتیبانی معمولاً در چند دقیقه تا چند ساعت آن را تایید می‌کند.' },
  { question: 'کانفیگ را چطور دریافت کنم؟', answer: 'پس از تایید پرداخت، به صفحه «اشتراک من» بروید و لینک اشتراک خود را کپی کنید.' },
  { question: 'اگر رسید رد شد چه کنم؟', answer: 'با پشتیبانی در ارتباط باشید و رسید صحیح را مجدد ارسال کنید.' },
  { question: 'تفاوت عادی و تانل چیست؟', answer: 'تانل سرعت بالاتر و پایداری بیشتری نسبت به عادی دارد و برای مصرف سنگین و استریم مناسب است.' }
];

export function renderSupport() {
  const frag = useTemplate('tpl-support');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  fillSupportId(root);
  bindActions(root);
  renderFaq(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const isMenu = slot.classList.contains('pulse-menu-item__icon');
    const isSupport = slot.classList.contains('pulse-support-card__icon');
    const size = slot.closest('.pulse-icon-btn') || isMenu ? 20 : (isSupport ? 22 : 18);
    const svg = iconNode(name, { size });
    if (svg) slot.replaceWith(svg);
  });
}

function fillSupportId(root) {
  const el = root.querySelector('[data-bind="supportId"]');
  if (el) el.textContent = `@${SUPPORT.telegramId}`;
}

function bindActions(root) {
  root.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-action');

    if (action === 'back') back();
    else if (action === 'contact') contactSupport();
    else if (action === 'copy-support-id') await copySupportId();
    else if (action === 'payment-issue') contactSupport();
    else if (action === 'config-issue') contactSupport();
    else if (action === 'connection-issue') contactSupport();
  });
}

function contactSupport() {
  haptic.tap();
  openTelegramSupport();
}

function openTelegramSupport() {
  const url = SUPPORT.telegramUrl;
  const tg = window.Telegram?.WebApp;

  if (tg?.openTelegramLink) {
    try { tg.openTelegramLink(url); return; } catch { /* fall through */ }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copySupportId() {
  haptic.tap();
  const ok = await copyToClipboard(SUPPORT.telegramId);
  toast(ok ? 'آیدی پشتیبانی کپی شد' : 'کپی نشد', { variant: ok ? 'success' : 'error' });
}

function renderFaq(root) {
  const slot = root.querySelector('[data-slot="faq"]');
  const frag = document.createDocumentFragment();

  for (const item of FAQ) {
    const tpl = useTemplate('tpl-faq-item');
    const node = tpl.firstElementChild;

    node.querySelector('[data-bind="question"]').textContent = item.question;
    node.querySelector('[data-bind="answer"]').textContent = item.answer;

    const chev = node.querySelector('[data-icon="chevronDown"]');
    if (chev) {
      const svg = iconNode('chevronDown', { size: 18 });
      if (svg) chev.replaceWith(svg);
    }

    frag.appendChild(node);
  }

  slot.appendChild(frag);
}
