require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { 
  createPublicLimitOrder, 
  getTokenBalance, 
  getAvailableTokens, 
  VALID_TOKENS 
} = require('./limitOrder');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get available tokens
app.get('/tokens', (req, res) => {
  const tokens = getAvailableTokens();
  const tokenDetails = tokens.reduce((acc, symbol) => {
    acc[symbol] = VALID_TOKENS[symbol];
    return acc;
  }, {});
  
  res.json({
    success: true,
    tokens: tokenDetails,
    symbols: tokens
  });
});

// Get token balance
app.get('/balance/:tokenSymbol', asyncHandler(async (req, res) => {
  const { tokenSymbol } = req.params;
  
  if (!tokenSymbol) {
    return res.status(400).json({
      success: false,
      error: 'Token symbol is required'
    });
  }
  
  const balance = await getTokenBalance(tokenSymbol.toUpperCase());
  
  res.json({
    success: true,
    tokenSymbol: tokenSymbol.toUpperCase(),
    balance,
    tokenInfo: VALID_TOKENS[tokenSymbol.toUpperCase()]
  });
}));

// Get all balances
app.get('/balances', asyncHandler(async (req, res) => {
  const balances = {};
  
  for (const symbol of Object.keys(VALID_TOKENS)) {
    try {
      const balance = await getTokenBalance(symbol);
      balances[symbol] = {
        balance,
        tokenInfo: VALID_TOKENS[symbol]
      };
    } catch (error) {
      balances[symbol] = {
        balance: 'Error',
        error: error.message
      };
    }
  }
  
  res.json({
    success: true,
    balances
  });
}));

// Create a limit order
app.post('/order', asyncHandler(async (req, res) => {
  const { makerTokenSymbol, takerTokenSymbol, makingAmount, takingAmount } = req.body;
  
  // Validation
  if (!makerTokenSymbol || !takerTokenSymbol || !makingAmount || !takingAmount) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: makerTokenSymbol, takerTokenSymbol, makingAmount, takingAmount'
    });
  }
  
  if (!VALID_TOKENS[makerTokenSymbol.toUpperCase()] || !VALID_TOKENS[takerTokenSymbol.toUpperCase()]) {
    return res.status(400).json({
      success: false,
      error: 'Invalid token symbols',
      availableTokens: getAvailableTokens()
    });
  }
  
  if (isNaN(parseFloat(makingAmount)) || isNaN(parseFloat(takingAmount))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount values'
    });
  }
  
  const result = await createPublicLimitOrder(
    makerTokenSymbol.toUpperCase(),
    takerTokenSymbol.toUpperCase(),
    makingAmount.toString(),
    takingAmount.toString()
  );
  
  res.json({
    success: true,
    message: 'Order created successfully',
    orderHash: result.orderHash,
    signature: result.signature,
    filename: result.filename,
    method: result.method,
    apiSubmitted: !!result.apiResult
  });
}));

// Get order estimate/preview
app.post('/order/preview', asyncHandler(async (req, res) => {
  const { makerTokenSymbol, takerTokenSymbol, makingAmount, takingAmount } = req.body;
  
  if (!makerTokenSymbol || !takerTokenSymbol || !makingAmount || !takingAmount) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters'
    });
  }
  
  const makerToken = VALID_TOKENS[makerTokenSymbol.toUpperCase()];
  const takerToken = VALID_TOKENS[takerTokenSymbol.toUpperCase()];
  
  if (!makerToken || !takerToken) {
    return res.status(400).json({
      success: false,
      error: 'Invalid token symbols'
    });
  }
  
  const rate = (parseFloat(takingAmount) / parseFloat(makingAmount)).toFixed(6);
  
  res.json({
    success: true,
    preview: {
      selling: `${makingAmount} ${makerToken.symbol}`,
      buying: `${takingAmount} ${takerToken.symbol}`,
      rate: `${rate} ${takerToken.symbol} per ${makerToken.symbol}`,
      makerToken,
      takerToken,
      isPublicOrder: true,
      expires: 'Never'
    }
  });
}));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /tokens',
      'GET /balance/:tokenSymbol',
      'GET /balances',
      'POST /order',
      'POST /order/preview'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Limit Order Server running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   GET  http://localhost:${PORT}/tokens`);
  console.log(`   GET  http://localhost:${PORT}/balance/:tokenSymbol`);
  console.log(`   GET  http://localhost:${PORT}/balances`);
  console.log(`   POST http://localhost:${PORT}/order`);
  console.log(`   POST http://localhost:${PORT}/order/preview`);
  console.log(`\n📝 Example order creation:`);
  console.log(`   curl -X POST http://localhost:${PORT}/order \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"makerTokenSymbol":"WETH","takerTokenSymbol":"USDC","makingAmount":"0.1","takingAmount":"265"}'`);
});

module.exports = app;