window.addEventListener('cloud-ready', () => {
'use strict';

// ========================================
// DEFAULT MENU
// ========================================

const DEFAULT_MENU = [
    ['Biscoff Matcha Latte', 'matcha', 145, 165],
    ['Mango Matcha Latte', 'matcha', 150, 170],
    ['Matcha Ichigo', 'matcha', 150, 170],
    ['Coconut Matcha', 'matcha', 145, 165],
    ['Vanilla Matcha Latte', 'matcha', 140, 160],
    ['Lavender Matcha', 'matcha', 150, 170],
    ['Dirty Matcha Latte', 'matcha', 155, 175],
    ['Mango Breeze Coffee', 'coffee', 135, 155],
    ['Signature Iced Latte', 'coffee', 130, 150],
    ['Iced Cafe Latte', 'coffee', 120, 140],
    ['Hot Cafe Latte', 'coffee', 115, 135]
].map(([name, category, small, big], i) => ({
    id: i + 1,
    name,
    category,
    small,
    big,
    image: `assets/images/drink-${i + 1}.webp`
}));

// ========================================
// DEFAULT ADD-ONS
// ========================================

const DEFAULT_ADDONS = [
    {
        id: 'pearls',
        name: 'Pearls',
        price: 15
    },
    {
        id: 'cream',
        name: 'Cream cheese',
        price: 20
    },
    {
        id: 'matcha',
        name: 'Extra matcha',
        price: 25
    },
    {
        id: 'espresso',
        name: 'Extra espresso',
        price: 20
    }
];

// ========================================
// LOCAL STORAGE
// ========================================

const KEY = 'love_matchaa_order_desk_v3';

function read() {
    try {
        const data = JSON.parse(localStorage.getItem(KEY));

        if (
            data &&
            Array.isArray(data.menu) &&
            Array.isArray(data.orders) &&
            Array.isArray(data.addons)
        ) {
            return data;
        }
    } catch {}

    return {
        menu: structuredClone(DEFAULT_MENU),
        addons: structuredClone(DEFAULT_ADDONS),
        orders: []
    };
}

// ========================================
// GLOBAL VARIABLES
// ========================================

let db = read();
let cart = [];
let category = 'all';
let orderType = 'Dine in';
let current = null;
let chosenSize = 'Small';
let chosenQty = 1;
let voidId = null;

// ========================================
// HELPER FUNCTIONS
// ========================================

const $ = id => document.getElementById(id);

const peso = n =>
    '₱' + Number(n || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

function persist() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
        return true;
    } catch (e) {
        alert(
            'Could not save. Browser storage may be full or disabled.'
        );
        return false;
    }
}

function esc(v) {
    return String(v ?? '').replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c])
    );
}

function toast(s) {
    $('toast').textContent = s;
    $('toast').style.display = 'block';

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        $('toast').style.display = 'none';
    }, 2500);
}

// ========================================
// CLOCK AND DATE
// ========================================

function clock() {
    const d = new Date();

    $('clock').textContent = d.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    $('today').textContent = d.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

clock();
setInterval(clock, 1000);

// ========================================
// PAGE NAVIGATION
// ========================================

function navigate(page) {
    document.querySelectorAll('[data-page]').forEach(b => {
        b.classList.toggle(
            'active',
            b.dataset.page === page
        );
    });

    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle(
            'active',
            p.id === 'page-' + page
        );
    });

    if (page === 'orders') {
        renderOrders();
    }

    if (page === 'reports') {
        renderReports();
    }

    if (page === 'settings') {
        renderSettings();
    }
}

document.querySelectorAll('[data-page]').forEach(b => {
    b.onclick = () => navigate(b.dataset.page);
});

// ========================================
// CATEGORY FILTER
// ========================================

document.querySelectorAll('[data-cat]').forEach(b => {
    b.onclick = () => {
        category = b.dataset.cat;

        document.querySelectorAll('[data-cat]').forEach(x => {
            x.classList.toggle('selected', x === b);
        });

        renderGrid();
    };
});

// ========================================
// ORDER TYPE
// ========================================

