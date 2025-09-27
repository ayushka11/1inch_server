# Ethereum Token Trading API Documentation

A comprehensive REST API server for token swaps and limit orders on Ethereum mainnet using 1inch protocol.

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

## Token Swap Endpoints

### 2. Execute Token Swap

**POST** `/swap`

Execute an immediate token swap using 1inch aggregator.

#### Request
```http
POST /swap
Content-Type: application/json

{
  "srcToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "dstToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000000000000000000",
  "slippage": 1,
  "privateKey": "your-private-key",
  "walletAddress": "your-wallet-address"
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `srcToken` | string | Yes | Source token contract address |
| `dstToken` | string | Yes | Destination token contract address |
| `amount` | string | Yes | Amount to swap in smallest units (wei) |
| `slippage` | number | No | Slippage tolerance (0-50), default: 1 |
| `privateKey` | string | Yes | Wallet private key |
| `walletAddress` | string | Yes | Wallet address |

#### Success Response
```json
{
  "success": true,
  "transactionHash": "0x1234567890abcdef...",
  "srcToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "dstToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000000000000000000",
  "slippage": 1,
  "walletAddress": "0x..."
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Missing required fields: srcToken, dstToken, amount, privateKey, walletAddress"
}
```

---

### 3. Get Swap Quote

**POST** `/swap/quote`

Get a quote for a token swap without executing it.

#### Request
```http
POST /swap/quote
Content-Type: application/json

