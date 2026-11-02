import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, onSnapshot, getDocs } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const cfg = window.FIREBASE_CONFIG;
const error = document.getElementById('loginError');

if (!cfg || !cfg.apiKey || cfg.apiKey.includes('PASTE')) {
  error.textContent = 'Firebase setup needed. Follow SETUP.md before using V5.';
  throw new Error('Firebase config missing');
}

const app = initializeApp(cfg);
const auth = getAuth(app);
const store = getFirestore(app);

let currentUser = null;
let role = null;
let profile = null;
let unsubs = [];
let ready = false;
let mode = 'view';

const $ = id => document.getElementById(id);

function authorized() {
  return currentUser && profile?.active === true;
}

function canManage() {
  return authorized() &&
    (role === 'owner' || role === 'staff') &&
    mode === 'manage';
}

function requireManage() {
  if (!canManage()) {
    throw new Error('Not authorized to manage orders');
  }
}

function requireOwner() {
  if (!authorized() || role !== 'owner') {
    throw new Error('Owner access required');
  }
}

function setMode(m) {
  mode = (m === 'manage' && ['staff', 'owner'].includes(role))
    ? 'manage'
    : 'view';

  document.body.classList.toggle('viewer-mode', mode === 'view');
  document.body.classList.toggle('staff-mode', role === 'staff');

  document.querySelectorAll('[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  document.querySelectorAll('[data-page]').forEach(b => {
    if (
      (mode === 'view' && ['pos', 'settings'].includes(b.dataset.page)) ||
      (role !== 'owner' && b.dataset.page === 'settings')
    ) {
      b.style.display = 'none';
    } else {
      b.style.display = '';
    }
  });

  if (window.cloudNavigate) {
    window.cloudNavigate(mode === 'view' ? 'orders' : 'pos');
  } else {
    document.querySelector(
      `[data-page="${mode === 'view' ? 'orders' : 'pos'}"]`
    )?.click();
  }
}

window.cloud = {
  async saveOrder(o) {
    requireManage();

    o.createdBy = currentUser.uid;

    await setDoc(doc(store, 'orders', o.id), o);
  },

  async updateStatus(o, status) {
    requireManage();

    if (!['Pending', 'Preparing', 'Ready', 'Completed'].includes(status)) {
      throw new Error('Invalid status');
    }

    await updateDoc(doc(store, 'orders', o.id), {
      status,
      events: [
        ...(o.events || []),
        {
          at: new Date().toISOString(),
          action: `Status: ${o.status} → ${status}`,
          uid: currentUser.uid
        }
      ]
    });
  },

  async voidOrder(o, staff, reason, note) {
    requireOwner();

    const at = new Date().toISOString();

    await updateDoc(doc(store, 'orders', o.id), {
      status: 'Voided',
      voidedBy: staff,
      voidReason: reason,
      voidNote: note,
      voidedAt: at,
      voidedUid: currentUser.uid,
      events: [
        ...(o.events || []),
        {
          at,
          action: `Voided by ${staff}: ${reason}`,
          uid: currentUser.uid
        }
      ]
    });
  },

  async saveMenu(menu, addons) {
    requireOwner();

    await setDoc(doc(store, 'config', 'menu'), {
      menu,
      addons
    });
  }
};

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  error.textContent = 'Signing in…';

  try {
    await signInWithEmailAndPassword(
      auth,
      $('loginEmail').value.trim(),
      $('loginPassword').value
    );

    error.textContent = '';
    $('loginPassword').value = '';
  } catch (e) {
    console.error('Sign-in error:', e);
    error.textContent =
      'Sign in failed. Check your email, password, or account access.';
  }
});

$('signOut').onclick = () => signOut(auth);

document.querySelectorAll('[data-mode]').forEach(b => {
  b.onclick = () => setMode(b.dataset.mode);
});

const staffList = $('staffList');

async function refreshStaff() {
  requireOwner();

  const s = await getDocs(collection(store, 'users'));

  staffList.innerHTML = '';

  s.forEach(d => {
    const u = d.data();

    const div = document.createElement('div');
    div.className = 'staff-entry';

    const span = document.createElement('span');

    span.textContent =
      `${u.email || d.id} · ${u.role} · ${u.active ? 'Active' : 'Disabled'}`;

    const btn = document.createElement('button');

    btn.textContent = u.active
      ? 'Disable access'
      : 'Enable access';

    btn.disabled = d.id === currentUser.uid;

    btn.onclick = async () => {
      if (!confirm(
        `${u.active ? 'Disable' : 'Enable'} ${u.email}?`
      )) {
        return;
      }

      try {
        await updateDoc(doc(store, 'users', d.id), {
          active: !u.active
        });

        await refreshStaff();
      } catch (e) {
        $('staffMessage').textContent = e.message;
      }
    };

    div.append(span, btn);
    staffList.append(div);
  });
}

