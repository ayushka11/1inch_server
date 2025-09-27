# Limit Order Server API Documentation

A REST API server for creating and managing 1inch limit orders on Ethereum mainnet.

## Base URL
```
http://localhost:3000
```

## Authentication
No authentication required for this local server.

## Content Type
All POST requests must include:
```
Content-Type: application/json
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the server is running.

#### Request
```http
GET /health
```

#### Response
```json
{
  "status": "OK",
  "timestamp": "2024-09-27T10:30:45.123Z"
}
```

---

### 2. Get Available Tokens

**GET** `/tokens`

Retrieve all supported tokens with their contract addresses and details.

#### Request
```http
GET /tokens
```

#### Response
```json
{
  "success": true,
  "tokens": {
    "WETH": {
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "symbol": "WETH",
      "decimals": 18,
      "name": "Wrapped Ether"
    },
    "USDC": {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "decimals": 6,
      "name": "USD Coin"
    },
    "USDT": {
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "symbol": "USDT",
      "decimals": 6,
      "name": "Tether USD"
    },
    "DAI": {
      "address": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      "symbol": "DAI",
      "decimals": 18,
      "name": "Dai Stablecoin"
    },
    "UNI": {
      "address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "symbol": "UNI",
      "decimals": 18,
      "name": "Uniswap"
    },
    "LINK": {
      "address": "0x514910771AF9Ca656af840dff83E8264EcF986CA",
      "symbol": "LINK",
      "decimals": 18,
      "name": "ChainLink Token"
    }
  },
  "symbols": ["WETH", "USDC", "USDT", "DAI", "UNI", "LINK"]
}
```

---

### 3. Get Token Balance

**GET** `/balance/:tokenSymbol`

Get the balance of a specific token for the configured wallet.

#### Request
```http
GET /balance/WETH
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenSymbol` | string | Yes | Token symbol (WETH, USDC, USDT, DAI, UNI, LINK) |

#### Success Response
```json
{
  "success": true,
  "tokenSymbol": "WETH",
  "balance": "0.576664355537832",
  "tokenInfo": {
    "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "symbol": "WETH",
    "decimals": 18,
    "name": "Wrapped Ether"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Token symbol is required"
}
```

---

### 4. Get All Balances

**GET** `/balances`

Get balances for all supported tokens.

#### Request
```http
GET /balances
```

#### Response
```json
{
  "success": true,
  "balances": {
    "WETH": {
      "balance": "0.576664355537832",
      "tokenInfo": {
        "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "symbol": "WETH",
        "decimals": 18,
        "name": "Wrapped Ether"
      }
    },
    "USDC": {
      "balance": "1250.50",
      "tokenInfo": {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "symbol": "USDC",
        "decimals": 6,
        "name": "USD Coin"
      }
    }
  }
}
```

---

### 5. Order Preview

**POST** `/order/preview`

Preview a limit order without creating it. Shows exchange rate and order details.

#### Request
```http
POST /order/preview
Content-Type: application/json

{
  "makerTokenSymbol": "WETH",
  "takerTokenSymbol": "USDC",
  "makingAmount": "0.1",
  "takingAmount": "265"
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `makerTokenSymbol` | string | Yes | Token you want to sell |
| `takerTokenSymbol` | string | Yes | Token you want to buy |
| `makingAmount` | string | Yes | Amount of maker token to sell |
| `takingAmount` | string | Yes | Amount of taker token to receive |

#### Success Response
```json
{
  "success": true,
  "preview": {
    "selling": "0.1 WETH",
    "buying": "265 USDC",
    "rate": "2650.000000 USDC per WETH",
    "makerToken": {
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "symbol": "WETH",
      "decimals": 18,
      "name": "Wrapped Ether"
    },
    "takerToken": {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "decimals": 6,
      "name": "USD Coin"
    },
    "isPublicOrder": true,
    "expires": "Never"
  }
}
```

#### Error Responses
```json
{
  "success": false,
  "error": "Missing required parameters"
}
```

```json
{
  "success": false,
  "error": "Invalid token symbols"
}
```

---

### 6. Create Limit Order

**POST** `/order`

Create and submit a limit order to the 1inch protocol.

#### Request
```http
POST /order
Content-Type: application/json

{
  "makerTokenSymbol": "WETH",
  "takerTokenSymbol": "USDC",
  "makingAmount": "0.1",
  "takingAmount": "265"
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `makerTokenSymbol` | string | Yes | Token you want to sell |
| `takerTokenSymbol` | string | Yes | Token you want to buy |
| `makingAmount` | string | Yes | Amount of maker token to sell |
| `takingAmount` | string | Yes | Amount of taker token to receive |

#### Success Response
```json
{
  "success": true,
  "message": "Order created successfully",
  "orderHash": "0xa2fd1e8a36e3dc554054cd1c1af0d8900aa9024875f6ced1362e88ac39dee716",
  "signature": "0x1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef01",
  "filename": "public_order_WETH_to_USDC_1695825600000.json",
  "method": "SDK",
  "apiSubmitted": true
}
```

#### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `orderHash` | string | Unique identifier for the order |
| `signature` | string | Cryptographic signature of the order |
| `filename` | string | Local file where order details are saved |
| `method` | string | Creation method used ("SDK" or "Manual") |
| `apiSubmitted` | boolean | Whether order was submitted to 1inch API |

#### Error Responses

**Missing Parameters:**
```json
{
  "success": false,
  "error": "Missing required parameters: makerTokenSymbol, takerTokenSymbol, makingAmount, takingAmount"
}
```

**Invalid Token:**
```json
{
  "success": false,
  "error": "Invalid token symbols",
  "availableTokens": ["WETH", "USDC", "USDT", "DAI", "UNI", "LINK"]
}
```

**Invalid Amounts:**
```json
{
  "success": false,
  "error": "Invalid amount values"
}
```

**Insufficient Balance:**
```json
{
  "success": false,
  "error": "Insufficient WETH balance. Have: 0.05, Need: 0.1",
  "timestamp": "2024-09-27T10:30:45.123Z"
}
```

**Order Creation Failed:**
```json
{
  "success": false,
  "error": "Both SDK and manual methods failed",
  "timestamp": "2024-09-27T10:30:45.123Z"
}
```

---

## Example Usage

### Using cURL

**Preview an order:**
```bash
curl -X POST http://localhost:3000/order/preview \
  -H "Content-Type: application/json" \
  -d '{
    "makerTokenSymbol": "WETH",
    "takerTokenSymbol": "USDC",
    "makingAmount": "0.1",
    "takingAmount": "265"
  }'
```

**Create an order:**
```bash
curl -X POST http://localhost:3000/order \
  -H "Content-Type: application/json" \
  -d '{
    "makerTokenSymbol": "WETH",
    "takerTokenSymbol": "USDC",
    "makingAmount": "0.1",
    "takingAmount": "265"
  }'
