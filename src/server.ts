// server.ts
import express from "express";
import { exec } from "child_process";
import path from "path";

// Import the limit order functions
const { 
  createLimitOrder, 
  getTokenInfo, 
  getWalletBalances, 
  estimateApprovalGas,
  ETH_TOKENS 
} = require("./limitOrder.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to handle text/plain as JSON
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'text/plain') {
    req.headers['content-type'] = 'application/json';
  }
  next();
});

// Middleware to parse JSON request bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text()); // Add text parser as backup

// Add logging middleware to debug requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  // If body is a string, try to parse it as JSON
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
      console.log('Parsed JSON body:', req.body);
    } catch (e) {
      console.log('Failed to parse body as JSON:', (e as Error).message);
    }
  }
  
  next();
});

// Create limit order endpoint
app.post("/limit-order", async (req, res) => {
  try {
    console.log("Raw request body:", req.body);
    console.log("Body type:", typeof req.body);
    
    // Handle case where body might be a string
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Invalid JSON format in request body"
        });
      }
    }
    
    // Check if body exists
    if (!bodyData || Object.keys(bodyData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Request body is empty or invalid JSON. Make sure Content-Type is set to 'application/json'"
      });
    }

    const {
      makerTokenAddress,
      takerTokenAddress,
      makerAmount,
      takerAmount,
      privateKey,
      expirationHours = 24
    } = bodyData;

    // Validate required fields
    if (!makerTokenAddress || !takerTokenAddress || !makerAmount || !takerAmount || !privateKey) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: makerTokenAddress, takerTokenAddress, makerAmount, takerAmount, privateKey",
        received: {
          makerTokenAddress: !!makerTokenAddress,
          takerTokenAddress: !!takerTokenAddress,
          makerAmount: !!makerAmount,
          takerAmount: !!takerAmount,
          privateKey: !!privateKey
        }
      });
    }

    // Validate expiration hours
    const expiry = parseInt(expirationHours);
    if (isNaN(expiry) || expiry <= 0 || expiry > 8760) { // Max 1 year
      return res.status(400).json({
        success: false,
        error: "Invalid expirationHours. Must be a positive number between 1 and 8760 (hours)"
      });
    }

    console.log("Creating limit order with params:", {
      makerTokenAddress,
      takerTokenAddress,
      makerAmount,
      takerAmount,
      expirationHours: expiry,
      maker: "***PRIVATE***"
    });

    // Call the createLimitOrder function
    const result = await createLimitOrder({
      makerTokenAddress,
      takerTokenAddress,
      makerAmount,
      takerAmount,
      privateKey,
      expirationHours: expiry
    });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error("Limit order API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || "Internal server error"
    });
  }
});

// Get token info endpoint
app.get("/token-info/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const tokenInfo = await getTokenInfo(address);
    res.json({
      success: true,
      data: tokenInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Get wallet balances endpoint
app.post("/wallet-balances", async (req, res) => {
  try {
    const { walletAddress, tokenAddresses = [] } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing walletAddress"
      });
    }

    const balances = await getWalletBalances(walletAddress, tokenAddresses);
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Estimate approval gas endpoint
app.post("/estimate-approval-gas", async (req, res) => {
  try {
    const { tokenAddress, spenderAddress, amount, privateKey } = req.body;
    
    if (!tokenAddress || !spenderAddress || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: tokenAddress, spenderAddress, amount, privateKey"
      });
    }

    const gasEstimate = await estimateApprovalGas(tokenAddress, spenderAddress, amount, privateKey);
    res.json({
      success: true,
      data: gasEstimate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Get common token addresses endpoint
app.get("/tokens", (req, res) => {
  res.json({
    success: true,
    data: ETH_TOKENS
  });
});

// Run swap (TS file) - keeping existing functionality
app.post("/swap", (req, res) => {
  const scriptPath = path.join(__dirname, "swap.ts");
  exec(`npx ts-node ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      return res.status(500).json({ error: stderr });
    }
    res.json({ output: stdout });
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString() 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("Available endpoints:");
  console.log("  POST /limit-order - Create a limit order");
  console.log("  GET /token-info/:address - Get token information");
  console.log("  POST /wallet-balances - Get wallet balances");
  console.log("  POST /estimate-approval-gas - Estimate gas for token approval");
  console.log("  GET /tokens - Get common token addresses");
  console.log("  POST /swap - Execute swap (existing functionality)");
  console.log("  GET /health - Health check");
});
