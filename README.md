# WhatsApp Analytics Application

Aplikasi analisis data WhatsApp yang terintegrasi dengan WAHA (WhatsApp HTTP API) dan menggunakan AI dari Anthropic untuk segmentasi pelanggan otomatis.

## Fitur Utama

- 📱 **Integrasi WAHA**: Menerima data WhatsApp real-time melalui webhook
- 🗄️ **PostgreSQL Database**: Penyimpanan data terstruktur dengan performa tinggi
- 🤖 **AI-Powered Segmentation**: Segmentasi pelanggan otomatis menggunakan Anthropic Claude
- 🐳 **Dockerized**: Deployment yang mudah dengan Docker Compose
- 📊 **Analytics Ready**: Database schema yang optimized untuk analisis
- 🔍 **Monitoring**: Logging komprehensif dan health checks

## Arsitektur Sistem

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │───▶│      WAHA       │───▶│   Analytics     │
│   Messages      │    │   (Gateway)     │    │      App        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                               ┌───────▼───────┐
                                               │  PostgreSQL   │
                                               │   Database    │
                                               └───────────────┘
                                                       │
                                               ┌───────▼───────┐
                                               │   Anthropic   │
                                               │  Claude API   │
                                               └───────────────┘
```

## Teknologi yang Digunakan

- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL 15
- **ORM**: node-postgres (pg)
- **Validation**: Zod
- **Logging**: Winston
- **Containerization**: Docker & Docker Compose
- **AI/LLM**: Anthropic Claude API

## Quick Start

### Prerequisites

- Docker dan Docker Compose terinstall
- Anthropic API Key

### Langkah 1: Clone dan Setup

```bash
git clone <repository-url>
cd whatsapp-analytics-app
```

### Langkah 2: Konfigurasi Environment

```bash
cp .env.example .env
```

Edit file `.env` dan isi variabel berikut:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Langkah 3: Jalankan Aplikasi

```bash
docker-compose up --build
```

Perintah ini akan:
- Membangun image aplikasi
- Menjalankan PostgreSQL database
- Menjalankan WAHA gateway
- Menjalankan aplikasi analytics

### Langkah 4: Verifikasi

Setelah semua container berjalan, Anda dapat mengakses:

- **Analytics App**: http://localhost:4000
- **WAHA Gateway**: http://localhost:3000
- **Health Check**: http://localhost:4000/api/health

## Endpoints API

### Webhook
- `POST /api/webhook` - Menerima webhook dari WAHA

### Health & Monitoring
- `GET /api/health` - Health check aplikasi
- `GET /api/segmentation/stats` - Statistik segmentasi pelanggan

### Segmentasi
- `POST /api/segmentation/customer/:customerId` - Segmentasi manual pelanggan

## Database Schema

### Tables

1. **customers**: Data pelanggan dan metadata
2. **chat_sessions**: Sesi percakapan dengan pelanggan
3. **messages**: Pesan individual dari percakapan

### Segmen Pelanggan

Aplikasi mengkategorikan pelanggan ke dalam 7 segmen:

1. **VIP_CUSTOMER** - Pelanggan high-value dengan loyalitas tinggi
2. **REGULAR_CUSTOMER** - Pelanggan dengan pola interaksi normal
3. **POTENTIAL_CUSTOMER** - Prospek yang menunjukkan minat
4. **SUPPORT_SEEKER** - Fokus pada bantuan dan dukungan
5. **PRICE_SENSITIVE** - Sangat memperhatikan harga
6. **INACTIVE_CUSTOMER** - Pelanggan yang jarang berinteraksi
7. **NEW_CUSTOMER** - Pelanggan baru

## Konfigurasi WAHA

Untuk menghubungkan WhatsApp dengan sistem:

1. Akses WAHA di http://localhost:3000
2. Buat session baru
3. Scan QR code dengan WhatsApp Anda
4. Webhook akan otomatis dikonfigurasi ke aplikasi analytics

## Development

### Local Development

```bash
# Install dependencies
npm install

# Setup database (jika belum menggunakan Docker)
createdb whatsapp_analytics
psql whatsapp_analytics < init.sql

# Run in development mode
npm run dev
```

### Build Production

```bash
npm run build
npm start
```

## Monitoring dan Logging

Aplikasi menggunakan Winston untuk logging dengan level:
- **error**: Error yang memerlukan perhatian
- **warn**: Peringatan yang perlu dimonitor
- **info**: Informasi umum operasional
- **debug**: Detail untuk debugging

Log disimpan di:
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs
- Console (development mode)

## Troubleshooting

### Database Connection Issues
```bash
# Check database logs
docker-compose logs db

# Check database health
curl http://localhost:4000/api/health
```

### WAHA Connection Issues
```bash
# Check WAHA logs
docker-compose logs waha

# Verify WAHA is running
curl http://localhost:3000
```

### Application Logs
```bash
# Check application logs
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app
```

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes dengan test coverage
4. Submit pull request

## License

MIT License - lihat file LICENSE untuk detail.

## Support

Untuk pertanyaan dan dukungan, silakan buka issue di repository ini.