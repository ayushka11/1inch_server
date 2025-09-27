// server.ts
import express from "express";
import { exec } from "child_process";
import path from "path";
import cors from "cors";

// Import the limit order functions
const { 
  createLimitOrder, 
  getTokenInfo, 
  getWalletBalances, 
  estimateApprovalGas,
  ETH_TOKENS 
} = require("./limitOrder.js");

// Import swap functions
import { 
  performTokenSwap, 
  getSwapQuote, 
  getSupportedTokens, 
  checkTokenAllowance 
} from "./swap";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes and origins
app.use(cors({
  origin: '*', // Allow all origins
  credentials: false, // Disable credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

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

// Add CORS headers manually as backup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '3600');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

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

// Token swap endpoint
app.post("/swap", async (req, res) => {
  try {
    console.log("Raw swap request body:", req.body);
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

    const {
      srcToken,
      dstToken,
      amount,
      slippage = 1,
      privateKey,
      walletAddress
    } = bodyData;

    // Validate required fields
    if (!srcToken || !dstToken || !amount || !privateKey || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: srcToken, dstToken, amount, privateKey, walletAddress",
        received: {
          srcToken: !!srcToken,
          dstToken: !!dstToken,
          amount: !!amount,
          privateKey: !!privateKey,
          walletAddress: !!walletAddress
        }
      });
    }

    // Validate slippage
    const slippageNum = parseFloat(slippage);
    if (isNaN(slippageNum) || slippageNum < 0 || slippageNum > 50) {
      return res.status(400).json({
        success: false,
        error: "Invalid slippage. Must be a number between 0 and 50"
      });
    }

    console.log("Performing token swap with params:", {
      srcToken,
      dstToken,
      amount,
      slippage: slippageNum,
      walletAddress,
      privateKey: "***HIDDEN***"
    });

    const result = await performTokenSwap({
      srcToken,
      dstToken,
      amount,
      slippage: slippageNum,
      privateKey,
      walletAddress
    });

    res.json(result);

  } catch (error) {
    console.error("Swap API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || "Internal server error"
    });
  }
});

// Get swap quote endpoint
app.post("/swap/quote", async (req, res) => {
  try {
    console.log("Raw quote request body:", req.body);
    
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

    const { srcToken, dstToken, amount, walletAddress } = bodyData;

    if (!srcToken || !dstToken || !amount || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: srcToken, dstToken, amount, walletAddress",
        received: {
          srcToken: !!srcToken,
          dstToken: !!dstToken,
          amount: !!amount,
          walletAddress: !!walletAddress
        }
      });
    }

    console.log("Getting swap quote with params:", {
      srcToken,
      dstToken,
      amount,
      walletAddress
    });

    const result = await getSwapQuote({
      srcToken,
      dstToken,
      amount,
      walletAddress
    });

    res.json(result);

  } catch (error) {
    console.error("Quote API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Get supported tokens endpoint
app.get("/swap/tokens", async (req, res) => {
  try {
    console.log("Fetching supported tokens...");
    const result = await getSupportedTokens();
    res.json(result);
  } catch (error) {
    console.error("Get tokens API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Check token allowance endpoint
app.post("/swap/allowance", async (req, res) => {
  try {
    console.log("Raw allowance request body:", req.body);
    
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

    const { tokenAddress, walletAddress } = bodyData;

    if (!tokenAddress || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: tokenAddress, walletAddress",
        received: {
          tokenAddress: !!tokenAddress,
          walletAddress: !!walletAddress
        }
      });
    }

    console.log("Checking token allowance with params:", {
      tokenAddress,
      walletAddress
    });

    const result = await checkTokenAllowance(tokenAddress, walletAddress);
    res.json(result);

  } catch (error) {
    console.error("Allowance API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
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
    console.log("Getting token info for:", address);
    
    const tokenInfo = await getTokenInfo(address);
    res.json({
      success: true,
      data: tokenInfo
    });
  } catch (error) {
    console.error("Token info API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Get wallet balances endpoint
app.post("/wallet-balances", async (req, res) => {
  try {
    console.log("Raw wallet balances request body:", req.body);
    
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

    const { walletAddress, tokenAddresses = [] } = bodyData;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing walletAddress"
      });
    }

    console.log("Getting wallet balances for:", { walletAddress, tokenAddresses });

    const balances = await getWalletBalances(walletAddress, tokenAddresses);
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    console.error("Wallet balances API error:", error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Estimate approval gas endpoint
app.post("/estimate-approval-gas", async (req, res) => {
  try {
    console.log("Raw estimate gas request body:", req.body);
    
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

    const { tokenAddress, spenderAddress, amount, privateKey } = bodyData;
    
    if (!tokenAddress || !spenderAddress || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: tokenAddress, spenderAddress, amount, privateKey",
        received: {
          tokenAddress: !!tokenAddress,
          spenderAddress: !!spenderAddress,
          amount: !!amount,
          privateKey: !!privateKey
        }
      });
    }

    console.log("Estimating approval gas with params:", {
      tokenAddress,
      spenderAddress,
      amount,
      privateKey: "***HIDDEN***"
    });

    const gasEstimate = await estimateApprovalGas(tokenAddress, spenderAddress, amount, privateKey);
    res.json({
      success: true,
      data: gasEstimate
    });
  } catch (error) {
    console.error("Estimate gas API error:", error);
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString() 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("🌍 CORS enabled for all origins - No authentication required");
  console.log("Available endpoints:");
  console.log("  POST /swap - Execute token swap");
  console.log("  POST /swap/quote - Get swap quote");
  console.log("  GET /swap/tokens - Get supported tokens");
  console.log("  POST /swap/allowance - Check token allowance");
  console.log("  POST /limit-order - Create a limit order");
  console.log("  GET /token-info/:address - Get token information");
  console.log("  POST /wallet-balances - Get wallet balances");
  console.log("  POST /estimate-approval-gas - Estimate gas for token approval");
  console.log("  GET /tokens - Get common token addresses");
  console.log("  GET /health - Health check");
});
