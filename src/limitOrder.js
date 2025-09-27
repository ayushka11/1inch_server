require('dotenv').config();
const ethers = require("ethers");
const { Wallet, providers, Contract } = require("ethers");
const {
  Sdk,
  MakerTraits,
  Address,
  randBigInt,
  FetchProviderConnector,
  getLimitOrderV4Domain,
} = require("@1inch/limit-order-sdk");
const fs = require("fs");
const axios = require("axios");

// Standard ERC-20 ABI
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function deposit() external payable", // WETH specific
  "function withdraw(uint256 amount) external" // WETH specific
];

// Use environment variables
const privKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.RPC_URL;
const authKey = process.env["1INCH_API_KEY"];
const chainId = parseInt(process.env.CHAIN_ID) || 1; // Ethereum mainnet

const provider = new providers.JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privKey, provider);

// Predetermined valid tokens on Ethereum mainnet
const VALID_TOKENS = {
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    decimals: 18,
    name: "Wrapped Ether"
  },
  USDC: {
    address: "0xA0b86a33E6441c4cCF29395A5c5b6F7a1C7b70A5", 
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin"
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT", 
    decimals: 6,
    name: "Tether USD"
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    decimals: 18,
    name: "Dai Stablecoin"
  },
  UNI: {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    decimals: 18,
    name: "Uniswap"
  },
  LINK: {
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    symbol: "LINK",
    decimals: 18,
    name: "ChainLink Token"
  }
};

/**
 * Submit order to 1inch API
 */