document.querySelectorAll('[data-type]').forEach(b => {
    b.onclick = () => {
        orderType = b.dataset.type;

        document.querySelectorAll('[data-type]').forEach(x => {
            x.classList.toggle('selected', x === b);
        });

        $('tableBox').style.display =
            orderType === 'Dine in' ? 'block' : 'none';
    };
});

// ========================================
// PRODUCT GRID
// ========================================

function renderGrid() {
    $('grid').innerHTML = db.menu
        .filter(p =>
            category === 'all' ||
            p.category === category
        )
        .map(p => `
            <article class="product">
                <img
                    src="${p.image}"
                    alt="${esc(p.name)}"
                >

                <div class="product-info">
                    <small>${p.category}</small>

                    <h3>${esc(p.name)}</h3>

                    <div class="product-bottom">
                        <strong>
                            From ${peso(p.small)}
                        </strong>

                        <button
                            class="addbtn"
                            data-product="${p.id}"
                        >
                            Add +
                        </button>
                    </div>
                </div>
            </article>
        `)
        .join('');

    document.querySelectorAll('[data-product]').forEach(b => {
        b.onclick = () => {
            openProduct(Number(b.dataset.product));
        };
    });
}

// ========================================
// MODAL
// ========================================

function modal(show, id) {
    $(id).classList.toggle('show', show);

    $(id).setAttribute(
        'aria-hidden',
        String(!show)
    );
}

// ========================================
// OPEN PRODUCT
// ========================================

function openProduct(id) {
    current = db.menu.find(p => p.id === id);

    if (!current) {
        return;
    }

    chosenSize = 'Small';
    chosenQty = 1;

    $('modalPhoto').src = current.image;
    $('modalTitle').textContent = current.name;

    $('modalStarting').textContent =
        `Small ${peso(current.small)} · Big ${peso(current.big)}`;

    $('instructions').value = '';
    $('qty').textContent = '1';

    document.querySelectorAll('[data-size]').forEach(b => {
        b.classList.toggle(
            'selected',
            b.dataset.size === 'Small'
        );
    });

    $('addonOptions').innerHTML = db.addons
        .map(a => `
            <label>
                <input
                    type="checkbox"
                    value="${esc(a.id)}"
                >

                ${esc(a.name)}
                (+${peso(a.price)})
            </label>
        `)
        .join('');

    preview();
    modal(true, 'overlay');
}

// ========================================
// ADD-ONS AND PRICING
// ========================================

function pickedAddons() {
    return [
        ...$('addonOptions').querySelectorAll('input:checked')
    ]
        .map(input =>
            db.addons.find(a => a.id === input.value)
        )
        .filter(Boolean);
}

function unitPrice() {
    return (
        Number(current[chosenSize.toLowerCase()]) +
        pickedAddons().reduce(
            (sum, a) => sum + a.price,
            0
        )
    );
}

function preview() {
    $('previewTotal').textContent =
        peso(unitPrice() * chosenQty);
}

// ========================================
// SIZE SELECTION
// ========================================

document.querySelectorAll('[data-size]').forEach(b => {
    b.onclick = () => {
        chosenSize = b.dataset.size;

        document.querySelectorAll('[data-size]').forEach(x => {
            x.classList.toggle('selected', x === b);
        });

        preview();
    };
});

$('addonOptions').onchange = preview;

// ========================================
// QUANTITY CONTROLS
// ========================================

$('qtyMinus').onclick = () => {
    chosenQty = Math.max(1, chosenQty - 1);

    $('qty').textContent = chosenQty;

    preview();
};

$('qtyPlus').onclick = () => {
    chosenQty = Math.min(99, chosenQty + 1);

    $('qty').textContent = chosenQty;

    preview();
};

// ========================================
// CLOSE PRODUCT MODAL
// ========================================

$('closeDialog').onclick = () => {
    modal(false, 'overlay');
};

$('overlay').onclick = e => {
    if (e.target === $('overlay')) {
        modal(false, 'overlay');
    }
};

// ========================================
// ADD ITEM TO CART
// ========================================

