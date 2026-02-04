function getLang() {
    return localStorage.getItem('lang') || 'en';
}

function fmtNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(decimals);
}

function setStatus(el, text) {
    if (!el) return;
    el.textContent = text;
}

function initMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('primaryNav');
    if (!toggle || !nav) return;

    const setExpanded = (expanded) => {
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    setExpanded(false);

    toggle.addEventListener('click', () => {
        nav.classList.toggle('active');
        setExpanded(nav.classList.contains('active'));
    });

    // Close menu when a nav link is clicked (mobile UX).
    nav.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target.closest('a')) {
            nav.classList.remove('active');
            setExpanded(false);
        }
    });
}

function initPositionSizeTool() {
    const form = document.getElementById('positionSizeForm');
    const result = document.getElementById('psResult');
    const resetBtn = document.getElementById('psResetBtn');
    if (!form || !result) return;

    const balance = document.getElementById('psBalance');
    const risk = document.getElementById('psRisk');
    const stopPips = document.getElementById('psStopPips');
    const pipValue = document.getElementById('psPipValue');

    const reset = () => {
        if (balance) balance.value = '1000';
        if (risk) risk.value = '1';
        if (stopPips) stopPips.value = '30';
        if (pipValue) pipValue.value = '10';
        setStatus(result, '');
    };

    resetBtn?.addEventListener('click', reset);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const bal = Number(balance?.value);
        const r = Number(risk?.value);
        const sl = Number(stopPips?.value);
        const pv = Number(pipValue?.value);

        if (!Number.isFinite(bal) || !Number.isFinite(r) || !Number.isFinite(sl) || !Number.isFinite(pv)) {
            setStatus(result, getLang() === 'es' ? 'Completa todos los campos.' : 'Please fill in all fields.');
            return;
        }
        if (bal <= 0 || r <= 0 || sl <= 0 || pv <= 0) {
            setStatus(result, getLang() === 'es' ? 'Usa valores mayores que 0.' : 'Use values greater than 0.');
            return;
        }

        const riskAmount = bal * (r / 100);
        const lots = riskAmount / (sl * pv);

        const msgEn = `Risk: $${fmtNumber(riskAmount, 2)} • Position size: ${fmtNumber(lots, 2)} lots`;
        const msgEs = `Riesgo: $${fmtNumber(riskAmount, 2)} • Tamaño: ${fmtNumber(lots, 2)} lotes`;
        setStatus(result, getLang() === 'es' ? msgEs : msgEn);
    });
}

function initPipValueTool() {
    const form = document.getElementById('pipValueForm');
    const result = document.getElementById('pvResult');
    const resetBtn = document.getElementById('pvResetBtn');
    if (!form || !result) return;

    const pair = document.getElementById('pvPair');
    const lots = document.getElementById('pvLots');
    const price = document.getElementById('pvPrice');

    const reset = () => {
        if (pair) pair.value = 'EURUSD';
        if (lots) lots.value = '1';
        if (price) price.value = '150';
        setStatus(result, '');
    };

    resetBtn?.addEventListener('click', reset);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const p = (pair?.value || '').toUpperCase();
        const l = Number(lots?.value);
        const pr = Number(price?.value);

        if (!p || !Number.isFinite(l) || l <= 0) {
            setStatus(result, getLang() === 'es' ? 'Completa los campos.' : 'Please fill in the fields.');
            return;
        }

        let pipValuePerLotUSD;

        if (p === 'EURUSD' || p === 'GBPUSD' || p === 'AUDUSD') {
            // Approx for USD-quote pairs: 1 pip (0.0001) for 1 standard lot ~ $10.
            pipValuePerLotUSD = 10;
        } else if (p === 'USDJPY') {
            if (!Number.isFinite(pr) || pr <= 0) {
                setStatus(result, getLang() === 'es' ? 'Ingresa un precio válido para USD/JPY.' : 'Enter a valid price for USD/JPY.');
                return;
            }
            // 1 pip = 0.01 JPY. For 100,000 units: 100,000 * 0.01 = 1,000 JPY. Convert to USD by dividing by USDJPY price.
            pipValuePerLotUSD = 1000 / pr;
        } else {
            setStatus(result, getLang() === 'es' ? 'Par no soportado.' : 'Pair not supported.');
            return;
        }

        const pipValueUSD = pipValuePerLotUSD * l;
        const msgEn = `Pip value: ~$${fmtNumber(pipValueUSD, 2)} per pip (${p}, ${fmtNumber(l, 2)} lots)`;
        const msgEs = `Valor del pip: ~$${fmtNumber(pipValueUSD, 2)} por pip (${p}, ${fmtNumber(l, 2)} lotes)`;
        setStatus(result, getLang() === 'es' ? msgEs : msgEn);
    });
}

