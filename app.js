// app.js - shared client-side code for ordering
function initOrdering(MENU){
  const order = [];
  const orderItemsEl = document.getElementById('order-items');
  const orderTotalEl = document.getElementById('order-total');
  const placeBtn = document.getElementById('place-order');
  const msgEl = document.getElementById('order-msg');

  // expose addToOrder globally so menu script can call it
  window.addToOrderFunction = (id, qty) => {
    const existing = order.find(x => x.id === id);
    if (existing) existing.qty += qty;
    else order.push({ id, qty });
    renderOrder();
  };

  function renderOrder() {
    if (!orderItemsEl) return;
    orderItemsEl.innerHTML = '';
    let total = 0;
    order.forEach((it, idx) => {
      const m = MENU.find(x => x.id === it.id);
      const row = document.createElement('div');
      row.className = 'card';
      row.innerHTML = `
        <div style="flex:1"><strong>${m.name}</strong> × ${it.qty} — ₹${m.price * it.qty}</div>
        <button class="qty-btn" data-idx="${idx}" style="background:#ffebee;color:#c62828;border:1px solid #ef5350;width:28px;height:28px;padding:0;cursor:pointer;border-radius:4px">✕</button>
      `;
      row.querySelector('button').addEventListener('click', () => {
        order.splice(idx, 1);
        renderOrder();
      });
      orderItemsEl.appendChild(row);
      total += m.price * it.qty;
    });
    if (order.length === 0) orderItemsEl.innerHTML = '<p style="color:var(--muted);text-align:center;margin:0">No items added yet</p>';
    if (orderTotalEl) orderTotalEl.textContent = total;
  }

  if (placeBtn) {
    placeBtn.addEventListener('click', async () => {
      if (order.length === 0) return showOrderMsg('Add items first', 'error');
      
      const name = prompt('📝 Your name:');
      if (!name) return;
      const email = prompt('📧 Email address:');
      if (!email) return;
      const phone = prompt('📞 Phone number:');
      if (!phone) return;
      
      let total = 0;
      order.forEach(it => {
        const m = MENU.find(x => x.id === it.id);
        total += m.price * it.qty;
      });

      const payMethodEl = document.getElementById('payment-method');
      const cardNameEl = document.getElementById('card-name');
      const paymentMethod = payMethodEl ? payMethodEl.value : 'pay_on_delivery';
      const cardName = cardNameEl ? cardNameEl.value.trim() : '';

      placeBtn.disabled = true;
      placeBtn.textContent = '⏳ Placing order...';

      try {
        const resp = await fetch('/api/orders', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ customer: { name, email, phone }, items: order, total })
        });

        // Be defensive: the server should return JSON, but if it returns
        // an empty body or non-JSON (HTML/error page) parsing will fail.
        const raw = await resp.text();
        let json = null;
        if (raw) {
          try {
            json = JSON.parse(raw);
          } catch (e) {
            console.error('Invalid JSON from /api/orders:', raw);
            throw new Error(`Invalid JSON response from server (status ${resp.status})`);
          }
        }
        if (!json) {
          if (!resp.ok) throw new Error(`Server returned status ${resp.status} with empty body`);
          throw new Error('Empty response from server');
        }
        if (json.error) throw new Error(json.error);
        const orderId = json.orderId;

        if (paymentMethod === 'card') {
          const payResp = await fetch('/api/payments', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ orderId, amount: total, method: 'card', details: { cardName } })
          });
          const payRaw = await payResp.text();
          let payJson = null;
          if (payRaw) {
            try {
              payJson = JSON.parse(payRaw);
            } catch (e) {
              console.error('Invalid JSON from /api/payments:', payRaw);
              throw new Error(`Invalid JSON response from payments (status ${payResp.status})`);
            }
          }
          if (!payJson) {
            if (!payResp.ok) throw new Error(`Payment endpoint returned status ${payResp.status} with empty body`);
            throw new Error('Empty payment response from server');
          }
          if (payJson.error) throw new Error('Payment failed: ' + payJson.error);
          showOrderMsg(`✓ Order placed and PAID!\nOrder ID: ${orderId}\nPayment ID: ${payJson.paymentId}`, 'success');
        } else {
          showOrderMsg(`✓ Order placed!\nOrder ID: ${orderId}\n(Pay on delivery)`, 'success');
        }
        order.length = 0;
        renderOrder();
      } catch (err) {
        showOrderMsg('✗ Error: ' + err.message, 'error');
      } finally {
        placeBtn.disabled = false;
        placeBtn.textContent = 'Place Order';
      }
    });
  }

  function showOrderMsg(txt, type = 'info') {
    if (msgEl) {
      msgEl.textContent = txt;
      msgEl.className = 'order-message ' + type;
    }
  }

  renderOrder();
}