$('addItem').onclick = () => {
    if (!current) {
        return;
    }

    const selected = pickedAddons().map(a => ({
        name: a.name,
        price: a.price
    }));

    const unit = unitPrice();

    cart.push({
        name: current.name,
        productId: current.id,
        size: chosenSize,
        addons: selected,
        qty: chosenQty,
        note: $('instructions').value.trim(),
        unit,
        total: unit * chosenQty
    });

    modal(false, 'overlay');

    renderCart();

    toast('Added to your order.');
};

// ========================================
// RENDER CART
// ========================================

function renderCart() {
    const count = cart.reduce(
        (s, i) => s + i.qty,
        0
    );

    const total = cart.reduce(
        (s, i) => s + i.total,
        0
    );

    $('itemCount').textContent = count;
    $('total').textContent = peso(total);

    $('cart').innerHTML = cart.length
        ? cart.map((i, index) => `
            <div class="cart-row">
                <div class="cart-copy">
                    <strong>
                        ${i.qty} × ${esc(i.name)}
                    </strong>

                    <small>
                        ${esc(i.size)}

                        ${i.addons.length
                            ? ' · ' + esc(
                                i.addons
                                    .map(a => a.name)
                                    .join(', ')
                            )
                            : ''
                        }

                        ${i.note
                            ? ' · ' + esc(i.note)
                            : ''
                        }
                    </small>

                    <button
                        class="remove"
                        data-remove="${index}"
                    >
                        Remove
                    </button>
                </div>

                <b class="amount">
                    ${peso(i.total)}
                </b>
            </div>
        `).join('')
        : `
            <div class="empty">
                <strong>
                    No drinks added yet.
                </strong>
            </div>
        `;

    $('cart')
        .querySelectorAll('[data-remove]')
        .forEach(b => {
            b.onclick = () => {
                cart.splice(
                    Number(b.dataset.remove),
                    1
                );

                renderCart();
            };
        });
}

// ========================================
// RESET CART
// ========================================

$('resetCart').onclick = () => {
    if (
        cart.length &&
        !confirm('Clear the current unsaved order?')
    ) {
        return;
    }

    cart = [];

    renderCart();
};

// ========================================
// ORDER ID GENERATOR
// ========================================

function orderId() {
    return (
        'LM-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        Math.random()
            .toString(36)
            .slice(2, 5)
            .toUpperCase()
    );
}

// ========================================
// SAVE ORDER
// ========================================

$('saveOrder').onclick = async () => {
    if (!cart.length) {
        toast('Please add a drink first.');
        return;
    }

    const order = {
        id: orderId(),

        createdAt: new Date().toISOString(),

        customer: $('customer').value.trim() || 'Walk-in',

        type: orderType,

        table: orderType === 'Dine in'
            ? $('table').value.trim()
            : '',

        payment: $('payment').value,

        items: structuredClone(cart),

        total: cart.reduce(
            (s, i) => s + i.total,
            0
        ),

        status: 'Pending',

        events: [
            {
                at: new Date().toISOString(),
                action: 'Order placed'
            }
        ]
    };

    try { await window.cloud.saveOrder(order); } catch(e) { toast('Order not saved: '+e.message); return; }

    cart = [];

    renderCart();

    $('customer').value = '';
    $('table').value = '';

    toast(`Order ${order.id} saved!`);

    navigate('orders');
};

// ========================================
// RENDER ORDERS
// ========================================

