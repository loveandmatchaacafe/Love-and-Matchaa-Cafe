window.addEventListener('cloud-ready', () => {
    'use strict';

    // ============================================================
    // LOVE & MATCHAA CAFÉ — ORDER DESK
    // Firebase-connected POS
    // ============================================================

    const $ = id => document.getElementById(id);

    // ============================================================
    // DEFAULT MENU — 13 DRINKS
    // ============================================================

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
        ['Hot Cafe Latte', 'coffee', 115, 135],

        ['Ube Matcha Latte', 'matcha', 150, 170],
        ['Banana Matcha Latte', 'matcha', 145, 165]

    ].map(([name, category, small, big], index) => ({
        id: index + 1,
        name,
        category,
        small,
        big,
        image: index === 11
            ? 'assets/images/ube-matcha-latte.webp'
            : index === 12
                ? 'assets/images/banana-matcha-latte.webp'
                : `assets/images/drink-${index + 1}.webp`
    }));

    // ============================================================
    // DEFAULT ADD-ONS
    // ============================================================

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

    // ============================================================
    // APPLICATION STATE
    // ============================================================

    let db = {
        menu: structuredClone(DEFAULT_MENU),
        addons: structuredClone(DEFAULT_ADDONS),
        orders: [],
        oatMilkPrice: 20
    };

    let cart = [];
    let category = 'all';
    let orderType = 'Dine in';

    let current = null;
    let chosenSize = 'Small';
    let chosenQty = 1;
    let chosenMilk = 'Fresh Milk';

    // These drinks allow Fresh Milk to be substituted with Oat Milk.
    const FRESH_MILK_DRINKS = [
        'Biscoff Matcha Latte',
        'Mango Matcha Latte',
        'Matcha Ichigo'
    ];

    // These drinks already use Oat Milk as their standard milk.
    const OAT_MILK_DEFAULT_DRINKS = [
        'Vanilla Matcha Latte',
        'Lavender Matcha'
    ];

    function milkTypeFor(product) {
        if (!product) return 'none';

        if (FRESH_MILK_DRINKS.includes(product.name)) {
            return 'choice';
        }

        if (OAT_MILK_DEFAULT_DRINKS.includes(product.name)) {
            return 'default-oat';
        }

        return 'none';
    }

    let voidId = null;
    let currentPage = 'pos';
    let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // ============================================================
    // HELPERS
    // ============================================================

    function peso(value) {
        return '₱' + Number(value || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function esc(value) {
        return String(value ?? '').replace(
            /[&<>"']/g,
            character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[character])
        );
    }

    function toast(message) {
        const element = $('toast');

        if (!element) return;

        element.textContent = message;
        element.style.display = 'block';

        clearTimeout(window.toastTimer);

        window.toastTimer = setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }

    function localDate(dateValue) {
        const date = new Date(dateValue);

        return (
            date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0')
        );
    }

    function formatDate(dateValue) {
        if (!dateValue) return '—';

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) return '—';

        return date.toLocaleString('en-PH');
    }

    function emptyRow(columns, message) {
        return `
            <tr>
                <td colspan="${columns}">
                    ${esc(message)}
                </td>
            </tr>
        `;
    }

    function updateDrinkCount() {
        const count = document.querySelector('.catalog .count');

        if (count) {
            count.textContent = `${db.menu.length} drinks`;
        }
    }

    // ============================================================
    // CLOCK
    // ============================================================

    function updateClock() {
        const now = new Date();

        if ($('clock')) {
            $('clock').textContent = now.toLocaleTimeString(
                'en-PH',
                {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }
            );
        }

        if ($('today')) {
            $('today').textContent = now.toLocaleDateString(
                'en-PH',
                {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }
            );
        }
    }

    updateClock();
    setInterval(updateClock, 1000);

    // ============================================================
    // PAGE NAVIGATION
    // ============================================================

    function navigate(page) {
        currentPage = page;

        document.querySelectorAll('[data-page]').forEach(button => {
            button.classList.toggle(
                'active',
                button.dataset.page === page
            );
        });

        document.querySelectorAll('.page').forEach(section => {
            section.classList.toggle(
                'active',
                section.id === `page-${page}`
            );
        });

        if (page === 'pos') {
            renderGrid();
            renderCart();
        }

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

    document.querySelectorAll('[data-page]').forEach(button => {
        button.onclick = () => navigate(button.dataset.page);
    });

    // Used by cloud.js when switching View / Manage.
    window.cloudNavigate = navigate;

    // ============================================================
    // CATEGORY FILTER
    // ============================================================

    document.querySelectorAll('[data-cat]').forEach(button => {
        button.onclick = () => {
            category = button.dataset.cat;

            document.querySelectorAll('[data-cat]').forEach(item => {
                item.classList.toggle(
                    'selected',
                    item === button
                );
            });

            renderGrid();
        };
    });

    $('tip').addEventListener('input', renderCart);

    function updatePaymentDisplay() {
        const isGCash = $('payment').value === 'GCash';
        $('gcashQrPanel').hidden = !isGCash;
    }
    $('payment').addEventListener('change', updatePaymentDisplay);
    $('gcashQrImage').addEventListener('load', () => {
        $('gcashQrImage').hidden = false;
        $('gcashQrPlaceholder').hidden = true;
    });
    $('gcashQrImage').addEventListener('error', () => {
        $('gcashQrImage').hidden = true;
        $('gcashQrPlaceholder').hidden = false;
    });

    // ============================================================
    // ORDER TYPE
    // ============================================================

    document.querySelectorAll('[data-type]').forEach(button => {
        button.onclick = () => {
            orderType = button.dataset.type;

            document.querySelectorAll('[data-type]').forEach(item => {
                item.classList.toggle(
                    'selected',
                    item === button
                );
            });

        };
    });

    // ============================================================
    // PRODUCT GRID
    // ============================================================

    function renderGrid() {
        const grid = $('grid');

        if (!grid) return;

        updateDrinkCount();

        const products = db.menu.filter(product => {
            return (
                category === 'all' ||
                product.category === category
            );
        });

        grid.innerHTML = products.map(product => `
            <article class="product">

                <img
                    src="${esc(product.image)}"
                    alt="${esc(product.name)}"
                    loading="lazy"
                >

                <div class="product-info">

                    <small>${esc(product.category)}</small>

                    <h3>${esc(product.name)}</h3>

                    <div class="product-bottom">

                        <strong>
                            From ${peso(product.small)}
                        </strong>

                        <button
                            class="addbtn"
                            data-product="${product.id}"
                            type="button"
                        >
                            Add +
                        </button>

                    </div>

                </div>

            </article>
        `).join('');

        grid.querySelectorAll('[data-product]').forEach(button => {
            button.onclick = () => {
                openProduct(Number(button.dataset.product));
            };
        });
    }

    // ============================================================
    // MODAL HELPERS
    // ============================================================

    function modal(show, id) {
        const element = $(id);

        if (!element) return;

        element.classList.toggle('show', show);
        element.setAttribute('aria-hidden', String(!show));
    }

    // ============================================================
    // OPEN DRINK CUSTOMIZATION
    // ============================================================

    function openProduct(id) {
        current = db.menu.find(product => product.id === id);

        if (!current) return;

        chosenSize = 'Small';
        chosenQty = 1;

        $('modalPhoto').src = current.image;
        $('modalPhoto').alt = current.name;

        $('modalTitle').textContent = current.name;

        $('modalStarting').textContent =
            `Small ${peso(current.small)} · Big ${peso(current.big)}`;

        $('instructions').value = '';
        $('qty').textContent = '1';
        chosenMilk = 'Fresh Milk';

        // Milk customization is shown only for the applicable drinks.
        const milkOptions = $('milkOptions');
        const milkType = milkTypeFor(current);

        if (milkType === 'choice') {
            milkOptions.innerHTML = `
                <h3>Milk option <span class="soft">(optional)</span></h3>
                <div class="addon-options milk-options">
                    <label>
                        <input type="radio" name="milkChoice" value="Fresh Milk" checked>
                        Fresh Milk
                    </label>
                    <label>
                        <input type="radio" name="milkChoice" value="Oat Milk">
                        Oat Milk (+${peso(db.oatMilkPrice)})
                    </label>
                </div>
            `;

            milkOptions.hidden = false;

            milkOptions.querySelectorAll('input[name="milkChoice"]').forEach(input => {
                input.addEventListener('change', () => {
                    chosenMilk = input.value;
                    preview();
                });
            });

        } else if (milkType === 'default-oat') {
            chosenMilk = 'Oat Milk';

            milkOptions.innerHTML = `
                <h3>Milk</h3>
                <p class="milk-standard">
                    Oat Milk
                    <span class="soft">(standard · no extra charge)</span>
                </p>
            `;

            milkOptions.hidden = false;

        } else {
            chosenMilk = '';
            milkOptions.innerHTML = '';
            milkOptions.hidden = true;
        }

        document.querySelectorAll('[data-size]').forEach(button => {
            button.classList.toggle(
                'selected',
                button.dataset.size === 'Small'
            );
        });

        $('addonOptions').innerHTML = db.addons.map(addon => `
            <label>

                <input
                    type="checkbox"
                    value="${esc(addon.id)}"
                >

                ${esc(addon.name)}
                (+${peso(addon.price)})

            </label>
        `).join('');

        preview();
        modal(true, 'overlay');
    }

    // ============================================================
    // CUSTOMIZATION PRICING
    // ============================================================

    function pickedAddons() {
        return [
            ...$('addonOptions').querySelectorAll('input:checked')
        ]
            .map(input => {
                return db.addons.find(
                    addon => addon.id === input.value
                );
            })
            .filter(Boolean);
    }

    function unitPrice() {
        if (!current) return 0;

        const base = Number(
            current[chosenSize.toLowerCase()]
        );

        const addonTotal = pickedAddons().reduce(
            (total, addon) => total + Number(addon.price),
            0
        );

        const milkExtra =
            milkTypeFor(current) === 'choice' && chosenMilk === 'Oat Milk'
                ? Number(db.oatMilkPrice || 0)
                : 0;

        return base + addonTotal + milkExtra;
    }

    function preview() {
        $('previewTotal').textContent =
            peso(unitPrice() * chosenQty);
    }

    document.querySelectorAll('[data-size]').forEach(button => {
        button.onclick = () => {
            chosenSize = button.dataset.size;

            document.querySelectorAll('[data-size]').forEach(item => {
                item.classList.toggle(
                    'selected',
                    item === button
                );
            });

            preview();
        };
    });

    $('addonOptions').onchange = preview;

    // ============================================================
    // QUANTITY
    // ============================================================

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

    // ============================================================
    // CLOSE DRINK MODAL
    // ============================================================

    $('closeDialog').onclick = () => {
        modal(false, 'overlay');
    };

    $('overlay').onclick = event => {
        if (event.target === $('overlay')) {
            modal(false, 'overlay');
        }
    };

    // ============================================================
    // ADD DRINK TO CART
    // ============================================================

    $('addItem').onclick = () => {
        if (!current) return;

        const addons = pickedAddons().map(addon => ({
            name: addon.name,
            price: Number(addon.price)
        }));

        const unit = unitPrice();

        cart.push({
            name: current.name,
            productId: current.id,
            size: chosenSize,
            milk: chosenMilk,
            milkExtra: (
                milkTypeFor(current) === 'choice' && chosenMilk === 'Oat Milk'
                    ? Number(db.oatMilkPrice || 0)
                    : 0
            ),
            addons,
            qty: chosenQty,
            note: $('instructions').value.trim(),
            unit,
            total: unit * chosenQty
        });

        modal(false, 'overlay');

        renderCart();

        toast('Added to your order.');
    };

    // ============================================================
    // CART
    // ============================================================

    function renderCart() {
        const count = cart.reduce(
            (total, item) => total + item.qty,
            0
        );

        const subtotal = cart.reduce(
            (sum, item) => sum + item.total,
            0
        );
        const tip = Math.max(0, Number($('tip')?.value || 0));
        const total = subtotal + tip;

        $('itemCount').textContent = count;
        $('tipDisplay').textContent = peso(tip);
        $('total').textContent = peso(total);

        if (!cart.length) {
            $('cart').innerHTML = `
                <div class="empty">
                    <strong>No drinks added yet.</strong>
                </div>
            `;

            return;
        }

        $('cart').innerHTML = cart.map((item, index) => {
            const addonNames = item.addons
                .map(addon => addon.name)
                .join(', ');

            return `
                <div class="cart-row">

                    <div class="cart-copy">

                        <strong>
                            ${item.qty} × ${esc(item.name)}
                        </strong>

                        <small>
                            ${esc(item.size)}

                            ${item.milk
                                ? ' · ' + esc(item.milk) +
                                  (Number(item.milkExtra || 0) > 0
                                      ? ' (+' + peso(item.milkExtra) + ')'
                                      : '')
                                : ''}

                            ${addonNames
                                ? ' · ' + esc(addonNames)
                                : ''}

                            ${item.note
                                ? ' · ' + esc(item.note)
                                : ''}
                        </small>

                        <button
                            class="remove"
                            data-remove="${index}"
                            type="button"
                        >
                            Remove
                        </button>

                    </div>

                    <b class="amount">
                        ${peso(item.total)}
                    </b>

                </div>
            `;
        }).join('');

        $('cart').querySelectorAll('[data-remove]').forEach(button => {
            button.onclick = () => {
                cart.splice(
                    Number(button.dataset.remove),
                    1
                );

                renderCart();
            };
        });
    }

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

    // ============================================================
    // ORDER ID
    // ============================================================

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

    // ============================================================
    // PLACE ORDER — FIREBASE
    // ============================================================

    $('saveOrder').onclick = async () => {
        if (!cart.length) {
            toast('Please add a drink first.');
            return;
        }

        const button = $('saveOrder');

        button.disabled = true;

        const now = new Date().toISOString();

        const order = {
            id: orderId(),
            createdAt: now,

            customer:
                $('customer').value.trim() || 'Walk-in',

            type: orderType,

            tip: Math.max(0, Number($('tip').value || 0)),
            discoverySource: $('discoverySource').value,
            payment: $('payment').value,

            items: structuredClone(cart),

            subtotal: cart.reduce(
                (sum, item) => sum + item.total,
                0
            ),
            total: cart.reduce(
                (sum, item) => sum + item.total,
                0
            ) + Math.max(0, Number($('tip').value || 0)),

            status: 'Pending',

            events: [
                {
                    at: now,
                    action: 'Order placed'
                }
            ]
        };

        try {
            await window.cloud.saveOrder(order);

            cart = [];

            renderCart();

            $('customer').value = '';
            $('tip').value = '0';
            $('discoverySource').value = '';
            $('payment').value = 'Cash';
            updatePaymentDisplay();
            renderCart();

            toast(`Order ${order.id} saved!`);

            navigate('orders');

        } catch (error) {
            console.error('Save order failed:', error);

            toast('Order not saved: ' + error.message);

        } finally {
            button.disabled = false;
        }
    };

    // ============================================================
    // ORDER HISTORY
    // ============================================================

    function renderOrders() {
        const body = $('ordersBody');

        if (!body) return;

        if (!db.orders.length) {
            body.innerHTML = emptyRow(
                6,
                'No orders yet. Your first order will appear here.'
            );

            return;
        }

        body.innerHTML = db.orders.map(order => {
            const voided = order.status === 'Voided';

            const items = (order.items || [])
                .map(item => {
                    return (
                        `${item.qty}× ${esc(item.name)} ` +
                        `(${esc(item.size)}` +
                        `${item.milk ? ', ' + esc(item.milk) : ''})`
                    );
                })
                .join('<br>');

            const audit = voided
                ? `
                    <small>
                        By ${esc(order.voidedBy || '—')}
                        · ${formatDate(order.voidedAt)}

                        <br>

                        Reason:
                        ${esc(order.voidReason || '—')}

                        ${order.voidNote
                            ? ' — ' + esc(order.voidNote)
                            : ''}
                    </small>
                `
                : '';

            const statusOptions = [
                'Pending',
                'Preparing',
                'Ready',
                'Completed'
            ].map(status => `
                <option
                    value="${status}"
                    ${order.status === status ? 'selected' : ''}
                >
                    ${status}
                </option>
            `).join('');

            const actions = voided
                ? `
                    <span class="badge">VOIDED</span>
                    ${audit}
                    <button class="delete-voided" data-delete-voided="${esc(order.id)}" type="button" aria-label="Delete voided order">Delete</button>
                `
                : `
                    <select
                        class="status"
                        data-status="${esc(order.id)}"
                    >
                        ${statusOptions}
                    </select>

                    <button
                        class="voidbtn"
                        data-void="${esc(order.id)}"
                        type="button"
                    >
                        Void
                    </button>
                `;

            return `
                <tr>

                    <td>
                        <strong>${esc(order.id)}</strong>
                    </td>

                    <td>
                        ${formatDate(order.createdAt)}
                    </td>

                    <td>
                        ${esc(order.customer || 'Walk-in')}

                        <small>
                            ${order.recordType === 'Historical' ? 'Previous sale' : esc(order.type || '')}

                            · ${esc(order.payment || '')}
                            ${order.discoverySource ? ' · Found us: ' + esc(order.discoverySource) : ''}
                            ${Number(order.tip || 0) > 0 ? ' · Tip: ' + peso(order.tip) : ''}
                        </small>
                    </td>

                    <td>${items}</td>

                    <td>
                        <strong>${peso(order.total)}</strong>
                    </td>

                    <td>${actions}</td>

                </tr>
            `;
        }).join('');

        // Status changes are saved to Firebase.
        body.querySelectorAll('[data-status]').forEach(select => {
            select.onchange = async () => {
                const order = db.orders.find(
                    item => item.id === select.dataset.status
                );

                if (!order || order.status === 'Voided') {
                    return;
                }

                const previousStatus = order.status;

                select.disabled = true;

                try {
                    await window.cloud.updateStatus(
                        order,
                        select.value
                    );

                    toast('Order status updated.');

                } catch (error) {
                    select.value = previousStatus;

                    toast('Update failed: ' + error.message);

                } finally {
                    select.disabled = false;
                }
            };
        });

        body.querySelectorAll('[data-void]').forEach(button => {
            button.onclick = () => {
                openVoid(button.dataset.void);
            };
        });

        // Swipe a voided order left to reveal its Delete action.
        body.querySelectorAll('tr').forEach(row => {
            let startX = 0;
            row.addEventListener('touchstart', event => {
                startX = event.changedTouches[0].clientX;
            }, { passive: true });
            row.addEventListener('touchend', event => {
                const deltaX = event.changedTouches[0].clientX - startX;
                if (deltaX < -45 && row.querySelector('[data-delete-voided]')) {
                    row.classList.add('swipe-delete-open');
                } else if (deltaX > 45) {
                    row.classList.remove('swipe-delete-open');
                }
            }, { passive: true });
        });

        body.querySelectorAll('[data-delete-voided]').forEach(button => {
            button.onclick = async () => {
                if (!confirm('Permanently delete this already-voided order? It will be removed from order history and exports.')) return;
                button.disabled = true;
                try {
                    await window.cloud.deleteVoidedOrder(button.dataset.deleteVoided);
                    toast('Voided order deleted.');
                } catch (error) {
                    button.disabled = false;
                    toast('Delete failed: ' + error.message);
                }
            };
        });

        // View-only mode should not expose editing controls.
        const viewOnly = document.body.classList.contains(
            'viewer-mode'
        );

        if (viewOnly) {
            body.querySelectorAll('[data-status]').forEach(select => {
                select.disabled = true;
            });

            body.querySelectorAll('[data-void], [data-delete-voided]').forEach(button => {
                button.style.display = 'none';
            });
        }
    }

    // ============================================================
    // VOID ORDER
    // ============================================================

    function openVoid(id) {
        const order = db.orders.find(item => item.id === id);

        if (!order || order.status === 'Voided') {
            return;
        }

        voidId = id;

        $('voidTitle').textContent = 'Void ' + id;

        $('voidStaff').value = '';
        $('voidReason').value = '';
        $('voidNote').value = '';

        modal(true, 'voidOverlay');
    }

    $('closeVoid').onclick = () => {
        modal(false, 'voidOverlay');
    };

    $('voidOverlay').onclick = event => {
        if (event.target === $('voidOverlay')) {
            modal(false, 'voidOverlay');
        }
    };

    $('confirmVoid').onclick = async () => {
        const staff = $('voidStaff').value.trim();
        const reason = $('voidReason').value;
        const note = $('voidNote').value.trim();

        if (!staff || !reason) {
            toast('Staff name and void reason are required.');
            return;
        }

        const order = db.orders.find(
            item => item.id === voidId
        );

        if (!order || order.status === 'Voided') {
            return;
        }

        const confirmed = confirm(
            `Void ${order.id} (${peso(order.total)})?\n\n` +
            'This transaction will remain in order history ' +
            'but will be excluded from sales.'
        );

        if (!confirmed) return;

        const button = $('confirmVoid');

        button.disabled = true;

        try {
            await window.cloud.voidOrder(
                order,
                staff,
                reason,
                note
            );

            modal(false, 'voidOverlay');

            toast('Order voided. Audit details retained.');

        } catch (error) {
            toast('Void failed: ' + error.message);

        } finally {
            button.disabled = false;
        }
    };

    // ============================================================
    // SALES SUMMARY
    // ============================================================

    function activeOrdersForDate(dateKey) {
        return db.orders.filter(order =>
            order.status !== 'Voided' && localDate(order.createdAt) === dateKey
        );
    }

    function renderSalesCalendar() {
        const grid = $('salesCalendar');
        if (!grid) return;

        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        $('calendarMonth').textContent = calendarMonth.toLocaleDateString('en-PH', {
            month: 'long', year: 'numeric'
        });

        const firstWeekday = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const selectedDate = $('reportDate').value || localDate(new Date());
        const today = localDate(new Date());
        const cells = [];

        for (let blank = 0; blank < firstWeekday; blank++) {
            cells.push('<div class="calendar-empty" aria-hidden="true"></div>');
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const orders = activeOrdersForDate(dateKey);
            const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
            const classes = [
                'calendar-day',
                dateKey === selectedDate ? 'selected' : '',
                dateKey === today ? 'today' : '',
                revenue > 0 ? 'has-sales' : ''
            ].filter(Boolean).join(' ');
            cells.push(`
                <button type="button" class="${classes}" data-calendar-date="${dateKey}" aria-pressed="${dateKey === selectedDate}">
                    <span class="calendar-day-number">${day}</span>
                    ${orders.length ? `<strong>${peso(revenue)}</strong><small>${orders.length} ${orders.length === 1 ? 'order' : 'orders'}</small>` : '<small class="no-sales">—</small>'}
                </button>
            `);
        }

        grid.innerHTML = cells.join('');
        grid.querySelectorAll('[data-calendar-date]').forEach(button => {
            button.onclick = () => {
                $('reportDate').value = button.dataset.calendarDate;
                renderReports();
            };
        });
    }

    function historicalItemRow(product = null) {
        const selected = product || db.menu[0];
        if (!selected) return '';
        const row = document.createElement('div');
        row.className = 'historical-item-row';
        row.innerHTML = `
            <label class="label">Drink
                <select class="historical-product">${db.menu.map(item => `<option value="${item.id}" ${item.id === selected.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select>
            </label>
            <label class="label">Size
                <select class="historical-size"><option value="small">Small</option><option value="big">Big</option></select>
            </label>
            <label class="label">Qty
                <input class="historical-qty" type="number" min="1" max="99" step="1" value="1" required>
            </label>
            <label class="label">Unit price (₱)
                <input class="historical-price" type="number" min="0" step="0.01" value="${Number(selected.small)}" required>
            </label>
            <button class="historical-remove" type="button" aria-label="Remove item">×</button>
        `;
        row.querySelector('.historical-product').onchange = event => {
            const productNow = db.menu.find(item => String(item.id) === event.target.value);
            const size = row.querySelector('.historical-size').value;
            row.querySelector('.historical-price').value = Number(productNow?.[size] || 0);
            updateHistoricalTotal();
        };
        row.querySelector('.historical-size').onchange = event => {
            const productNow = db.menu.find(item => String(item.id) === row.querySelector('.historical-product').value);
            row.querySelector('.historical-price').value = Number(productNow?.[event.target.value] || 0);
            updateHistoricalTotal();
        };
        row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateHistoricalTotal));
        row.querySelector('.historical-remove').onclick = () => {
            row.remove();
            updateHistoricalTotal();
        };
        $('historicalItems').append(row);
        updateHistoricalTotal();
    }

    function updateHistoricalTotal() {
        const total = [...document.querySelectorAll('.historical-item-row')].reduce((sum, row) => {
            const qty = Math.max(0, Number(row.querySelector('.historical-qty').value || 0));
            const price = Math.max(0, Number(row.querySelector('.historical-price').value || 0));
            return sum + qty * price;
        }, 0);
        if ($('historicalTotal')) $('historicalTotal').textContent = peso(total);
    }

    function resetHistoricalForm() {
        if (!$('historicalSaleForm')) return;
        $('historicalSaleForm').reset();
        $('historicalDate').value = localDate(new Date());
        $('historicalDate').max = localDate(new Date());
        $('historicalTime').value = '';
        $('historicalItems').innerHTML = '';
        historicalItemRow();
        $('historicalMessage').textContent = '';
    }

    function setupHistoricalSales() {
        if (!$('historicalSaleForm') || $('historicalSaleForm').dataset.ready) return;
        $('historicalSaleForm').dataset.ready = 'true';
        $('historicalDate').value = localDate(new Date());
        $('historicalDate').max = localDate(new Date());
        historicalItemRow();
        $('addHistoricalItem').onclick = () => historicalItemRow();
        $('historicalSaleForm').onsubmit = async event => {
            event.preventDefault();
            const date = $('historicalDate').value;
            if (!date) return;
            const rows = [...document.querySelectorAll('.historical-item-row')];
            if (!rows.length) {
                toast('Add at least one item.');
                return;
            }
            const button = $('saveHistoricalSale');
            button.disabled = true;
            $('historicalMessage').textContent = 'Saving previous sale…';
            try {
                const items = rows.map(row => {
                    const product = db.menu.find(item => String(item.id) === row.querySelector('.historical-product').value);
                    const size = row.querySelector('.historical-size').value;
                    const qty = Number(row.querySelector('.historical-qty').value);
                    const unit = Number(row.querySelector('.historical-price').value);
                    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99 || !Number.isFinite(unit) || unit < 0) {
                        throw new Error('Please check the drink, quantity, and unit price.');
                    }
                    return { name: product.name, productId: product.id, size: size === 'big' ? 'Big' : 'Small', qty, unit, total: unit * qty, addons: [], milk: '', note: '' };
                });
                if (date > localDate(new Date())) throw new Error('Previous sale date cannot be in the future.');
                const [year, month, day] = date.split('-').map(Number);
                const [hour, minute] = ($('historicalTime').value || '12:00').split(':').map(Number);
                const saleDate = new Date(year, month - 1, day, hour, minute, 0, 0);
                if (Number.isNaN(saleDate.getTime()) || localDate(saleDate) !== date) throw new Error('Please enter a valid sale date and time.');
                const now = new Date().toISOString();
                const total = items.reduce((sum, item) => sum + item.total, 0);
                const order = {
                    id: orderId(), createdAt: saleDate.toISOString(), recordedAt: now,
                    recordType: 'Historical', customer: $('historicalCustomer').value.trim() || 'Walk-in',
                    type: 'Historical sale', table: '', payment: $('historicalPayment').value,
                    items, total, status: 'Completed', createdBy: '',
                    events: [{ at: now, action: 'Previous sale manually recorded' }]
                };
                await window.cloud.saveHistoricalOrder(order);
                $('historicalMessage').textContent = 'Previous sale saved successfully.';
                toast('Previous sale recorded.');
                $('reportDate').value = date;
                calendarMonth = new Date(year, month - 1, 1);
                resetHistoricalForm();
                renderReports();
            } catch (error) {
                console.error('Historical sale save failed:', error);
                $('historicalMessage').textContent = 'Could not save: ' + error.message;
                toast('Previous sale not saved: ' + error.message);
            } finally {
                button.disabled = false;
            }
        };
    }

    $('calendarPrev').onclick = () => {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
        renderSalesCalendar();
    };
    $('calendarNext').onclick = () => {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
        renderSalesCalendar();
    };

    function renderReports() {
        const selectedDate =
            $('reportDate').value ||
            localDate(new Date());

        const [selectedYear, selectedMonth] = selectedDate.split('-').map(Number);
        if (selectedYear && selectedMonth && (calendarMonth.getFullYear() !== selectedYear || calendarMonth.getMonth() !== selectedMonth - 1)) {
            calendarMonth = new Date(selectedYear, selectedMonth - 1, 1);
        }
        renderSalesCalendar();
        setupHistoricalSales();
        const isOwner = document.body.dataset.role === 'owner';
        $('historicalSalesPanel').hidden = !isOwner;

        const activeOrders = db.orders.filter(
            order => order.status !== 'Voided'
        );

        const selectedOrders = activeOrders.filter(
            order => localDate(order.createdAt) === selectedDate
        );

        const selectedRevenue = selectedOrders.reduce(
            (total, order) => total + Number(order.total || 0),
            0
        );

        const allRevenue = activeOrders.reduce(
            (total, order) => total + Number(order.total || 0),
            0
        );

        const voidCount = db.orders.filter(
            order => order.status === 'Voided'
        ).length;

        $('todayRevenue').textContent = peso(selectedRevenue);
        $('todayCount').textContent = selectedOrders.length;
        $('todayTips').textContent = peso(selectedOrders.reduce(
            (sum, order) => sum + Number(order.tip || 0), 0
        ));

        $('allRevenue').textContent = peso(allRevenue);
        $('voidCount').textContent = voidCount;

        // Drink breakdown.
        const breakdown = {};

        selectedOrders.forEach(order => {
            (order.items || []).forEach(item => {
                const name = item.name;

                if (!breakdown[name]) {
                    breakdown[name] = {
                        qty: 0,
                        total: 0
                    };
                }

                breakdown[name].qty += Number(item.qty || 0);
                breakdown[name].total += Number(item.total || 0);
            });
        });

        const breakdownRows = Object.entries(breakdown).map(
            ([name, values]) => `
                <tr>
                    <td>${esc(name)}</td>
                    <td>${values.qty}</td>
                    <td>${peso(values.total)}</td>
                </tr>
            `
        ).join('');

        $('breakdown').innerHTML =
            breakdownRows ||
            emptyRow(3, 'No orders recorded for this date.');

        // Transactions for selected date.
        const dateRows = db.orders
            .filter(
                order =>
                    localDate(order.createdAt) === selectedDate
            )
            .map(order => `
                <tr>

                    <td>${esc(order.id)}</td>

                    <td>
                        ${new Date(order.createdAt)
                            .toLocaleTimeString('en-PH')}
                    </td>

                    <td>${esc(order.status)}</td>

                    <td>
                        ${peso(
                            order.status === 'Voided'
                                ? 0
                                : order.total
                        )}
                    </td>

                </tr>
            `)
            .join('');

        $('dateOrders').innerHTML =
            dateRows ||
            emptyRow(4, 'No transactions for this date.');
    }

    // ============================================================
    // OWNER SETTINGS — MENU PRICES
    // ============================================================

    function renderSettings() {
        $('priceBody').innerHTML = db.menu.map(product => `
            <tr>

                <td>${esc(product.name)}</td>

                <td>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        data-price="${product.id}:small"
                        value="${Number(product.small)}"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        data-price="${product.id}:big"
                        value="${Number(product.big)}"
                    >
                </td>

            </tr>
        `).join('');

        $('addonSettings').innerHTML = db.addons.map(addon => `
            <label class="label">

                ${esc(addon.name)} (₱)

                <input
                    type="number"
                    min="0"
                    step="0.01"
                    data-addon="${esc(addon.id)}"
                    value="${Number(addon.price)}"
                >

            </label>
        `).join('');

        const oatMilkInput = $('oatMilkPrice');

        if (oatMilkInput) {
            oatMilkInput.value = Number(db.oatMilkPrice ?? 20);
        }
    }

    // ============================================================
    // SAVE MENU TO FIREBASE
    // ============================================================

    $('saveSettings').onclick = async () => {
        const priceInputs = [
            ...document.querySelectorAll('[data-price]')
        ];

        const addonInputs = [
            ...document.querySelectorAll('[data-addon]')
        ];

        const oatMilkInput = $('oatMilkPrice');

        const allInputs = [
            ...priceInputs,
            ...addonInputs,
            ...(oatMilkInput ? [oatMilkInput] : [])
        ];

        const invalid = allInputs.some(input => {
            return (
                input.value.trim() === '' ||
                !Number.isFinite(Number(input.value)) ||
                Number(input.value) < 0
            );
        });

        if (invalid) {
            toast('Please enter valid non-negative prices.');
            return;
        }

        // Work on copies so failed Firebase saves don't
        // silently change the current menu.
        const updatedMenu = structuredClone(db.menu);
        const updatedAddons = structuredClone(db.addons);

        priceInputs.forEach(input => {
            const [id, size] = input.dataset.price.split(':');

            const product = updatedMenu.find(
                item => item.id === Number(id)
            );

            if (product) {
                product[size] = Number(input.value);
            }
        });

        addonInputs.forEach(input => {
            const addon = updatedAddons.find(
                item => item.id === input.dataset.addon
            );

            if (addon) {
                addon.price = Number(input.value);
            }
        });

        const button = $('saveSettings');

        button.disabled = true;

        try {
            const updatedOatMilkPrice = oatMilkInput
                ? Number(oatMilkInput.value)
                : Number(db.oatMilkPrice ?? 20);

            await window.cloud.saveMenu(
                updatedMenu,
                updatedAddons,
                updatedOatMilkPrice
            );

            db.menu = updatedMenu;
            db.addons = updatedAddons;
            db.oatMilkPrice = updatedOatMilkPrice;

            renderGrid();
            renderSettings();

            toast('Menu prices saved to Firebase!');

        } catch (error) {
            toast('Could not save prices: ' + error.message);

        } finally {
            button.disabled = false;
        }
    };

    // ============================================================
    // CSV EXPORT HELPER
    // ============================================================

    function downloadCSV(filename, rows) {
        const csv = '\ufeff' + rows.map(row => {
            return row.map(value => {
                let text = String(value ?? '');

                // Prevent spreadsheet formula injection.
                if (/^[=+\-@\t\r]/.test(text)) {
                    text = "'" + text;
                }

                return '"' + text.replaceAll('"', '""') + '"';
            }).join(',');
        }).join('\r\n');

        const blob = new Blob(
            [csv],
            {
                type: 'text/csv;charset=utf-8;'
            }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // ============================================================
    // EXPORT ORDER HISTORY
    // ============================================================

    $('exportOrders').onclick = () => {
        const headers = [
            'Order ID',
            'Date',
            'Customer',
            'Type',
            'Payment',
            'Discovery Source',
            'Tip',
            'Items',
            'Total',
            'Status',
            'Voided At',
            'Voided By',
            'Void Reason',
            'Void Note',
            'Audit Events'
        ];

        const rows = db.orders.map(order => [
            order.id,

            formatDate(order.createdAt),

            order.customer || '',
            order.type || '',
            order.payment || '',
            order.discoverySource || '',
            Number(order.tip || 0),

            (order.items || [])
                .map(item => {
                    const addons = (item.addons || [])
                        .map(addon => addon.name)
                        .join('+');

                    return (
                        `${item.qty}x ${item.name} ` +
                        `${item.size}` +
                        `${item.milk ? ' ' + item.milk : ''} ${addons}`
                    );
                })
                .join('; '),

            order.total,
            order.status,

            order.voidedAt || '',
            order.voidedBy || '',
            order.voidReason || '',
            order.voidNote || '',

            (order.events || [])
                .map(event => {
                    return `${event.at}: ${event.action}`;
                })
                .join('; ')
        ]);

        downloadCSV(
            'love-matchaa-orders.csv',
            [headers, ...rows]
        );
    };

    // ============================================================
    // EXPORT SALES
    // ============================================================

    $('exportSales').onclick = () => {
        const headers = [
            'Order ID',
            'Date',
            'Customer',
            'Status',
            'Amount',
            'Voided By',
            'Void Reason'
        ];

        const rows = db.orders.map(order => [
            order.id,

            formatDate(order.createdAt),

            order.customer || '',
            order.status,

            order.status === 'Voided'
                ? 0
                : order.total,

            order.voidedBy || '',
            order.voidReason || ''
        ]);

        downloadCSV(
            'love-matchaa-sales.csv',
            [headers, ...rows]
        );
    };

    // ============================================================
    // REPORT DATE
    // ============================================================

    $('reportDate').value = localDate(new Date());

    $('reportDate').addEventListener(
        'change',
        renderReports
    );

    // ============================================================
    // END-OF-DAY CSV
    // ============================================================

    $('endOfDay').onclick = () => {
        const day = $('reportDate').value;

        const orders = db.orders.filter(
            order => localDate(order.createdAt) === day
        );

        const headers = [
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
        ];

        const rows = orders.map(order => [
            order.id,

            formatDate(order.createdAt),

            order.customer || '',
            order.type || '',
            order.payment || '',

            (order.items || [])
                .map(item => {
                    return (
                        `${item.qty}x ${item.name} ` +
                        `(${item.size}${item.milk ? ', ' + item.milk : ''})`
                    );
                })
                .join('; '),

            order.status,
            order.total,

            order.status === 'Voided'
                ? 0
                : order.total,

            order.voidedBy || '',
            order.voidReason || ''
        ]);

        downloadCSV(
            `love-matchaa-end-of-day-${day}.csv`,
            [headers, ...rows]
        );
    };

    // ============================================================
    // AUTOMATIC DATE REFRESH
    // ============================================================

    let lastDay = localDate(new Date());

    setInterval(() => {
        const today = localDate(new Date());

        if (today !== lastDay) {
            if ($('reportDate').value === lastDay) {
                $('reportDate').value = today;
            }

            lastDay = today;

            renderReports();
        }
    }, 30000);

    // ============================================================
    // MERGE FIREBASE MENU WITH DEFAULT MENU
    // ============================================================

    function mergeMenu(savedMenu) {
        if (!Array.isArray(savedMenu)) {
            return structuredClone(DEFAULT_MENU);
        }

        const merged = DEFAULT_MENU.map(defaultDrink => {
            const savedDrink = savedMenu.find(drink => {
                return (
                    Number(drink.id) === defaultDrink.id ||
                    drink.name === defaultDrink.name
                );
            });

            if (!savedDrink) {
                return { ...defaultDrink };
            }

            return {
                ...defaultDrink,
                ...savedDrink,

                // Keep the correct ID and image path.
                id: defaultDrink.id,
                image: defaultDrink.image
            };
        });

        // Preserve any additional drinks that might already
        // have been added to Firebase in the future.
        const extraDrinks = savedMenu.filter(savedDrink => {
            return !DEFAULT_MENU.some(defaultDrink => {
                return (
                    Number(savedDrink.id) === defaultDrink.id ||
                    savedDrink.name === defaultDrink.name
                );
            });
        });

        return [
            ...merged,
            ...extraDrinks
        ];
    }

    // ============================================================
    // FIREBASE REAL-TIME UPDATES
    // ============================================================

    window.cloudRender = (orders, menuData) => {
        if (Array.isArray(orders)) {
            db.orders = orders;
        }

        if (menuData) {
            db.menu = mergeMenu(menuData.menu);

            db.addons = Array.isArray(menuData.addons)
                ? structuredClone(menuData.addons)
                : structuredClone(DEFAULT_ADDONS);

            db.oatMilkPrice = Number.isFinite(Number(menuData.oatMilkPrice))
                ? Number(menuData.oatMilkPrice)
                : 20;
        }

        renderGrid();
        renderOrders();
        renderReports();

        // Avoid overwriting prices while the owner is typing.
        if (currentPage !== 'settings') {
            renderSettings();
        }
    };

    // ============================================================
    // INITIALIZE APPLICATION
    // ============================================================

    renderGrid();
    renderCart();
    renderOrders();
    renderReports();
    renderSettings();

    // Signal that the POS interface is initialized.
    window.dispatchEvent(new Event('pos-ready'));

});