{
  "srcToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "dstToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000000000000000000",
  "walletAddress": "your-wallet-address"
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `srcToken` | string | Yes | Source token contract address |
| `dstToken` | string | Yes | Destination token contract address |
| `amount` | string | Yes | Amount to swap in smallest units |
| `walletAddress` | string | Yes | Wallet address |

#### Success Response
```json
{
  "success": true,
  "quote": {
    "dstAmount": "3000000000",
    "gasPrice": "15000000000",
    "estimatedGas": "150000",
    "protocols": [...]
  }
}
```

---

### 4. Get Supported Tokens

**GET** `/swap/tokens`

Retrieve all tokens supported by 1inch for swapping.

#### Request
```http
GET /swap/tokens
```

#### Success Response
```json
{
  "success": true,
  "tokens": {
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {
      "symbol": "WETH",
      "name": "Wrapped Ether",
      "decimals": 18,
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "logoURI": "..."
    }
  }
}
```

---

### 5. Check Token Allowance

**POST** `/swap/allowance`

Check the current allowance of a token for 1inch router.

#### Request
```http
POST /swap/allowance
Content-Type: application/json

{
  "tokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "walletAddress": "your-wallet-address"
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `walletAddress` | string | Yes | Wallet address |

#### Success Response
```json
{
  "success": true,
  "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
  "allowanceFormatted": "1.1579208923731619e+77"
}
```

---

## Limit Order Endpoints

### 6. Create Limit Order

**POST** `/limit-order`

Create a limit order on the 1inch protocol with automatic ETH wrapping support.

#### Request
```http
POST /limit-order
Content-Type: application/json

{
  "makerTokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "takerTokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "makerAmount": "1000000000000000000",
  "takerAmount": "3000000000",
  "privateKey": "your-private-key",
  "expirationHours": 24
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `makerTokenAddress` | string | Yes | Token you want to sell (use 0x0000...0000 for ETH) |
| `takerTokenAddress` | string | Yes | Token you want to buy (use 0x0000...0000 for ETH) |
| `makerAmount` | string | Yes | Amount of maker token in smallest units |
| `takerAmount` | string | Yes | Amount of taker token in smallest units |
| `privateKey` | string | Yes | Wallet private key |
| `expirationHours` | number | No | Order expiration in hours (1-8760), default: 24 |

#### Success Response
```json
{
  "success": true,
  "orderHash": "0xa2fd1e8a36e3dc554054cd1c1af0d8900aa9024875f6ced1362e88ac39dee716",
  "order": {...},
  "signature": "0x1b2c3d4e5f6789abcdef...",
  "expiration": "1695825600",
  "expirationDate": "2024-09-27T12:00:00.000Z",
  "maker": "0x...",
  "originalMakerToken": "0x0000000000000000000000000000000000000000",
  "originalTakerToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "actualMakerToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "actualTakerToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "makingAmount": "1000000000000000000",
  "takingAmount": "3000000000",
  "ethWrapped": "1.0"
}
```

#### Error Responses
```json
{
  "success": false,
  "error": "Missing required fields: makerTokenAddress, takerTokenAddress, makerAmount, takerAmount, privateKey"
}
```

```json
{
  "success": false,
  "error": "Insufficient ETH balance. Required: 1.0, Available: 0.5"
}
```

---

## Utility Endpoints

### 7. Get Token Information

**GET** `/token-info/:address`

Get detailed information about a specific token.

#### Request
```http
GET /token-info/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Token contract address |

#### Success Response
```json
{
  "success": true,
  "data": {
    "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "symbol": "WETH",
    "name": "Wrapped Ether",
    "decimals": 18
  }
}
```

---

### 8. Get Wallet Balances

**POST** `/wallet-balances`

Get ETH and token balances for a wallet.

#### Request
```http
POST /wallet-balances
Content-Type: application/json

{
  "walletAddress": "your-wallet-address",
  "tokenAddresses": [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  ]
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | Wallet address to check |
| `tokenAddresses` | array | No | Array of token addresses to check |

#### Success Response
```json
{
  "success": true,
  "data": {
    "ETH": {
      "balance": "1500000000000000000",
      "formatted": "1.5"
    },
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {
      "balance": "500000000000000000",
      "formatted": "0.5"
    }
  }
}
```

---

### 9. Estimate Approval Gas

**POST** `/estimate-approval-gas`

Estimate gas costs for token approval transactions.

#### Request
```http
POST /estimate-approval-gas
Content-Type: application/json

{
  "tokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "spenderAddress": "0x...",
  "amount": "1000000000000000000",
  "privateKey": "your-private-key"
}
```

#### Request Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token contract address |
| `spenderAddress` | string | Yes | Spender contract address |
| `amount` | string | Yes | Amount to approve |
| `privateKey` | string | Yes | Wallet private key |

#### Success Response
```json
{
  "success": true,
  "data": {
    "gasLimit": "46000",
    "gasPrice": "15000000000",
    "estimatedCost": "690000000000000",
    "estimatedCostFormatted": "0.00069"
  }
}
```

---

### 10. Get Common Token Addresses

**GET** `/tokens`

Get a list of commonly used token addresses.

#### Request
```http
GET /tokens
```

#### Success Response
```json
{
  "success": true,
  "data": {
    "ETH": "0x0000000000000000000000000000000000000000",
    "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  }
}
```

---

## Example Usage

### Using cURL

**Execute a token swap:**
```bash
curl -X POST http://localhost:3000/swap \
  -H "Content-Type: application/json" \
  -d '{
    "srcToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "dstToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "1000000000000000000",
    "slippage": 1,
    "privateKey": "your-private-key",
    "walletAddress": "your-wallet-address"
  }'
```

**Create a limit order (ETH to USDC):**
```bash
curl -X POST http://localhost:3000/limit-order \
  -H "Content-Type: application/json" \
  -d '{
    "makerTokenAddress": "0x0000000000000000000000000000000000000000",
    "takerTokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "makerAmount": "1000000000000000000",
    "takerAmount": "3000000000",
    "privateKey": "your-private-key",
    "expirationHours": 24
  }'
```

**Get swap quote:**
```bash
curl -X POST http://localhost:3000/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "srcToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "dstToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "1000000000000000000",
    "walletAddress": "your-wallet-address"
  }'
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

// Execute token swap
const swap = await axios.post('http://localhost:3000/swap', {
  srcToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  dstToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  amount: '1000000000000000000',
  slippage: 1,
  privateKey: 'your-private-key',
  walletAddress: 'your-wallet-address'
});

// Create limit order
const limitOrder = await axios.post('http://localhost:3000/limit-order', {
  makerTokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  takerTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  makerAmount: '1000000000000000000',
  takerAmount: '3000000000',
  privateKey: 'your-private-key',
  expirationHours: 24
});

// Get wallet balances
const balances = await axios.post('http://localhost:3000/wallet-balances', {
  walletAddress: 'your-wallet-address',
  tokenAddresses: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']
});
```

---

## Special Features

### ETH Wrapping Support
The API automatically handles ETH wrapping for limit orders:
- Use `0x0000000000000000000000000000000000000000` as token address for ETH
- ETH is automatically wrapped to WETH when used as maker token
- The response shows both original and actual token addresses used

### Token Amount Format
- All amounts must be provided in the smallest unit (wei for ETH/WETH, 6 decimals for USDC)
- Use strings to maintain precision for large numbers
- Examples:
  - 1 ETH = "1000000000000000000"
  - 1000 USDC = "1000000000"
  - 1 DAI = "1000000000000000000"

### Order Expiration
- Limit orders support expiration from 1 hour to 1 year (8760 hours)
- Default expiration is 24 hours
- Orders with longer expiration may have better fill rates

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Endpoint not found
- `500`: Internal Server Error

Common error types:
- Missing required parameters
- Invalid token addresses
- Insufficient balance
- Network/API errors
- Invalid private key format

---

## Environment Setup

Required environment variables in `.env`:
```env
PRIVATE_KEY=your_wallet_private_key
RPC_URL=your_ethereum_rpc_url
1INCH_API_KEY=your_1inch_api_key
API_KEY=your_1inch_api_key
CHAIN_ID=1
PORT=3000
```

---

## Common Token Addresses (Ethereum Mainnet)

| Symbol | Name | Address | Decimals |
|--------|------|---------|----------|
| ETH | Ethereum | 0x0000000000000000000000000000000000000000 | 18 |
| WETH | Wrapped Ether | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 | 18 |
| USDC | USD Coin | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 6 |
| USDT | Tether USD | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 6 |
| DAI | Dai Stablecoin | 0x6B175474E89094C44Da98b954EedeAC495271d0F | 18 |
| UNI | Uniswap | 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984 | 18 |
| LINK | ChainLink Token | 0x514910771AF9Ca656af840dff83E8264EcF986CA | 18 |

---

## Rate Limits

No rate limits currently implemented for local development. Consider implementing rate limiting for production use.

## Security Notes

- Private keys are transmitted in request bodies - use HTTPS in production
- Consider implementing API key authentication for production deployment
- Validate all input parameters to prevent injection attacks
- Monitor for unusual trading patterns or high-frequency requests

## Notes

- All amounts should be provided as strings to maintain precision
- The server automatically handles token approvals when needed
- Limit orders support partial fills and multiple fills
- ETH is automatically wrapped to WETH for limit orders
- Failed API submissions still create valid orders that are saved locally
- Swap operations are executed immediately while limit orders wait for market