function renderOrders() {
    $('ordersBody').innerHTML = db.orders.length
        ? db.orders.map(o => {
            const voided = o.status === 'Voided';

            const summary = o.items
                .map(i =>
                    `${i.qty}× ${esc(i.name)} (${esc(i.size)})`
                )
                .join('<br>');

            const audit = voided
                ? `
                    <small>
                        By ${esc(o.voidedBy)} ·
                        ${new Date(o.voidedAt).toLocaleString('en-PH')}

                        <br>

                        Reason: ${esc(o.voidReason)}

                        ${o.voidNote
                            ? ' — ' + esc(o.voidNote)
                            : ''
                        }
                    </small>
                `
                : '';

            return `
                <tr>
                    <td>
                        <strong>${esc(o.id)}</strong>
                    </td>

                    <td>
                        ${new Date(o.createdAt).toLocaleString('en-PH')}
                    </td>

                    <td>
                        ${esc(o.customer)}

                        <small>
                            ${esc(o.type)}

                            ${o.table
                                ? ' · ' + esc(o.table)
                                : ''
                            }

                            · ${esc(o.payment)}
                        </small>
                    </td>

                    <td>${summary}</td>

                    <td>
                        <strong>${peso(o.total)}</strong>
                    </td>

                    <td>
                        ${voided
                            ? `
                                <span class="badge">
                                    VOIDED
                                </span>

                                ${audit}
                            `
                            : `
                                <select
                                    class="status"
                                    data-status="${esc(o.id)}"
                                >
                                    ${[
                                        'Pending',
                                        'Preparing',
                                        'Ready',
                                        'Completed'
                                    ].map(s => `
                                        <option
                                            ${o.status === s
                                                ? 'selected'
                                                : ''
                                            }
                                        >
                                            ${s}
                                        </option>
                                    `).join('')}
                                </select>

                                <button
                                    class="voidbtn"
                                    data-void="${esc(o.id)}"
                                >
                                    Void
                                </button>
                            `
                        }
                    </td>
                </tr>
            `;
        }).join('')
        : `
            <tr>
                <td colspan="6">
                    No orders yet.
                    Your first order will appear here.
                </td>
            </tr>
        `;

    // Update order status

    $('ordersBody')
        .querySelectorAll('[data-status]')
        .forEach(el => {
            el.onchange = async () => {
                const o = db.orders.find(
                    x => x.id === el.dataset.status
                );

                if (!o || o.status === 'Voided') {
                    return;
                }

                const old = o.status;

                try { await window.cloud.updateStatus(o, el.value); } catch(e) { toast('Update failed: '+e.message); }

                renderOrders();
            };
        });

    // Void order button

    $('ordersBody')
        .querySelectorAll('[data-void]')
        .forEach(el => {
            el.onclick = () => {
                openVoid(el.dataset.void);
            };
        });
}

// ========================================
// OPEN VOID MODAL
// ========================================

function openVoid(id) {
    const o = db.orders.find(x => x.id === id);

    if (!o || o.status === 'Voided') {
        return;
    }

    voidId = id;

    $('voidTitle').textContent = 'Void ' + id;

    $('voidStaff').value = '';
    $('voidReason').value = '';
    $('voidNote').value = '';

    modal(true, 'voidOverlay');
}

// ========================================
// CLOSE VOID MODAL
// ========================================

$('closeVoid').onclick = () => {
    modal(false, 'voidOverlay');
};

$('voidOverlay').onclick = e => {
    if (e.target === $('voidOverlay')) {
        modal(false, 'voidOverlay');
    }
};

// ========================================
// CONFIRM VOID
// ========================================

$('confirmVoid').onclick = async () => {
    const staff = $('voidStaff').value.trim();
    const reason = $('voidReason').value;
    const note = $('voidNote').value.trim();

    if (!staff || !reason) {
        toast('Staff name and void reason are required.');
        return;
    }

    const o = db.orders.find(x => x.id === voidId);

    if (!o || o.status === 'Voided') {
        return;
    }

    if (
        !confirm(
            `Void ${o.id} (${peso(o.total)})?\n\n` +
            'This transaction will stay in order history ' +
            'but be excluded from sales.'
        )
    ) {
        return;
    }

    try { await window.cloud.voidOrder(o,staff,reason,note); } catch(e) { toast('Void failed: '+e.message); return; }

    modal(false, 'voidOverlay');

    renderOrders();
    renderReports();

    toast('Order voided. Audit details retained.');
};

// ========================================
// LOCAL DATE
// ========================================

function localDate(iso) {
    const d = new Date(iso);

    return (
        `${d.getFullYear()}-` +
        `${String(d.getMonth() + 1).padStart(2, '0')}-` +
        `${String(d.getDate()).padStart(2, '0')}`
    );
}

// ========================================
// REPORTS
// ========================================

