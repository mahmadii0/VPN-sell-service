import { back } from '../core/router.js';
import { useTemplate } from '../core/template.js';
import { iconNode } from '../components/icons.js';

const STEPS = [
  { title: 'انتخاب مدت اشتراک', text: 'در ابتدا مدت اشتراک (۱ ماهه یا ۲ ماهه) را انتخاب کنید.' },
  { title: 'انتخاب نوع اتصال', text: 'عادی یا تانل را انتخاب کنید. تانل پرسرعت‌تر و پایدارتر است.' },
  { title: 'انتخاب حجم', text: 'از بین پلن‌های موجود، حجم مناسب خود را انتخاب کنید.' },
  { title: 'بررسی سفارش', text: 'خلاصه سفارش را مطالعه و روش پرداخت را انتخاب کنید.' },
  { title: 'پرداخت', text: 'از کیف پول یا کارت به کارت پرداخت کنید.' },
  { title: 'دریافت کانفیگ', text: 'پس از تایید، از صفحه «اشتراک من» کانفیگ خود را دریافت کنید.' }
];

export function renderGuide() {
  const frag = useTemplate('tpl-guide');
  const root = frag.firstElementChild;

  fillStaticIcons(root);
  bindActions(root);
  renderSteps(root);

  return frag;
}

function fillStaticIcons(root) {
  const iconMap = { back: 'arrowRight' };
  root.querySelectorAll('[data-icon]').forEach((slot) => {
    const raw = slot.getAttribute('data-icon');
    if (!raw) return;
    const name = iconMap[raw] || raw;
    const svg = iconNode(name, { size: 20 });
    if (svg) slot.replaceWith(svg);
  });
}

function bindActions(root) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="back"]')) back();
  });
}

function renderSteps(root) {
  const slot = root.querySelector('[data-slot="steps"]');
  const frag = document.createDocumentFragment();

  STEPS.forEach((step, index) => {
    const tpl = useTemplate('tpl-guide-step');
    const node = tpl.firstElementChild;
    node.querySelector('[data-bind="num"]').textContent = String(index + 1);
    node.querySelector('[data-bind="title"]').textContent = step.title;
    node.querySelector('[data-bind="text"]').textContent = step.text;
    frag.appendChild(node);
  });

  slot.appendChild(frag);
}
