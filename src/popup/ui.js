import { tryGetDetails } from "./messaging.js";
import { isAllowedUrl } from "../shared/allowed-patterns.js";

// DOM refs (looked up when functions are called)
function statusBox() { return document.getElementById('status'); }
function detailsBox() { return document.getElementById('details'); }

function copyToClipboard(text, labelEl) {
  navigator.clipboard.writeText(text).then(() => {
    const existing = labelEl.querySelector('.feedback');
    if (existing) existing.remove();
    const feedback = document.createElement('span');
    feedback.className = 'feedback';
    feedback.textContent = 'Copied!';
    labelEl.appendChild(feedback);
    setTimeout(() => feedback.remove(), 2000);
  });
}

function getHighResImageUrl(src) {
  return src.replace(/\._[^.]+(?=\.)/, '');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (!isNaN(date)) {
    if (/^\d{4}$/.test(dateStr.trim())) return `01/01/${dateStr.trim()}`;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  return dateStr;
}

function downloadImage(url, bookId) {
  const highResUrl = url.replace(/\._[^.]+(?=\.)/, '');
  fetch(highResUrl)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const safeId = String(bookId || '').replace(/[^a-z0-9]/gi, '');
      a.download = `${safeId}_cover.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(err => console.error('Image download failed:', err));
}

function renderRow(container, key, value) {
  const div = document.createElement('div');
  div.className = 'row';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = (key === 'title') ? 'Title:' : `${key}:`;

  div.appendChild(label);
  div.appendChild(document.createTextNode(' '));

  if (Array.isArray(value)) {
    if (key === 'Contributors' && value.length && typeof value[0] === 'object' && Array.isArray(value[0].roles)) {
      value.forEach((contributor, idx) => {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'value contributor-name';
        nameSpan.textContent = contributor.name;
        nameSpan.title = 'Click to copy name';
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => copyToClipboard(contributor.name, div));
        div.appendChild(nameSpan);

        div.appendChild(document.createTextNode(' ('));

        contributor.roles.forEach((role, roleIdx) => {
          const roleSpan = document.createElement('span');
          roleSpan.className = 'value contributor-role';
          roleSpan.textContent = role;
          roleSpan.title = 'Click to copy role';
          roleSpan.style.cursor = 'pointer';
          roleSpan.addEventListener('click', () => copyToClipboard(role, div));
          div.appendChild(roleSpan);
          if (roleIdx !== contributor.roles.length - 1) div.appendChild(document.createTextNode(', '));
        });

        div.appendChild(document.createTextNode(')'));
        if (idx !== value.length - 1) div.appendChild(document.createTextNode(', '));
      });
    } else {
      value.forEach(item => {
        const itemSpan = document.createElement('span');
        itemSpan.className = 'value';
        itemSpan.textContent = item;
        itemSpan.title = 'Click to copy';
        itemSpan.style.cursor = 'pointer';
        if (key === 'Listening Length') {
          const numberMatch = item.match(/\d+/);
          const numberOnly = numberMatch ? numberMatch[0] : item;
          itemSpan.addEventListener('click', () => copyToClipboard(numberOnly, div));
        } else {
          itemSpan.addEventListener('click', () => copyToClipboard(item, div));
        }
        div.appendChild(itemSpan);
        if (item !== value[value.length - 1]) {
          if (key === 'Author' || key === 'Narrator') div.appendChild(document.createTextNode(', '));
          else div.appendChild(document.createTextNode(' '));
        }
      });
    }
  } else {
    const val = document.createElement('span');
    val.className = 'value';
    val.textContent = value;
    val.title = 'Click to copy';
    if (key === 'Description') val.classList.add('description');
    val.addEventListener('click', () => copyToClipboard(value, div));
    div.appendChild(val);
  }

  container.appendChild(div);
}

export function renderDetails(details) {
  console.log('[Extension] Rendering details:', details);
  const container = detailsBox();
  if (!container) return;
  container.innerHTML = ""; // safety clear 

  if (details.img) {
    const sideBySideWrapper = document.createElement('div');
    sideBySideWrapper.style.display = 'flex';
    sideBySideWrapper.style.alignItems = 'flex-start';
    sideBySideWrapper.style.gap = '1rem';

    const img = document.createElement('img');
    img.src = getHighResImageUrl(details.img);
    img.alt = 'Cover Image';
    img.title = 'Click to download';
    img.style.maxWidth = '100px';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      const fallbackId =
        details['ISBN-13'] ||
        details['ISBN-10'] ||
        details['ASIN'] ||
        details['Source ID'] ||
        details['Title'] ||
        Date.now();
      downloadImage(details.img, fallbackId);
    });

    const imgWrapper = document.createElement('div');
    imgWrapper.style.display = 'flex';
    imgWrapper.style.flexDirection = 'column';
    imgWrapper.style.alignItems = 'center';
    imgWrapper.style.position = 'relative';
    imgWrapper.style.maxWidth = '100px';

    imgWrapper.appendChild(img);

    if (details.imgScore && typeof details.imgScore === 'number') {
      const label = document.createElement('span');
      label.className = 'img-score-label';
      label.textContent = details.imgScore.toLocaleString();

      if (details.imgScore < 33000) {
        label.style.background = '#c0392b';
        label.title = 'Low resolution (ex: 133 x 200)';
        label.textContent = 'Poor';
      } else if (details.imgScore < 100000) {
        label.style.background = '#f39c12';
        label.title = 'Medium resolution (ex: 200 x 300)';
        label.textContent = 'Medium';
      } else {
        label.style.background = '#27ae60';
        label.title = 'High resolution (ex: 300 x 450)';
        label.textContent = 'High';
      }

      imgWrapper.appendChild(label);
    }

    sideBySideWrapper.appendChild(imgWrapper);

    const textWrapper = document.createElement('div');
    textWrapper.style.flex = '1';

    if (details.Title) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'row';

      const titleLabel = document.createElement('span');
      titleLabel.className = 'label';
      titleLabel.textContent = 'Title:';

      const titleVal = document.createElement('span');
      titleVal.className = 'value title';
      titleVal.textContent = details.Title;
      titleVal.title = 'Click to copy';
      titleVal.style.cursor = 'pointer';
      titleVal.addEventListener('click', () => copyToClipboard(details.Title, titleDiv));

      titleDiv.appendChild(document.createTextNode(' '));
      titleDiv.appendChild(titleVal);
      textWrapper.appendChild(titleDiv);
    }

    if (details.Description) {
      const descDiv = document.createElement('div');
      descDiv.className = 'row';

      const descLabel = document.createElement('span');
      descLabel.className = 'label';
      descLabel.textContent = 'Description:';

      const descVal = document.createElement('span');
      descVal.className = 'value description';
      descVal.textContent = details.Description;
      descVal.title = 'Click to copy';
      descVal.style.cursor = 'pointer';
      descVal.addEventListener('click', () => copyToClipboard(details.Description, descDiv));

      descDiv.appendChild(document.createTextNode(' '));
      descDiv.appendChild(descVal);
      textWrapper.appendChild(descDiv);
    }

    sideBySideWrapper.appendChild(textWrapper);
    container.appendChild(sideBySideWrapper);
  }

  if (details.Series || details['Series Place']) {
    const metaTop = document.createElement('div');
    metaTop.style.margin = '8px 0 0 0';
    if (details.Series) renderRow(metaTop, 'Series', details.Series);
    if (details['Series Place']) renderRow(metaTop, 'Series Place', details['Series Place']);
    container.appendChild(metaTop);
  }

  if (details["Publication date"]) {
    details["Publication date"] = formatDate(details["Publication date"]);
  }

  const hr = document.createElement('hr');
  container.appendChild(hr);

  const orderedKeys = [
    'ISBN-13','ISBN-10','ASIN','Source ID','Contributors','Publisher',
    'Reading Format','Edition Format','Listening Length','Pages',
    'Publication date','Language'
  ];

  const rendered = new Set(['Series', 'Series Place']);
  orderedKeys.forEach(key => {
    if (key in details) {
      renderRow(container, key, details[key]);
      rendered.add(key);
    }
  });

  const filteredKeys = ['img','imgScore','Title','Description'];
  Object.entries(details).forEach(([key, value]) => {
    if (filteredKeys.includes(key) || rendered.has(key)) return;
    renderRow(container, key, value);
  });
}

export function showStatus(message) {
  const statusEl = statusBox();
  const detailsEl = detailsBox();
  if (!statusEl || !detailsEl) return;
  statusEl.style.display = 'block';
  statusEl.innerHTML = message;
  detailsEl.style.display = 'none';
}

export function showDetails() {
  const statusEl = statusBox();
  const detailsEl = detailsBox();
  if (!statusEl || !detailsEl) return;
  statusEl.style.display = 'none';
  detailsEl.style.display = 'block';
}

// DEBUG: Sidebar logger: mirrors console.* into a sidebar status area
export function initSidebarLogger() {
  let host = document.getElementById('sidebar-status');
  if (!host) {
    host = document.createElement('div');
    host.id = 'sidebar-status';
    host.style.cssText = 'font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:8px 12px; margin-bottom: 2rem; max-height:160px; overflow:auto;';
    const container = detailsBox() || document.body;
    container.parentNode.insertBefore(host, container);
  }

  const append = (level, parts) => {
    const line = document.createElement('div');
    line.style.margin = '2px 0';
    if (level === 'warn') line.style.color = '#9a6b00';
    if (level === 'error') line.style.color = '#b00020';
    if (level === 'debug') line.style.opacity = '0.8';
    const ts = new Date().toLocaleTimeString();
    const text = parts.map(p => { try { return typeof p === 'string' ? p : JSON.stringify(p); } catch { return String(p); } }).join(' ');
    line.textContent = `[${ts}] ${level.toUpperCase()}: ${text}`;
    host.appendChild(line);
    host.scrollTop = host.scrollHeight;
  };

  ['log','warn','error','debug'].forEach(fn => {
    const original = console[fn].bind(console);
    console[fn] = (...args) => { append(fn, args); original(...args); };
  });

  console.debug('Sidebar logger initialized');
}

export function addRefreshButton(onClick) {
  const container = document.getElementById('content') || document.body;

  if (document.getElementById('refresh-button')) return;

  const btn = document.createElement('button');
  btn.id = 'refresh-button';
  btn.textContent = 'Refresh details from current tab';

  btn.addEventListener('click', () => {
		if (btn.disabled) return; // bail if not allowed
		showStatus("Refreshing...");
		tryGetDetails()
			.then(details => {
				showDetails();
				renderDetails(details);
			})
			.catch(err => showStatus(err));
	});


  container.prepend(btn);
}

export function updateRefreshButtonForUrl(url) {
  const btn = document.getElementById('refresh-button');
  if (!btn) return;
  const allowed = isAllowedUrl(url);
  btn.disabled = !allowed;
  btn.style.opacity = allowed ? '' : '0.5';
  btn.style.cursor = allowed ? 'pointer' : 'not-allowed';
	btn.style.backgroundColor = allowed ? '#E6B313' : '#384151';
	btn.textContent = allowed ? 'Refresh details from current tab' : 'This page is not supported';
}


export function checkActiveTabAndUpdateButton() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    updateRefreshButtonForUrl(tab?.url || "");
  });
}