function renderReports() {
    const today =
        $('reportDate').value ||
        localDate(new Date().toISOString());

    const active = db.orders.filter(
        o => o.status !== 'Voided'
    );

    const todays = active.filter(
        o => localDate(o.createdAt) === today
    );

    // Today's revenue

    $('todayRevenue').textContent = peso(
        todays.reduce((s, o) => s + o.total, 0)
    );

    // Today's order count

    $('todayCount').textContent = todays.length;

    // Overall revenue

    $('allRevenue').textContent = peso(
        active.reduce((s, o) => s + o.total, 0)
    );

    // Voided order count

    $('voidCount').textContent = db.orders.filter(
        o => o.status === 'Voided'
    ).length;

    // Product sales breakdown

    const data = {};

    todays.forEach(o => {
        o.items.forEach(i => {
            const key = i.name;

            data[key] ??= {
                qty: 0,
                total: 0
            };

            data[key].qty += i.qty;
            data[key].total += i.total;
        });
    });

    // Orders for selected date

    $('dateOrders').innerHTML = db.orders
        .filter(o => localDate(o.createdAt) === today)
        .map(o => `
            <tr>
                <td>${esc(o.id)}</td>

                <td>
                    ${new Date(o.createdAt).toLocaleTimeString('en-PH')}
                </td>

                <td>${esc(o.status)}</td>

                <td>
                    ${peso(
                        o.status === 'Voided'
                            ? 0
                            : o.total
                    )}
                </td>
            </tr>
        `)
        .join('') || `
            <tr>
                <td colspan="4">
                    No transactions for this date.
                </td>
            </tr>
        `;

    // Sales breakdown table

    $('breakdown').innerHTML = Object.entries(data)
        .map(([name, v]) => `
            <tr>
                <td>${esc(name)}</td>
                <td>${v.qty}</td>
                <td>${peso(v.total)}</td>
            </tr>
        `)
        .join('') || `
            <tr>
                <td colspan="3">
                    No orders recorded today.
                </td>
            </tr>
        `;
}

// ========================================
// SETTINGS
// ========================================

function renderSettings() {
    // Menu prices

    $('priceBody').innerHTML = db.menu
        .map(p => `
            <tr>
                <td>${esc(p.name)}</td>

                <td>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        data-price="${p.id}:small"
                        value="${p.small}"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        data-price="${p.id}:big"
                        value="${p.big}"
                    >
                </td>
            </tr>
        `)
        .join('');

    // Add-on prices

    $('addonSettings').innerHTML = db.addons
        .map(a => `
            <label class="label">
                ${esc(a.name)} (₱)

                <input
                    type="number"
                    min="0"
                    step="0.01"
                    data-addon="${esc(a.id)}"
                    value="${a.price}"
                >
            </label>
        `)
        .join('');
}

// ========================================
// SAVE SETTINGS
// ========================================

$('saveSettings').onclick = async () => {
    const prices = [
        ...document.querySelectorAll('[data-price]')
    ];

    const addons = [
        ...document.querySelectorAll('[data-addon]')
    ];

    const invalid = [...prices, ...addons].some(el =>
        el.value.trim() === '' ||
        !Number.isFinite(Number(el.value)) ||
        Number(el.value) < 0
    );

    if (invalid) {
        toast('Please enter valid non-negative prices.');
        return;
    }

    // Update menu prices

    prices.forEach(el => {
        const [id, size] = el.dataset.price.split(':');

        db.menu.find(
            p => p.id === Number(id)
        )[size] = Number(el.value);
    });

    // Update add-on prices

    addons.forEach(el => {
        db.addons.find(
            a => a.id === el.dataset.addon
        ).price = Number(el.value);
    });

    try { await window.cloud.saveMenu(db.menu,db.addons); toast('Menu prices saved!'); } catch(e) { toast('Could not save prices: '+e.message); }
    renderGrid();
};

// ========================================
// CSV DOWNLOAD FUNCTION
// ========================================

