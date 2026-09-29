export function useTemplate(id) {
  const tpl = document.getElementById(id);
  if (!tpl) {
    console.error(`[template] Not found: ${id}`);
    return document.createDocumentFragment();
  }
  return tpl.content.cloneNode(true);
}

export function mountTemplate(host, id) {
  host.innerHTML = '';
  const frag = useTemplate(id);
  host.appendChild(frag);
  return host.firstElementChild;
}

export function setText(root, key, value) {
  const target = root.querySelector(`[data-bind="${key}"]`);
  if (target) target.textContent = value;
}

export function setHTML(root, key, value) {
  const target = root.querySelector(`[data-bind="${key}"]`);
  if (target) target.innerHTML = value;
}