function initConverterTool() {
    const form = document.getElementById('converterForm');
    const result = document.getElementById('ccResult');
    const resetBtn = document.getElementById('ccResetBtn');
    if (!form || !result) return;

    const amount = document.getElementById('ccAmount');
    const rate = document.getElementById('ccRate');

    const reset = () => {
        if (amount) amount.value = '100';
        if (rate) rate.value = '1.08';
        setStatus(result, '');
    };

    resetBtn?.addEventListener('click', reset);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const a = Number(amount?.value);
        const r = Number(rate?.value);

        if (!Number.isFinite(a) || !Number.isFinite(r) || a < 0 || r <= 0) {
            setStatus(result, getLang() === 'es' ? 'Ingresa monto y tasa válidos.' : 'Enter a valid amount and rate.');
            return;
        }

        const converted = a * r;
        const msgEn = `Converted: ${fmtNumber(converted, 2)}`;
        const msgEs = `Convertido: ${fmtNumber(converted, 2)}`;
        setStatus(result, getLang() === 'es' ? msgEs : msgEn);
    });
}

function formatReviewCount(count) {
    const n = Number.isFinite(count) ? count : 0;
    if (getLang() === 'es') {
        return `(${n} ${n === 1 ? 'reseña' : 'reseñas'})`;
    }
    return `(${n} ${n === 1 ? 'review' : 'reviews'})`;
}

function initReviewCounts() {
    const reviewsSection = document.getElementById('reviews');
    if (!reviewsSection) return;

    const update = () => {
        reviewsSection.querySelectorAll('.review-block').forEach((block) => {
            const items = block.querySelectorAll('.review-item');
            const countEl = block.querySelector('.review-count');
            if (!countEl) return;
            const n = items.length;
            const en = `(${n} ${n === 1 ? 'review' : 'reviews'})`;
            const es = `(${n} ${n === 1 ? 'reseña' : 'reseñas'})`;
            countEl.setAttribute('data-en', en);
            countEl.setAttribute('data-es', es);
            countEl.textContent = getLang() === 'es' ? es : en;
        });
    };

    update();

    // Update when language changes (toggle changes localStorage + button text).
    const langToggle = document.getElementById('langToggle');
    langToggle?.addEventListener('click', () => setTimeout(update, 0));
}

