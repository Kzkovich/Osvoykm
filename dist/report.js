(() => {
  'use strict';

  const CATEGORIES = { fuel: 'Топливо', service: 'Сервис', wash: 'Мойка', other: 'Другое' };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const numberValue = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const formatMoney = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
  const parseDate = value => {
    const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
  };
  const dateLabel = value => {
    const date = parseDate(value);
    return date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Дата не указана';
  };
  const monthLabel = key => {
    const date = parseDate(`${key}-01`);
    return date ? date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : key;
  };

  function buildHtml(state = {}, options = {}) {
    const serviceOnly = options.serviceOnly === true;
    const source = Array.isArray(state.records) ? state.records : [];
    const records = source.filter(record => !serviceOnly || record.category === 'service').map(record => ({
      date: typeof record.date === 'string' ? record.date : '',
      parsedDate: parseDate(record.date),
      category: CATEGORIES[record.category] || 'Другое',
      title: String(record.title || CATEGORIES[record.category] || 'Событие'),
      amount: Math.max(0, numberValue(record.amount) ?? 0),
      odometer: numberValue(record.odometer)
    })).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.amount - a.amount);
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const dated = records.filter(record => record.parsedDate).sort((a, b) => a.date.localeCompare(b.date));
    const range = dated.length ? `${dateLabel(dated[0].date)} — ${dateLabel(dated.at(-1).date)}` : 'Нет дат в выбранных записях';
    const vehicle = [state.vehicle?.make, state.vehicle?.model, state.vehicle?.year].filter(Boolean).map(escapeHtml).join(' ');
    const months = new Map();
    for (const record of records) {
      if (!record.parsedDate) continue;
      const key = record.date.slice(0, 7);
      months.set(key, (months.get(key) || 0) + record.amount);
    }
    const timeline = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
    const peak = Math.max(1, ...timeline.map(([, amount]) => amount));
    const bars = timeline.length ? timeline.map(([key, amount]) => `<div class="bar-row"><span>${escapeHtml(monthLabel(key))}</span><span class="bar-track"><span class="bar" style="width:${Math.max(2, amount / peak * 100)}%"></span></span><strong>${formatMoney(amount)} ₽</strong></div>`).join('') : '<p class="quiet">Нет датированных записей для графика.</p>';
    const rows = records.length ? records.map(record => `<tr><td>${escapeHtml(dateLabel(record.date))}</td><td><span class="category">${escapeHtml(record.category)}</span></td><td>${escapeHtml(record.title)}</td><td class="numeric">${record.odometer !== null && record.odometer > 0 ? `${formatMoney(record.odometer)} км` : '—'}</td><td class="numeric">${formatMoney(record.amount)} ₽</td></tr>`).join('') : '<tr><td colspan="5" class="empty">В выбранном разделе пока нет записей.</td></tr>';
    const subset = serviceOnly ? 'Выбранный срез: только записи категории «Сервис».' : 'Выбранный срез: все записи журнала.';
    const demoNote = state.demo ? '<p class="caveat">В приложении отмечено, что эти записи демонстрационные.</p>' : '';

    return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Журнал автомобиля — отчёт</title><style>
:root{color-scheme:light;--ink:#202321;--muted:#687065;--line:#e5e8e0;--paper:#f6f7f2;--lime:#c7f36b;--green:#446b39}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{max-width:1040px;margin:auto;padding:36px 24px 64px}.masthead{border-bottom:2px solid var(--ink);padding-bottom:22px;margin-bottom:24px}.brand{display:inline-block;background:var(--lime);border-radius:9px;padding:4px 10px;font-weight:800;letter-spacing:-.04em}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:var(--muted);margin:16px 0 4px}h1{font-size:clamp(28px,5vw,42px);line-height:1.15;letter-spacing:-.04em;margin:0 0 6px}h2{font-size:20px;letter-spacing:-.02em;margin:0 0 14px}.subtitle,.quiet{color:var(--muted);margin:0}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}.metric{padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:12px}.metric span{display:block;color:var(--muted);font-size:13px}.metric strong{font-size:20px}.panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;margin:16px 0}.bar-row{display:grid;grid-template-columns:minmax(110px,180px) minmax(70px,1fr) minmax(84px,130px);gap:12px;align-items:center;margin:10px 0;font-size:14px}.bar-track{height:10px;border-radius:99px;background:#eef1e9;overflow:hidden}.bar{display:block;height:100%;border-radius:99px;background:#91b84d}.bar-row strong{text-align:right;white-space:nowrap}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:640px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}td{font-size:14px}.numeric{text-align:right;white-space:nowrap}.category{display:inline-block;background:#f0f3e9;border-radius:99px;padding:3px 9px;font-size:12px}.empty{text-align:center;color:var(--muted);padding:26px}.notice{border-left:4px solid #91b84d;background:#f0f3e9;padding:14px 16px;border-radius:5px;font-size:14px}.caveat{color:var(--muted);font-size:13px;margin:12px 0 0}.foot{font-size:12px;color:var(--muted);margin-top:18px}.print{position:fixed;right:22px;bottom:22px;border:0;border-radius:99px;background:var(--ink);color:white;padding:13px 18px;font:600 14px inherit;cursor:pointer}@media(max-width:600px){.page{padding:22px 14px 36px}.summary{grid-template-columns:1fr}.metric{padding:12px 15px}.panel{padding:15px}.bar-row{grid-template-columns:minmax(90px,125px) minmax(35px,1fr) minmax(68px,90px);gap:8px;font-size:12px}.bar-row strong{font-size:12px}.print{right:14px;bottom:14px}}@media print{body{background:white}.page{max-width:none;padding:0}.panel,.metric{break-inside:avoid;border-color:#bbb}.print{display:none}.notice{background:#f6f6f6}}
</style></head><body><main class="page"><header class="masthead"><span class="brand">борт</span><p class="eyebrow">Отчёт по журналу автомобиля</p><h1>Записи и расходы</h1>${vehicle ? `<p class="subtitle">${vehicle}</p>` : ''}</header><div class="notice">История по записям владельца; полнота и выполнение работ не подтверждены.</div>${demoNote}<p class="subtitle" style="margin-top:12px">${escapeHtml(subset)} Период: ${escapeHtml(range)}. Всего записей: ${records.length}.</p><section class="summary"><div class="metric"><span>Сумма выбранных записей</span><strong>${formatMoney(total)} ₽</strong></div><div class="metric"><span>Записей в отчёте</span><strong>${records.length}</strong></div><div class="metric"><span>Период по указанным датам</span><strong style="font-size:15px">${escapeHtml(range)}</strong></div></section><section class="panel"><h2>Расходы по месяцам</h2>${bars}</section><section class="panel"><h2>История событий</h2><div class="table-wrap"><table><thead><tr><th>Дата</th><th>Категория</th><th>Событие</th><th class="numeric">Пробег</th><th class="numeric">Сумма</th></tr></thead><tbody>${rows}</tbody></table></div></section><footer class="foot">Отчёт создан из локального журнала автомобиля. Суммы рассчитаны только по выбранным и сохранённым записям. Передавайте файл по своему усмотрению.</footer></main><button class="print" type="button" onclick="window.print()">Печать / PDF</button></body></html>`;
  }

  function download(state, options = {}) {
    const html = buildHtml(state, options);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = options.serviceOnly ? 'bort-service-history.html' : 'bort-history-report.html';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const api = { buildHtml, download };
  if (typeof window !== 'undefined') window.BortReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