$('importLocal').onclick = async () => {
  try {
    requireOwner();

    const local = JSON.parse(
      localStorage.getItem('love_matchaa_order_desk_v3') || 'null'
    );

    const orders = local?.orders || [];

    if (!orders.length) {
      $('importMessage').textContent =
        'No V4 orders found in this browser.';
      return;
    }

    if (!confirm(
      `Import ${orders.length} local orders into the shared database? Existing IDs will be skipped.`
    )) {
      return;
    }

    let added = 0;
    let skipped = 0;

    for (const o of orders) {
      const ref = doc(store, 'orders', o.id);

      if ((await getDoc(ref)).exists()) {
        skipped++;
        continue;
      }

      await setDoc(ref, {
        ...o,
        createdBy: currentUser.uid,
        importedBy: currentUser.uid
      });

      added++;
    }

    $('importMessage').textContent =
      `Imported ${added} orders; skipped ${skipped} duplicates. Keep a separate backup.`;
  } catch (e) {
    $('importMessage').textContent =
      'Import stopped: ' + e.message;
  }
};

$('staffForm').onsubmit = async e => {
  e.preventDefault();

  try {
    requireOwner();

    const email = $('staffEmail').value.trim();
    const password = $('staffPassword').value;
    const role = $('staffRole').value;

    if (!confirm(`Create ${role} account for ${email}?`)) {
      return;
    }

    const secondary = initializeApp(
      cfg,
      'account-creator-' + Date.now()
    );

    try {
      const secondAuth = getAuth(secondary);

      const credential = await createUserWithEmailAndPassword(
        secondAuth,
        email,
        password
      );

      await setDoc(
        doc(store, 'users', credential.user.uid),
        {
          email,
          role,
          active: true,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.uid
        }
      );

      await signOut(secondAuth);

      $('staffForm').reset();

      $('staffMessage').textContent =
        'Account created. Share credentials privately and ask user to change password through Firebase Authentication support workflow.';
    } finally {
      await deleteApp(secondary);
    }

    await refreshStaff();
  } catch (e) {
    $('staffMessage').textContent =
      'Could not create account: ' + e.message;
  }
};

function reset() {
  unsubs.forEach(f => f());
  unsubs = [];

  currentUser = null;
  role = null;
  profile = null;

  $('appShell').hidden = true;
  $('loginGate').hidden = false;

  document.body.classList.remove('viewer-mode', 'staff-mode');

  $('staffPanel').hidden = true;
  $('migrationPanel').hidden = true;
}

onAuthStateChanged(auth, async user => {
  reset();

  if (!user) {
    return;
  }

  try {
    const snap = await getDoc(doc(store, 'users', user.uid));
    const data = snap.data();

    if (
      !snap.exists() ||
      !data.active ||
      !['owner', 'staff', 'viewer'].includes(data.role)
    ) {
      error.textContent =
        'This account is not approved or has been disabled.';

      await signOut(auth);
      return;
    }

    currentUser = user;
    profile = data;
    role = data.role;

    $('sessionIdentity').textContent =
      `${data.email || user.email} · ${role}`;

    $('loginGate').hidden = true;
    $('appShell').hidden = false;

    $('staffPanel').hidden = role !== 'owner';
    $('migrationPanel').hidden = role !== 'owner';

    if (!ready) {
      window.dispatchEvent(new Event('cloud-ready'));
      ready = true;
    }

    setMode(role === 'viewer' ? 'view' : 'manage');

    const ordersQ = query(
      collection(store, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );

    unsubs.push(
      onSnapshot(
        ordersQ,
        s => {
          window.cloudOrders = s.docs.map(x => x.data());

          window.cloudRender?.(window.cloudOrders, null);
        },
        e => {
          error.textContent =
            'Orders subscription error: ' + e.message;

          alert('Could not load orders: ' + e.message);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        doc(store, 'config', 'menu'),
        s => {
          if (
            s.exists() &&
            Array.isArray(s.data().menu) &&
            Array.isArray(s.data().addons)
          ) {
            window.cloudRender?.(
              window.cloudOrders || [],
              s.data()
            );
          }
        },
        e => console.error(e)
      )
    );

    if (role === 'owner') {
      await refreshStaff();
    }

    // Check revoked/disabled access in real time.
    // Database rules are the actual enforcement.
    unsubs.push(
      onSnapshot(
        doc(store, 'users', user.uid),
        s => {
          if (
            !s.exists() ||
            !s.data().active ||
            s.data().role !== role
          ) {
            alert(
              'Account permissions changed. Please sign in again.'
            );

            signOut(auth);
          }
        }
      )
    );
  } catch (e) {
    console.error('Could not load Firebase account:', e);

    error.textContent =
      'Could not load account: ' + e.message;

    await signOut(auth);
  }
});