function downloadCSV(filename, rows) {
    const csv =
        '\ufeff' +
        rows
            .map(row =>
                row
                    .map(v =>
                        '"' +
                        ( /^[=+\-@\t\r]/.test(String(v ?? '')) ? '\'' + String(v ?? '') : String(v ?? '') ).replaceAll('"', '""') +
                        '"'
                    )
                    .join(',')
            )
            .join('\r\n');

    const url = URL.createObjectURL(
        new Blob([csv], {
            type: 'text/csv;charset=utf-8;'
        })
    );

    const a = document.createElement('a');

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    a.click();
    setTimeout(() => a.remove(), 1000);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

// ========================================
// EXPORT ALL ORDERS
// ========================================

$('exportOrders').onclick = () => {
    downloadCSV(
        'love-matchaa-orders.csv',
        [
            [
                'Order ID',
                'Date',
                'Customer',
                'Type',
                'Table',
                'Payment',
                'Items',
                'Total',
                'Status',
                'Voided At',
                'Voided By',
                'Void Reason',
                'Void Note',
                'Audit Events'
            ],

            ...db.orders.map(o => [
                o.id,

                new Date(o.createdAt).toLocaleString('en-PH'),

                o.customer,
                o.type,
                o.table,
                o.payment,

                o.items
                    .map(i =>
                        `${i.qty}x ${i.name} ${i.size} ` +
                        `${i.addons.map(a => a.name).join('+')}`
                    )
                    .join('; '),

                o.total,
                o.status,
                o.voidedAt || '',
                o.voidedBy || '',
                o.voidReason || '',
                o.voidNote || '',

                (o.events || [])
                    .map(e => `${e.at}: ${e.action}`)
                    .join('; ')
            ])
        ]
    );
};

// ========================================
// EXPORT SALES
// ========================================

$('exportSales').onclick = () => {
    downloadCSV(
        'love-matchaa-sales.csv',
        [
            [
                'Order ID',
                'Date',
                'Customer',
                'Status',
                'Amount',
                'Voided By',
                'Void Reason'
            ],

            ...db.orders.map(o => [
                o.id,

                new Date(o.createdAt).toLocaleString('en-PH'),

                o.customer,
                o.status,

                o.status === 'Voided'
                    ? 0
                    : o.total,

                o.voidedBy || '',
                o.voidReason || ''
            ])
        ]
    );
};

// ========================================
// REPORT DATE
// ========================================

$('reportDate').value = localDate(
    new Date().toISOString()
);

$('reportDate').addEventListener(
    'change',
    renderReports
);

// ========================================
// END OF DAY REPORT
// ========================================

$('endOfDay').onclick = () => {
    const day = $('reportDate').value;

    const rows = db.orders.filter(
        o => localDate(o.createdAt) === day
    );

    downloadCSV(
        `love-matchaa-end-of-day-${day}.csv`,
        [
            [
                'Order ID',
                'Date',
                'Customer',
                'Order Type',
                'Payment',
                'Items',
                'Status',
                'Original Total',
                'Sales Amount',
                'Voided By',
                'Void Reason'
            ],

            ...rows.map(o => [
                o.id,

                new Date(o.createdAt).toLocaleString('en-PH'),

                o.customer,
                o.type,
                o.payment,

                o.items
                    .map(i =>
                        `${i.qty}x ${i.name} (${i.size})`
                    )
                    .join('; '),

                o.status,
                o.total,

                o.status === 'Voided'
                    ? 0
                    : o.total,

                o.voidedBy || '',
                o.voidReason || ''
            ])
        ]
    );
};

// ========================================
// AUTOMATIC DATE REFRESH
// ========================================

let lastDay = localDate(
    new Date().toISOString()
);

setInterval(() => {
    const now = localDate(
        new Date().toISOString()
    );

    if (now !== lastDay) {
        if ($('reportDate').value === lastDay) {
            $('reportDate').value = now;
        }

        lastDay = now;

        renderReports();
    }
}, 30000);

// ========================================
// INITIALIZE APPLICATION
// ========================================

renderGrid();
renderCart();
renderReports();
window.cloudRender = (orders, menuData) => {
    db.orders = orders;
    if (menuData) { db.menu = menuData.menu; db.addons = menuData.addons; renderGrid(); }
    renderOrders(); renderReports();
};
window.dispatchEvent(new Event("pos-ready"));
});