function normalizeList(text) {
    return String(text || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parseFirstNumber(value) {
    const match = String(value || '').match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
}

function parseUsdAmount(value) {
    // Accept "$200", "200", "From 0.0 pips" (ignored by callers), etc.
    return parseFirstNumber(value);
}

function readBrokersFromTable() {
    const rows = Array.from(document.querySelectorAll('#brokers table tbody tr'));
    if (!rows.length) return [];

    return rows.map((row) => {
        const nameEl = row.querySelector('.broker-name');
        const regEl = row.querySelector('.broker-reg');
        const ratingEl = row.querySelector('.rating');
        const actionLink = row.querySelector('a.btn-link[href*="brokers/"]');

        const name = (nameEl?.textContent || '').trim();
        const regulationText = (regEl?.textContent || '').trim();
        const rating = Number(ratingEl?.textContent);

        const cells = Array.from(row.querySelectorAll('td'));
        const minDepositText = (cells[2]?.textContent || '').trim();
        const spreadsText = (cells[3]?.textContent || '').trim();
        const platformsText = (cells[4]?.textContent || '').trim();

        const href = actionLink?.getAttribute('href') || '';
        const idFromHref = href.match(/brokers\/([^/]+)\.html/i)?.[1];
        const id = idFromHref || slugify(name);

        return {
            id,
            name,
            rating: Number.isFinite(rating) ? rating : null,
            minDepositText,
            minDeposit: parseUsdAmount(minDepositText),
            spreadsText,
            spreads: parseFirstNumber(spreadsText),
            platforms: normalizeList(platformsText),
            regulation: normalizeList(regulationText),
            reviewHref: href || null
        };
    }).filter((b) => b.id && b.name);
}

function applyLanguageToSubtree(container, lang) {
    if (!container) return;
    const safeLang = lang === 'es' ? 'es' : 'en';
    container.querySelectorAll('[data-en]').forEach((element) => {
        const text = element.getAttribute(`data-${safeLang}`);
        if (text) element.textContent = text;
    });
}

function initComparisonTool() {
    const root = document.getElementById('comparisonTool');
    if (!root) return;

    const searchInput = document.getElementById('compareSearch');
    const platformSelect = document.getElementById('comparePlatform');
    const regulationSelect = document.getElementById('compareRegulation');
    const picklist = document.getElementById('comparePicklist');
    const status = document.getElementById('compareStatus');
    const tableWrap = document.getElementById('compareTableWrap');
    const clearBtn = document.getElementById('compareClearBtn');
    const langToggle = document.getElementById('langToggle');

    if (!picklist || !status || !tableWrap) return;

    const brokers = readBrokersFromTable();
    const brokerById = new Map(brokers.map((b) => [b.id, b]));
    const MAX_SELECTED = 3;
    const STORAGE_KEY = 'compareSelection.site2';

    const getSelected = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((id) => typeof id === 'string' && brokerById.has(id)).slice(0, MAX_SELECTED);
        } catch {
            return [];
        }
    };

    const setSelected = (ids) => {
        const unique = [];
        for (const id of ids) {
            if (!brokerById.has(id)) continue;
            if (unique.includes(id)) continue;
            unique.push(id);
            if (unique.length >= MAX_SELECTED) break;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
        selectedIds = unique;
        syncSelectionUI();
        render();
    };

    let selectedIds = getSelected();

    const allPlatforms = Array.from(
        new Set(brokers.flatMap((b) => b.platforms))
    ).sort((a, b) => a.localeCompare(b));

    const allRegulators = Array.from(
        new Set(brokers.flatMap((b) => b.regulation))
    ).sort((a, b) => a.localeCompare(b));

    const addOptions = (select, values) => {
        if (!select) return;
        values.forEach((val) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
    };

    addOptions(platformSelect, allPlatforms);
    addOptions(regulationSelect, allRegulators);

    const selectionSet = () => new Set(selectedIds);

    const matchesFilter = (broker) => {
        const q = (searchInput?.value || '').trim().toLowerCase();
        const platform = (platformSelect?.value || '').trim();
        const regulator = (regulationSelect?.value || '').trim();

        if (platform && !broker.platforms.includes(platform)) return false;
        if (regulator && !broker.regulation.includes(regulator)) return false;

        if (!q) return true;
        const hay = [
            broker.name,
            broker.platforms.join(' '),
            broker.regulation.join(' ')
        ].join(' ').toLowerCase();
        return hay.includes(q);
    };

    const renderPicklist = () => {
        const selected = selectionSet();
        picklist.innerHTML = '';

        const filtered = brokers.filter(matchesFilter);
        filtered.forEach((b) => {
            const label = document.createElement('label');
            label.className = 'pick-item';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'pick-checkbox';
            input.dataset.brokerId = b.id;
            input.checked = selected.has(b.id);

            const main = document.createElement('div');
            main.className = 'pick-main';
            main.textContent = b.name;

            const meta = document.createElement('div');
            meta.className = 'pick-meta muted small';
            const parts = [];
            if (Number.isFinite(b.rating)) parts.push(`${b.rating.toFixed(1)}★`);
            if (b.platforms.length) parts.push(b.platforms.join(', '));
            meta.textContent = parts.join(' • ');

            label.appendChild(input);
            label.appendChild(main);
            label.appendChild(meta);
            picklist.appendChild(label);
        });

        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'muted';
            empty.textContent = getLang() === 'es' ? 'Sin resultados.' : 'No matches.';
            picklist.appendChild(empty);
        }
    };

    const syncSelectionUI = () => {
        const selected = selectionSet();

        // Sync checkboxes in the broker table.
        document.querySelectorAll('.compare-checkbox[data-broker-id]').forEach((el) => {
            if (!(el instanceof HTMLInputElement)) return;
            const id = el.dataset.brokerId;
            if (!id) return;
            el.checked = selected.has(id);
        });

        // Sync picklist checkboxes (if already rendered).
        picklist.querySelectorAll('input.pick-checkbox[data-broker-id]').forEach((el) => {
            if (!(el instanceof HTMLInputElement)) return;
            const id = el.dataset.brokerId;
            if (!id) return;
            el.checked = selected.has(id);
        });
    };

    const setStatusText = (textEn, textEs) => {
        if (getLang() === 'es') {
            status.textContent = textEs;
        } else {
            status.textContent = textEn;
        }
    };

    const computeBestClasses = (selectedBrokers) => {
        const best = {
            rating: null,
            minDeposit: null,
            spreads: null
        };

        const ratings = selectedBrokers.filter((b) => Number.isFinite(b.rating));
        if (ratings.length) {
            best.rating = Math.max(...ratings.map((b) => b.rating));
        }

        const deposits = selectedBrokers.filter((b) => Number.isFinite(b.minDeposit));
        if (deposits.length) {
            best.minDeposit = Math.min(...deposits.map((b) => b.minDeposit));
        }

        const spreads = selectedBrokers.filter((b) => Number.isFinite(b.spreads));
        if (spreads.length) {
            best.spreads = Math.min(...spreads.map((b) => b.spreads));
        }

        return best;
    };

    const renderTable = () => {
        const selectedBrokers = selectedIds.map((id) => brokerById.get(id)).filter(Boolean);

        if (selectedBrokers.length < 2) {
            tableWrap.hidden = true;
            tableWrap.innerHTML = '';
            return;
        }

        const best = computeBestClasses(selectedBrokers);

        const labelCell = (en, es, fallbackText) => {
            return `<span data-en="${en}" data-es="${es}">${fallbackText || en}</span>`;
        };

        const headerCells = selectedBrokers.map((b) => {
            const remove = `<button type="button" class="btn-link compare-remove" data-broker-id="${b.id}" data-en="Remove" data-es="Quitar">Remove</button>`;
            return `<th><div class="compare-colhead"><span>${b.name}</span>${remove}</div></th>`;
        }).join('');

        const valueTd = (key, broker) => {
            let text = '—';
            let extraClass = '';

            if (key === 'rating') {
                if (Number.isFinite(broker.rating)) {
                    text = broker.rating.toFixed(1);
                    if (best.rating !== null && broker.rating === best.rating) extraClass = ' is-best';
                }
            } else if (key === 'minDeposit') {
                text = broker.minDepositText || '—';
                if (best.minDeposit !== null && Number.isFinite(broker.minDeposit) && broker.minDeposit === best.minDeposit) {
                    extraClass = ' is-best';
                }
            } else if (key === 'spreads') {
                text = broker.spreadsText || '—';
                if (best.spreads !== null && Number.isFinite(broker.spreads) && broker.spreads === best.spreads) {
                    extraClass = ' is-best';
                }
            } else if (key === 'platforms') {
                text = broker.platforms.length ? broker.platforms.join(', ') : '—';
            } else if (key === 'regulation') {
                text = broker.regulation.length ? broker.regulation.join(', ') : '—';
            }

            return `<td class="${extraClass.trim()}">${text}</td>`;
        };

        const reviewTd = (broker) => {
            if (!broker.reviewHref) return '<td>—</td>';
            const label = labelCell('Read review', 'Leer reseña', 'Read review');
            return `<td><a class="btn-link" href="${broker.reviewHref}">${label}</a></td>`;
        };

        const rows = [
            { key: 'rating', en: 'Rating', es: 'Calificación', fallback: 'Rating' },
            { key: 'minDeposit', en: 'Min deposit', es: 'Depósito mín.', fallback: 'Min deposit' },
            { key: 'spreads', en: 'Spreads', es: 'Spreads', fallback: 'Spreads' },
            { key: 'platforms', en: 'Platforms', es: 'Plataformas', fallback: 'Platforms' },
            { key: 'regulation', en: 'Regulation', es: 'Regulación', fallback: 'Regulation' }
        ];

        const bodyRows = rows.map((r) => {
            const label = labelCell(r.en, r.es, r.fallback);
            const cells = selectedBrokers.map((b) => valueTd(r.key, b)).join('');
            return `<tr><td>${label}</td>${cells}</tr>`;
        }).join('');

        const reviewRow = `<tr><td>${labelCell('Review', 'Reseña', 'Review')}</td>${selectedBrokers.map(reviewTd).join('')}</tr>`;

        tableWrap.innerHTML = `
            <table class="compare-table">
                <thead>
                    <tr>
                        <th>${labelCell('Broker', 'Broker', 'Broker')}</th>
                        ${headerCells}
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows}
                    ${reviewRow}
                </tbody>
            </table>
        `;
        applyLanguageToSubtree(tableWrap, getLang());
        tableWrap.hidden = false;
    };

    const render = () => {
        renderPicklist();
        syncSelectionUI();

        if (selectedIds.length < 2) {
            setStatusText(
                selectedIds.length === 1 ? 'Select 1 more broker to compare.' : 'Select at least 2 brokers to compare.',
                selectedIds.length === 1 ? 'Selecciona 1 broker más para comparar.' : 'Selecciona al menos 2 brokers para comparar.'
            );
        } else {
            setStatusText(
                `Comparing ${selectedIds.length} brokers.`,
                `Comparando ${selectedIds.length} brokers.`
            );
        }

        renderTable();
    };

    const tryToggle = (id, checked) => {
        if (!brokerById.has(id)) return;
        const selected = selectionSet();

        if (checked) {
            if (selected.size >= MAX_SELECTED && !selected.has(id)) {
                setStatusText(
                    `You can compare up to ${MAX_SELECTED} brokers.`,
                    `Puedes comparar hasta ${MAX_SELECTED} brokers.`
                );
                syncSelectionUI();
                return;
            }
            setSelected([...selectedIds, id]);
        } else {
            setSelected(selectedIds.filter((x) => x !== id));
        }
    };

    // Picklist interactions (event delegation).
    picklist.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.classList.contains('pick-checkbox')) return;
        const id = target.dataset.brokerId;
        if (!id) return;
        tryToggle(id, target.checked);
    });

    // Table checkbox interactions.
    document.querySelectorAll('.compare-checkbox[data-broker-id]').forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        el.addEventListener('change', () => {
            const id = el.dataset.brokerId;
            if (!id) return;
            tryToggle(id, el.checked);
        });
    });

    // Remove buttons in the comparison table.
    tableWrap.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest('button.compare-remove');
        if (!btn) return;
        const id = btn.getAttribute('data-broker-id');
        if (!id) return;
        setSelected(selectedIds.filter((x) => x !== id));
    });

    clearBtn?.addEventListener('click', () => setSelected([]));
    searchInput?.addEventListener('input', render);
    platformSelect?.addEventListener('change', render);
    regulationSelect?.addEventListener('change', render);
    langToggle?.addEventListener('click', () => setTimeout(render, 0));

    // Initial render.
    render();
}

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initPositionSizeTool();
    initPipValueTool();
    initConverterTool();
    initComparisonTool();
    initReviewCounts();
});