```

**Check token balance:**
```bash
curl http://localhost:3000/balance/WETH
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

// Preview order
const preview = await axios.post('http://localhost:3000/order/preview', {
  makerTokenSymbol: 'WETH',
  takerTokenSymbol: 'USDC',
  makingAmount: '0.1',
  takingAmount: '265'
});

// Create order
const order = await axios.post('http://localhost:3000/order', {
  makerTokenSymbol: 'WETH',
  takerTokenSymbol: 'USDC',
  makingAmount: '0.1',
  takingAmount: '265'
});

// Get balance
const balance = await axios.get('http://localhost:3000/balance/WETH');
```

---

## Order Types

### Public Orders
All orders created through this API are **public orders** with the following characteristics:
- **No expiration**: Orders remain active indefinitely until filled or cancelled
- **Public visibility**: Orders are submitted to the 1inch orderbook for anyone to fill
- **Best execution**: Orders can be partially filled by multiple takers

### Order Creation Process
1. **Validation**: Check token symbols, amounts, and wallet balance
2. **Approval**: Automatically approve token spending if needed
3. **Order Creation**: Try SDK method first, fallback to manual method
4. **Local Storage**: Save order details to JSON file
5. **API Submission**: Submit order to 1inch API (if successful)

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description",
  "timestamp": "2024-09-27T10:30:45.123Z"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Endpoint not found
- `500`: Internal Server Error

---

## Environment Setup

Required environment variables in `.env`:
```env
PRIVATE_KEY=your_wallet_private_key
RPC_URL=your_ethereum_rpc_url
1INCH_API_KEY=your_1inch_api_key
CHAIN_ID=1
PORT=3000
```

---

## Supported Tokens

| Symbol | Name | Address | Decimals |
|--------|------|---------|----------|
| WETH | Wrapped Ether | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 | 18 |
| USDC | USD Coin | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 6 |
| USDT | Tether USD | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 6 |
| DAI | Dai Stablecoin | 0x6B175474E89094C44Da98b954EedeAC495271d0F | 18 |
| UNI | Uniswap | 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984 | 18 |
| LINK | ChainLink Token | 0x514910771AF9Ca656af840dff83E8264EcF986CA | 18 |

---

## Rate Limits

No rate limits currently implemented for local development.

## Notes

- All amounts should be provided as strings to maintain precision
- Orders are created as public orders (no expiration)
- The server automatically handles token approvals when needed
- Order details are saved locally as JSON files for record keeping
- Failed API submissions still create valid orders that are saved locally