async function submitTo1inchAPI(orderHash, signature, orderData) {
  const url = `https://api.1inch.dev/orderbook/v4.1/${chainId}`;
  
  const config = {
    headers: {
      "Authorization": `Bearer ${authKey}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  };

  const body = {
    orderHash: orderHash,
    signature: signature,
    data: orderData
  };

  try {
    console.log("Submitting to 1inch API...");
    const response = await axios.post(url, body, config);
    console.log("✅ Order submitted successfully to 1inch API!");
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("API Error:", error.response.status);
      console.error("Response:", error.response.data);
    } else {
      console.error("Network Error:", error.message);
    }
    throw error;
  }
}

/**
 * Create order manually (fallback method)
 */
async function createOrderManual(makerAsset, takerAsset, makingAmount, takingAmount) {
  console.log("📋 Creating order manually (fallback method)...");
  
  const domain = getLimitOrderV4Domain(chainId);
  const limitOrderContract = domain.verifyingContract;
  
  const salt = ethers.BigNumber.from(ethers.utils.randomBytes(32));
  
  // Public order structure (NO EXPIRATION)
  const manualOrder = {
    salt: salt.toString(),
    maker: wallet.address,
    receiver: "0x0000000000000000000000000000000000000000",
    makerAsset: makerAsset,
    takerAsset: takerAsset,
    makingAmount: makingAmount.toString(),
    takingAmount: takingAmount.toString(),
    extension: "0x",
    makerTraits: "0" // NO expiration = public order
  };
  
  // EIP-712 domain and types
  const eip712Domain = {
    name: "1inch Limit Order Protocol",
    version: "4",
    chainId: chainId,
    verifyingContract: limitOrderContract
  };
  
  const types = {
    Order: [
      { name: "salt", type: "uint256" },
      { name: "maker", type: "address" },
      { name: "receiver", type: "address" },
      { name: "makerAsset", type: "address" },
      { name: "takerAsset", type: "address" },
      { name: "makingAmount", type: "uint256" },
      { name: "takingAmount", type: "uint256" },
      { name: "extension", type: "bytes" },
      { name: "makerTraits", type: "uint256" }
    ]
  };
  
  // Sign the order
  const signature = await wallet._signTypedData(eip712Domain, types, manualOrder);
  const orderHash = ethers.utils._TypedDataEncoder.hash(eip712Domain, types, manualOrder);
  
  return {
    order: manualOrder,
    signature,
    orderHash,
    domain: eip712Domain,
    types
  };
}

/**
 * Create a PUBLIC limit order (no expiration) - tries SDK first, falls back to manual
 * @param {string} makerTokenSymbol - Symbol of token to sell
 * @param {string} takerTokenSymbol - Symbol of token to buy  
 * @param {string} makingAmount - Amount to sell (in token units)
 * @param {string} takingAmount - Amount to receive (in token units)
 */
async function createPublicLimitOrder(makerTokenSymbol, takerTokenSymbol, makingAmount, takingAmount) {
  console.log(`\n=== Creating PUBLIC ${makerTokenSymbol} -> ${takerTokenSymbol} Order ===`);
  console.log("🔓 Public Order: No expiration, compatible with 1inch API");
  
  // Validate token symbols
  if (!VALID_TOKENS[makerTokenSymbol] || !VALID_TOKENS[takerTokenSymbol]) {
    throw new Error(`Invalid token symbols. Valid tokens: ${Object.keys(VALID_TOKENS).join(', ')}`);
  }
  
  const makerToken = VALID_TOKENS[makerTokenSymbol];
  const takerToken = VALID_TOKENS[takerTokenSymbol];
  
  // Convert amounts to wei/token units
  const makingAmountWei = ethers.utils.parseUnits(makingAmount, makerToken.decimals);
  const takingAmountWei = ethers.utils.parseUnits(takingAmount, takerToken.decimals);
  
  console.log(`Selling: ${makingAmount} ${makerToken.symbol}`);
  console.log(`For: ${takingAmount} ${takerToken.symbol}`);
  console.log(`Rate: ${(parseFloat(takingAmount) / parseFloat(makingAmount)).toFixed(6)} ${takerToken.symbol} per ${makerToken.symbol}`);
  
  // Check maker token balance
  const makerContract = new Contract(makerToken.address, erc20AbiFragment, wallet);
  const balance = await makerContract.balanceOf(wallet.address);
  const balanceFormatted = ethers.utils.formatUnits(balance, makerToken.decimals);
  
  console.log(`${makerToken.symbol} Balance: ${balanceFormatted}`);
  
  if (balance.lt(makingAmountWei)) {
    throw new Error(`Insufficient ${makerToken.symbol} balance. Have: ${balanceFormatted}, Need: ${makingAmount}`);
  }
  
  // Get contract address using SDK method
  const domain = getLimitOrderV4Domain(chainId);
  const limitOrderContract = domain.verifyingContract;
  
  console.log(`1inch Contract: ${limitOrderContract}`);
  
  // Check and approve if needed
  const currentAllowance = await makerContract.allowance(wallet.address, limitOrderContract);
  const allowanceFormatted = ethers.utils.formatUnits(currentAllowance, makerToken.decimals);
  
  console.log(`Current allowance: ${allowanceFormatted} ${makerToken.symbol}`);
  
  if (currentAllowance.lt(makingAmountWei)) {
    console.log(`Approving ${makerToken.symbol}...`);
    const gasPrice = await provider.getGasPrice();
    const approveTx = await makerContract.approve(limitOrderContract, makingAmountWei, {
      gasPrice: gasPrice,
      gasLimit: 60000
    });
    console.log("Approval tx:", approveTx.hash);
    await approveTx.wait();
    console.log("✅ Approval successful");
  }
  
  let orderResult;
  let methodUsed;
  
  // TRY SDK FIRST for public orders
  try {
    console.log("🚀 Attempting order creation with SDK...");
    
    const sdk = new Sdk({
      authKey,
      networkId: chainId,
      httpConnector: new FetchProviderConnector(),
    });
    
    const UINT_40_MAX = (1n << 48n) - 1n;
    
    // Create PUBLIC MakerTraits (NO EXPIRATION)
    const makerTraits = MakerTraits.default()
      .withNonce(randBigInt(UINT_40_MAX));
    // IMPORTANT: Do NOT add .withExpiration() - keeps it public!
    
    const order = await sdk.createOrder(
      {
        makerAsset: new Address(makerToken.address),
        takerAsset: new Address(takerToken.address),
        makingAmount: makingAmountWei.toString(),
        takingAmount: takingAmountWei.toString(),
        maker: new Address(wallet.address),
      },
      makerTraits
    );
    
    console.log("✅ SDK order creation successful!");
    
    // Sign the order
    const typedData = order.getTypedData(chainId);
    const signature = await wallet._signTypedData(
      typedData.domain,
      { Order: typedData.types[typedData.primaryType] },
      typedData.message
    );
    
    orderResult = {
      order: order.build(),
      signature,
      orderHash: order.getOrderHash(chainId),
      typedData
    };
    
    methodUsed = "SDK";
    console.log("✅ Order signed with SDK method!");
    
  } catch (sdkError) {
    console.log("⚠️ SDK failed:", sdkError.message);
    console.log("🔄 Falling back to manual method...");
    
    // FALLBACK TO MANUAL METHOD
    try {
      orderResult = await createOrderManual(
        makerToken.address,
        takerToken.address,
        makingAmountWei,
        takingAmountWei
      );
      methodUsed = "Manual";
      console.log("✅ Manual order creation successful!");
      
    } catch (manualError) {
      console.error("❌ Manual method also failed:", manualError.message);
      throw new Error("Both SDK and manual methods failed");
    }
  }
  
  // Save order locally
  const signedOrder = {
    ...orderResult,
    metadata: {
      makerToken: makerToken.symbol,
      takerToken: takerToken.symbol,
      makingAmount,
      takingAmount,
      rate: (parseFloat(takingAmount) / parseFloat(makingAmount)).toFixed(6),
      timestamp: new Date().toISOString(),
      method: methodUsed,
      chainId,
      isPublicOrder: true
    }
  };
  
  const filename = `public_order_${makerTokenSymbol}_to_${takerTokenSymbol}_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(signedOrder, null, 2));
  console.log(`✅ Order saved to ${filename}`);
  
  // Submit to 1inch API
  let apiResult = null;
  try {
    apiResult = await submitTo1inchAPI(orderResult.orderHash, orderResult.signature, orderResult.order);
    signedOrder.apiResult = apiResult;
    
    // Update saved file with API result
    fs.writeFileSync(filename, JSON.stringify(signedOrder, null, 2));
    
  } catch (apiError) {
    console.log("⚠️ Order created but API submission failed");
    console.log("💡 Order is still valid and saved locally");
  }
  
  console.log("\n=== ✅ PUBLIC Order Complete! ===");
  console.log(`🎯 Method Used: ${methodUsed}`);
  console.log(`🎯 Selling: ${makingAmount} ${makerToken.symbol}`);
  console.log(`🎯 For: ${takingAmount} ${takerToken.symbol}`);
  console.log(`🎯 Order Hash: ${orderResult.orderHash}`);
  console.log(`🎯 File: ${filename}`);
  console.log(`🎯 Expires: Never (public order)`);
  
  if (apiResult) {
    console.log(`🎯 API Status: Successfully submitted`);
  }
  
  return {
    orderHash: orderResult.orderHash,
    signature: orderResult.signature,
    order: orderResult.order,
    apiResult,
    filename,
    method: methodUsed
  };
}

/**
 * Get current token balance
 */
async function getTokenBalance(tokenSymbol) {
  if (!VALID_TOKENS[tokenSymbol]) {
    throw new Error(`Invalid token symbol: ${tokenSymbol}`);
  }
  
  const token = VALID_TOKENS[tokenSymbol];
  const contract = new Contract(token.address, erc20AbiFragment, provider);
  const balance = await contract.balanceOf(wallet.address);
  return ethers.utils.formatUnits(balance, token.decimals);
}

/**
 * List available tokens
 */
function getAvailableTokens() {
  return Object.keys(VALID_TOKENS);
}

// Test the implementation
async function testPublicOrders() {
  console.log("=== PUBLIC Limit Orders Test (SDK + Manual Fallback) ===");
  console.log("Available tokens:", getAvailableTokens().join(", "));
  console.log("Wallet:", wallet.address);
  
  try {
    // Show current balances
    console.log("\n=== Current Balances ===");
    for (const symbol of Object.keys(VALID_TOKENS)) {
      try {
        const balance = await getTokenBalance(symbol);
        if (parseFloat(balance) > 0) {
          console.log(`${symbol}: ${balance}`);
        }
      } catch (error) {
        // Skip tokens we can't check
      }
    }
    
    // Test with your WETH balance
    const wethBalance = await getTokenBalance("WETH");
    if (parseFloat(wethBalance) > 0) {
      console.log(`\n🎯 Testing with WETH balance: ${wethBalance}`);
      
      // Create a small test order: sell 50% of WETH for USDC
      const sellAmount = (parseFloat(wethBalance) * 0.5).toFixed(6);
      const expectedUSDC = (parseFloat(sellAmount) * 2650).toFixed(2); // ~$2650/ETH
      
      console.log(`\n📋 Test Order: ${sellAmount} WETH -> ${expectedUSDC} USDC`);
      
      // Uncomment to actually create the order:
      // await createPublicLimitOrder("WETH", "USDC", sellAmount, expectedUSDC);
      
    } else {
      console.log("\n💡 No WETH balance found for testing");
    }
    
  } catch (error) {
    console.error("Test Error:", error.message);
  }
}

// Export functions
module.exports = {
  createPublicLimitOrder,
  getTokenBalance,
  getAvailableTokens,
  VALID_TOKENS
};

// Run test if called directly
if (require.main === module) {
  testPublicOrders().catch(console.error);
}