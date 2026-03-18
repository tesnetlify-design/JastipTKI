import { Transaction } from '../types';
import { AppConfig } from '../types';

// ─── Generate & Print Invoice PDF ───────────────────────────────────────────
export const downloadInvoicePDF = (transaction: Transaction, appConfig?: Partial<AppConfig>) => {
  const orderNumber = (transaction as any).orderNumber || transaction.id;
  const hubName = appConfig?.hubName || 'JastipTKI Hub';
  const hubAddress = appConfig?.hubAddress || 'Indonesia';
  const hubPhone = appConfig?.hubPhone || '';
  const adminWhatsApp = appConfig?.adminWhatsApp || '';

  const isBelanja = transaction.type === 'BELANJA';
  const baseAmount = (transaction.amount || 0) - (transaction.shippingCost || 0) - (transaction.serviceFee || 0);

  const formatRp = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

  const statusLabel: Record<string, string> = {
    PENDING: 'Menunggu Verifikasi',
    PROCESSING: 'Sedang Diproses',
    SHIPPING: 'Dalam Pengiriman',
    DELIVERED: 'Terkirim',
  };

  const itemRows = isBelanja && transaction.items
    ? transaction.items.map((item, i) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-size: 12px; color: #475569;">${i + 1}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #1e293b; font-weight: 600;">${item.name}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #475569; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #1e293b; text-align: right;">${formatRp(item.price)}</td>
          <td style="padding: 10px 8px; font-size: 12px; color: #1e293b; text-align: right; font-weight: 700;">${formatRp(item.price * item.quantity)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="padding: 10px 8px; font-size: 12px; color: #475569; text-align: center;">Layanan Jastip (Titip Beli / Kirim)</td></tr>`;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; }
    .page { max-width: 720px; margin: 0 auto; padding: 40px 36px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; flex-shrink: 0; }
    .brand-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .brand-name { font-size: 22px; font-weight: 900; color: #1e293b; }
    .brand-tagline { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 28px; font-weight: 900; color: #2563eb; letter-spacing: -1px; }
    .invoice-title p { font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 4px; }
    .status-badge { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .status-DELIVERED { background: #dcfce7; color: #16a34a; }
    .status-SHIPPING { background: #dbeafe; color: #2563eb; }
    .status-PROCESSING { background: #fef3c7; color: #d97706; }
    .status-PENDING { background: #f1f5f9; color: #64748b; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .info-box { background: #f8fafc; border-radius: 16px; padding: 18px 20px; }
    .info-box h4 { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
    .info-box p { font-size: 12px; color: #1e293b; font-weight: 600; line-height: 1.8; }
    .info-box .highlight { font-size: 16px; font-weight: 900; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead tr { background: #1e293b; }
    thead th { padding: 12px 8px; font-size: 9px; font-weight: 800; color: white; text-transform: uppercase; letter-spacing: 1.5px; text-align: left; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    thead th:nth-child(3) { text-align: center; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .totals { margin-left: auto; width: 300px; margin-bottom: 28px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .total-row.grand { padding: 14px 0 0 0; border-top: 2px solid #2563eb; border-bottom: none; margin-top: 8px; }
    .total-row span { font-size: 12px; font-weight: 600; color: #475569; }
    .total-row .amount { font-weight: 700; color: #1e293b; }
    .total-row.grand span { font-size: 14px; font-weight: 900; color: #2563eb; }
    .footer { border-top: 2px solid #e2e8f0; padding-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-note { font-size: 10px; color: #94a3b8; line-height: 1.8; }
    .footer-hub { text-align: right; font-size: 10px; color: #64748b; line-height: 1.8; }
    .qr-placeholder { width: 64px; height: 64px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 8px; }
    .print-btn { position: fixed; bottom: 28px; right: 28px; padding: 14px 24px; background: #2563eb; color: white; border: none; border-radius: 16px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 24px rgba(37,99,235,0.3); display: flex; align-items: center; gap-8px; }
  </style>
</head>
<body>
  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div class="brand">
        <div class="brand-icon"><img src="data:image/png;base64,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" alt="JastipTKI" /></div>
        <div>
          <div class="brand-name">JastipTKI</div>
          <div class="brand-tagline">Layanan Titip Beli Internasional</div>
        </div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <p>${orderNumber}</p>
        <span class="status-badge status-${transaction.status || 'PENDING'}">
          ${statusLabel[transaction.status] || transaction.status}
        </span>
      </div>
    </div>

    <!-- INFO GRID -->
    <div class="info-grid">
      <div class="info-box">
        <h4>Detail Transaksi</h4>
        <p>
          <span class="highlight">${orderNumber}</span><br/>
          Tanggal: ${new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
          Jenis: ${isBelanja ? 'Beli Titipan' : 'Kirim Jastip'}<br/>
          Tujuan: ${transaction.destination}
        </p>
      </div>
      <div class="info-box">
        <h4>Ditagihkan kepada</h4>
        <p>
          <span class="highlight">Pelanggan JastipTKI</span><br/>
          ID: ${transaction.userId?.slice(0, 10).toUpperCase() || '—'}<br/>
          Pesanan dibuat: ${new Date(transaction.date).toLocaleDateString('id-ID')}<br/>
          ${(transaction as any).details?.paymentMethod ? `Bayar via: ${(transaction as any).details.paymentMethod}` : ''}
        </p>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
      <thead>
        <tr>
          <th style="width: 32px;">#</th>
          <th>Deskripsi</th>
          <th style="width: 50px; text-align: center;">Qty</th>
          <th style="width: 120px; text-align: right;">Harga Satuan</th>
          <th style="width: 120px; text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div class="totals">
      <div class="total-row">
        <span>${isBelanja ? 'Total Harga Barang' : 'Biaya Layanan'}</span>
        <span class="amount">${formatRp(baseAmount)}</span>
      </div>
      ${transaction.shippingCost !== undefined ? `
      <div class="total-row">
        <span>Ongkos Kirim</span>
        <span class="amount">${formatRp(transaction.shippingCost)}</span>
      </div>` : ''}
      ${transaction.serviceFee ? `
      <div class="total-row">
        <span>Biaya Layanan</span>
        <span class="amount">${formatRp(transaction.serviceFee)}</span>
      </div>` : ''}
      ${(transaction as any).details?.voucherDiscount ? `
      <div class="total-row">
        <span>Diskon Voucher</span>
        <span class="amount" style="color: #16a34a;">- ${formatRp((transaction as any).details.voucherDiscount)}</span>
      </div>` : ''}
      <div class="total-row grand">
        <span>Total Bayar</span>
        <span>${formatRp(transaction.amount)}</span>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div>
        <div class="qr-placeholder">
          ORDER<br/>${orderNumber.slice(-6)}
        </div>
        <div class="footer-note">
          Terima kasih telah menggunakan JastipTKI.<br/>
          Dokumen ini adalah bukti transaksi yang sah.<br/>
          Simpan invoice ini sebagai referensi pesanan Anda.
        </div>
      </div>
      <div class="footer-hub">
        <strong style="font-size: 11px; color: #1e293b;">${hubName}</strong><br/>
        ${hubAddress}<br/>
        ${hubPhone ? `Tel: ${hubPhone}` : ''}<br/>
        ${adminWhatsApp ? `WA: +${adminWhatsApp}` : ''}
      </div>
    </div>

  </div>

  <!-- Print Button (tidak ikut print) -->
  <button class="no-print print-btn" onclick="window.print(); return false;" style="position:fixed;bottom:24px;right:24px;padding:14px 28px;background:#2563eb;color:white;border:none;border-radius:16px;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(37,99,235,0.3);">
    🖨️ Print / Simpan PDF
  </button>
  <script>
    // Auto trigger print dialog after 300ms
    setTimeout(() => { window.print(); }, 300);
  </script>
</body>
</html>
  `;

  // Buka di tab baru dan print
  const win = window.open('', '_blank', 'width=800,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Popup diblokir oleh browser. Izinkan popup untuk halaman ini agar invoice bisa diunduh.');
  }
};
