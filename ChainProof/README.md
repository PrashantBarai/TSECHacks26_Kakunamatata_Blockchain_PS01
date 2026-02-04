# ChainProof - Secure Disclosure Network

A decentralized whistleblowing platform built on Hyperledger Fabric with pseudonymous identity, IPFS storage, and public blockchain anchoring.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (7000)                       │
│                  React + Vite + Web Crypto                   │
├─────────────────────────────────────────────────────────────┤
                    ↓                    ↓
        ┌───────────────────┐  ┌───────────────────┐
        │  Backend (4000)   │  │ Fabric Gateway    │
        │  - IPFS/Pinata    │  │     (5000)        │
        │  - Metadata Strip │  │  - Chaincode API  │
        │  - Sepolia Anchor │  │  - Multi-org      │
        │  - PDF Generator │  │  - fabric-gateway │
        │  - MongoDB        │  │    SDK            │
        └───────────────────┘  └───────────────────┘
                    ↓                    ↓
        ┌───────────────────┐  ┌───────────────────┐
        │  Sepolia Testnet  │  │   Microfab (7070) │
        │  - Hash anchoring │  │   - Chaincode     │
        │  - Public verify  │  │   - 3 Orgs        │
        └───────────────────┘  └───────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker
- Node.js 18+
- MongoDB
- Go 1.17+ (for chaincode)

### 1. Start Microfab
```bash
docker run --name microfab -p 7070:7070 \
  -e MICROFAB_CONFIG='{"endorsing_organizations":[{"name":"WhistleblowersOrg"},{"name":"VerifierOrg"},{"name":"LegalOrg"}],"channels":[{"name":"chainproof-channel","endorsing_organizations":["WhistleblowersOrg","VerifierOrg","LegalOrg"]}],"couchdb":true}' \
  ibmcom/ibp-microfab
```

### 2. Deploy Chaincode
```bash
./deploy_chaincode.sh deploy
```

### 3. Setup Fabric Gateway Wallet
```bash
cd fabric_gateway
./setup_wallet.sh
npm install
```

### 4. Start MongoDB
```bash
mongod --dbpath /path/to/data
```

### 5. Start All Services
```bash
# Terminal 1 - Fabric Gateway (port 5000)
cd fabric_gateway && npm run dev

# Terminal 2 - Backend (port 4000)
cd client_backend && npm run dev

# Terminal 3 - Frontend (port 7000)
cd frontend && npm run dev
```

### 6. Deploy Sepolia Contract
1. Open [Remix IDE](https://remix.ethereum.org)
2. Deploy `contracts/solidity/ChainProofAnchor.sol`
3. Add contract address to `client_backend/.env`

## 📁 Project Structure

```
ChainProof/
├── contracts/
│   ├── chainproof/          # Hyperledger Fabric chaincode
│   └── solidity/            # Sepolia smart contract
├── fabric_gateway/          # Fabric Gateway Service (PORT 5000)
│   ├── src/
│   │   ├── services/fabric.js   # fabric-gateway SDK
│   │   └── routes/chaincode.js  # REST API
│   └── setup_wallet.sh      # Extract Microfab identities
├── client_backend/          # Backend Service (PORT 4000)
│   ├── src/
│   │   ├── services/        # IPFS, metadata, PDF, Sepolia
│   │   ├── models/          # MongoDB models
│   │   └── routes/          # API endpoints
│   └── .env
├── frontend/                # React Frontend (PORT 7000)
│   └── src/
│       ├── services/api.js  # Calls both Backend + Fabric Gateway
│       └── pages/
└── deploy_chaincode.sh
```

## 🔐 API Endpoints

### Fabric Gateway (5000)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fabric/evidence/submit` | POST | Submit to blockchain |
| `/api/fabric/evidence/:id` | GET | Get from blockchain |
| `/api/fabric/notifications/:hash` | GET | Get notifications |
| `/api/fabric/reputation/:hash` | GET | Get reputation |
| `/api/fabric/verify/:id` | POST | Verify integrity |
| `/api/fabric/legal/:id/review` | POST | Legal review |

### Backend (4000)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/evidence/submit` | POST | Upload + IPFS + Sepolia |
| `/api/legal/export` | POST | Generate PDF |

## 📝 Environment Variables

### fabric_gateway/.env
```env
PORT=5000
FABRIC_CHANNEL=chainproof-channel
FABRIC_CHAINCODE=chainproof
DEFAULT_ORG=WhistleblowersOrg
```

### client_backend/.env
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/chainproof
FABRIC_GATEWAY_URL=http://localhost:5000
PINATA_API_KEY=...
SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

### frontend/.env
```env
VITE_API_URL=http://localhost:4000
VITE_FABRIC_URL=http://localhost:5000
```

## 📄 License

MIT
