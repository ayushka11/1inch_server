# Ethereum Token Trading API

A comprehensive REST API server for token swaps and limit orders on Ethereum mainnet using the 1inch protocol. This API provides seamless integration with 1inch's swap aggregator and limit order protocol, with automatic ETH wrapping support and robust error handling.

## 🚀 Features

- **Token Swaps**: Execute immediate token swaps using 1inch aggregator with best rates
- **Limit Orders**: Create and manage limit orders with automatic ETH wrapping
- **ETH Support**: Automatic ETH ↔ WETH conversion for seamless trading
- **Gas Optimization**: Smart gas price management and approval handling
- **Comprehensive API**: RESTful endpoints with detailed error handling
- **Token Utilities**: Balance checking, token info, and allowance management
- **Development Ready**: Easy setup with environment configuration

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Ethereum wallet with private key
- 1inch API key
- Ethereum RPC URL (Infura, Alchemy, etc.)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd TestRepo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Wallet Configuration
   PRIVATE_KEY=your_wallet_private_key
   
   # Network Configuration
   RPC_URL=https://mainnet.infura.io/v3/your-project-id
   CHAIN_ID=1
   
   # 1inch API Configuration
   1INCH_API_KEY=your_1inch_api_key
   API_KEY=your_1inch_api_key
   
   # Server Configuration
   PORT=3000
   ```

4. **Build and start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm start
   ```

## 🌐 API Endpoints

The server provides the following endpoints:

### Token Swaps
- `POST /swap` - Execute immediate token swap
- `POST /swap/quote` - Get swap quote without executing
- `GET /swap/tokens` - Get supported tokens
- `POST /swap/allowance` - Check token allowance

### Limit Orders
- `POST /limit-order` - Create limit order with ETH wrapping support

### Utilities
- `GET /token-info/:address` - Get token information
- `POST /wallet-balances` - Get wallet balances
- `POST /estimate-approval-gas` - Estimate approval gas costs
- `GET /tokens` - Get common token addresses
- `GET /health` - Health check

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Wallet private key (without 0x prefix) | Yes |
| `RPC_URL` | Ethereum RPC endpoint | Yes |
| `1INCH_API_KEY` | 1inch API key | Yes |
| `API_KEY` | Alternative 1inch API key | Yes |
| `CHAIN_ID` | Network chain ID (1 for mainnet) | No (default: 1) |
| `PORT` | Server port | No (default: 3000) |

### Token Amount Format

All amounts must be provided in the smallest unit:
- **ETH/WETH**: 18 decimals (1 ETH = "1000000000000000000")
- **USDC/USDT**: 6 decimals (1000 USDC = "1000000000")
- **DAI**: 18 decimals (1 DAI = "1000000000000000000")

### Common Token Addresses

| Symbol | Address | Decimals |
|--------|---------|----------|
| ETH | `0x0000000000000000000000000000000000000000` | 18 |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |

## 🛡️ Security Features

- **Private Key Protection**: Keys are only used for signing, never stored
- **Gas Price Optimization**: Automatic gas price capping for safety
- **Balance Validation**: Pre-flight balance checks before transactions
- **Error Handling**: Comprehensive error responses and logging
- **Input Validation**: All parameters are validated before processing

## 🔍 Special Features

### Automatic ETH Wrapping

The API automatically handles ETH wrapping for limit orders:
- Use `0x0000000000000000000000000000000000000000` for ETH
- ETH is automatically wrapped to WETH when used as maker token
- Response includes both original and actual token addresses

### Smart Approvals

- Automatic token approval checking and execution
- Gas estimation for approval transactions  
- Approval only when necessary to save gas

### Flexible Order Management

- Partial fills and multiple fills supported
- Custom expiration times (1 hour to 1 year)
- Order cancellation support
- Real-time order status tracking

## 📚 Full API Documentation

For complete API documentation with all endpoints, request/response examples, and error codes, see [API_docs.md](./API_docs.md).

## 🏗️ Project Structure

```
TestRepo/
├── src/
│   ├── server.ts          # Main Express server
│   ├── swap.ts            # 1inch swap functionality
│   ├── limitOrder.js      # Limit order management
│   └── deployTestToken.js # Token deployment utilities
├── lib/
│   ├── limit-order-protocol/  # 1inch limit order protocol
│   └── limit-order-sdk/       # 1inch SDK
├── API_docs.md            # Complete API documentation
├── package.json
├── tsconfig.json
└── .env                   # Environment variables
```

## 🧪 Testing

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# Get swap quote
curl -X POST http://localhost:3000/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "srcToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "dstToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "1000000000000000000",
    "walletAddress": "your-wallet-address"
  }'
```

### Using Postman

1. Set request method to POST
2. Add header: `Content-Type: application/json`
3. Use request body examples from API documentation

## 🚨 Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```

Common error types:
- Missing required parameters
- Insufficient balance
- Invalid token addresses
- Network connectivity issues
- Gas estimation failures

## 📊 Monitoring and Logging

The server provides comprehensive logging:
- Request/response logging
- Transaction hash tracking
- Error logging with stack traces
- Performance metrics
- Gas usage monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is provided as-is for educational and development purposes. Always test thoroughly on testnets before using with real funds. The developers are not responsible for any financial losses incurred through the use of this software.