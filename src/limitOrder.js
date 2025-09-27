require('dotenv').config();
const ethers = require("ethers");
const { Wallet, providers, Contract } = require("ethers");
const { LimitOrder, getLimitOrderV4Domain, Address, MakerTraits, Sdk, randBigInt, FetchProviderConnector } = require("@1inch/limit-order-sdk");
const fs = require("fs");
const axios = require("axios");

// Standard ERC-20 ABI fragment + WETH specific functions
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function deposit() external payable",
  "function withdraw(uint256 amount) external"
];

const rpcUrl = process.env.RPC_URL;
const authKey = process.env["1INCH_API_KEY"];
const chainId = parseInt(process.env.CHAIN_ID) || 1;

const provider = new providers.JsonRpcProvider(rpcUrl);

const ETH_TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
};

// Function to get optimal gas price for Ethereum
async function getOptimalGasPrice() {
  try {
    const gasPrice = await provider.getGasPrice();
    console.log("Current Gas Price (gwei):", ethers.utils.formatUnits(gasPrice, "gwei"));
    
    const maxGasPrice = ethers.utils.parseUnits("10", "gwei");
    
    if (gasPrice.gt(maxGasPrice)) {
      console.log("⚠️ Gas price very high, using capped price for safety");
      return maxGasPrice;
    }
    
    return gasPrice;
  } catch (error) {
    console.log("Failed to get gas price, using default:", error.message);
    return ethers.utils.parseUnits("1", "gwei");
  }
}

// Function to verify contract exists
async function verifyContract(address, name) {
  try {
    const checksumAddress = ethers.utils.getAddress(address);
    const code = await provider.getCode(checksumAddress);
    const exists = code !== "0x";
    console.log(`${name} contract at ${checksumAddress}:`, exists ? "EXISTS" : "NOT FOUND");
    return exists;
  } catch (error) {
    console.log(`Failed to check ${name} contract:`, error.message);
    return false;
  }
}

async function checkBalance(tokenAddress, walletAddress) {
  const tokenContract = new Contract(tokenAddress, erc20AbiFragment, provider);
  try {
    const balance = await tokenContract.balanceOf(walletAddress);
    return {
      balance,
      formatted: ethers.utils.formatUnits(balance, tokenAddress === ETH_TOKENS.USDC ? 6 : 18)
    };
  } catch (error) {
    return null;
  }
}

// Main function to create limit order
async function createLimitOrder({
  makerTokenAddress,
  takerTokenAddress,
  makerAmount,
  takerAmount,
  privateKey,
  expirationHours = 24
}) {
  try {
    // Validate inputs
    if (!makerTokenAddress || !takerTokenAddress || !makerAmount || !takerAmount || !privateKey) {
      throw new Error("Missing required parameters");
    }

    // Create wallet instance
    const wallet = new Wallet(privateKey, provider);
    
    // Get domain and contract address
    const domain = getLimitOrderV4Domain(chainId);
    const limitOrderContract = domain.verifyingContract;
    
    // Convert amounts to BigNumber
    const makingAmountBN = ethers.BigNumber.from(makerAmount);
    const takingAmountBN = ethers.BigNumber.from(takerAmount);
    
    console.log(`Creating limit order:`);
    console.log(`Maker: ${makerTokenAddress}`);
    console.log(`Taker: ${takerTokenAddress}`);
    console.log(`Making Amount: ${makerAmount}`);
    console.log(`Taking Amount: ${takerAmount}`);
    
    // Check maker token balance
    const makerBalance = await checkBalance(makerTokenAddress, wallet.address);
    if (!makerBalance || makerBalance.balance.lt(makingAmountBN)) {
      throw new Error(`Insufficient maker token balance. Required: ${makerAmount}, Available: ${makerBalance?.balance.toString() || '0'}`);
    }
    
    // Check and approve maker token if needed
    const makerTokenContract = new Contract(makerTokenAddress, erc20AbiFragment, wallet);
    const currentAllowance = await makerTokenContract.allowance(wallet.address, limitOrderContract);
    
    if (currentAllowance.lt(makingAmountBN)) {
      console.log("Approving maker token...");
      const optimalGasPrice = await getOptimalGasPrice();
      const approveTx = await makerTokenContract.approve(limitOrderContract, makingAmountBN, {
        gasPrice: optimalGasPrice,
        gasLimit: 50000
      });
      await approveTx.wait();
      console.log("Maker token approved");
    }
    
    // Create SDK instance
    const sdk = new Sdk({ 
      authKey, 
      networkId: chainId, 
      httpConnector: new FetchProviderConnector() 
    });

    // Set up order expiration
    const expiresIn = BigInt(expirationHours * 60 * 60); // Convert hours to seconds
    const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;
    const UINT_40_MAX = (1n << 40n) - 1n;

    // Create maker traits
    const makerTraits = MakerTraits.default()
      .withExpiration(expiration)
      .withNonce(randBigInt(UINT_40_MAX))
      .allowPartialFills()
      .allowMultipleFills();

    console.log("Creating order with SDK...");

    // Create the order
    const order = await sdk.createOrder({
      makerAsset: new Address(makerTokenAddress),
      takerAsset: new Address(takerTokenAddress),
      makingAmount: BigInt(makingAmountBN.toString()),
      takingAmount: BigInt(takingAmountBN.toString()),
      maker: new Address(wallet.address),
    }, makerTraits);

    // Get typed data for signing
    const typedData = order.getTypedData();

    // Clean domain for signing
    const cleanDomain = {
      name: typedData.domain.name,
      version: typedData.domain.version,
      chainId: chainId,
      verifyingContract: typedData.domain.verifyingContract
    };

    // Sign the order
    const signature = await wallet._signTypedData(
      cleanDomain,
      { Order: typedData.types.Order },
      typedData.message
    );

    console.log("Order signed successfully");

    // Submit order to 1inch
    await sdk.submitOrder(order, signature);

    console.log("Order submitted to 1inch API successfully!");

    // Get order hash
    const orderHash = order.getOrderHash(chainId);
    
    // Prepare response
    const result = {
      success: true,
      orderHash: orderHash,
      order: order.build(),
      signature: signature,
      expiration: expiration.toString(),
      expirationDate: new Date(Number(expiration) * 1000).toISOString(),
      maker: wallet.address,
      makerToken: makerTokenAddress,
      takerToken: takerTokenAddress,
      makingAmount: makerAmount,
      takingAmount: takerAmount
    };
    
    return result;
    
  } catch (error) {
    console.error("Order creation failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to get token info
async function getTokenInfo(tokenAddress) {
  try {
    const tokenContract = new Contract(tokenAddress, erc20AbiFragment, provider);
    const [symbol, name, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.name(),
      tokenContract.decimals()
    ]);
    
    return {
      address: tokenAddress,
      symbol,
      name,
      decimals
    };
  } catch (error) {
    throw new Error(`Failed to get token info for ${tokenAddress}: ${error.message}`);
  }
}

// Function to get wallet balances
async function getWalletBalances(walletAddress, tokenAddresses) {
  try {
    const balances = {};
    
    // Get ETH balance
    const ethBalance = await provider.getBalance(walletAddress);
    balances.ETH = {
      balance: ethBalance.toString(),
      formatted: ethers.utils.formatEther(ethBalance)
    };
    
    // Get token balances
    for (const tokenAddress of tokenAddresses) {
      const balance = await checkBalance(tokenAddress, walletAddress);
      if (balance) {
        balances[tokenAddress] = balance;
      }
    }
    
    return balances;
  } catch (error) {
    throw new Error(`Failed to get wallet balances: ${error.message}`);
  }
}

// Function to estimate gas for approval
async function estimateApprovalGas(tokenAddress, spenderAddress, amount, privateKey) {
  try {
    const wallet = new Wallet(privateKey, provider);
    const tokenContract = new Contract(tokenAddress, erc20AbiFragment, wallet);
    
    const gasEstimate = await tokenContract.estimateGas.approve(spenderAddress, amount);
    const gasPrice = await getOptimalGasPrice();
    
    return {
      gasLimit: gasEstimate.toString(),
      gasPrice: gasPrice.toString(),
      estimatedCost: gasEstimate.mul(gasPrice).toString(),
      estimatedCostFormatted: ethers.utils.formatEther(gasEstimate.mul(gasPrice))
    };
  } catch (error) {
    throw new Error(`Failed to estimate approval gas: ${error.message}`);
  }
}

module.exports = {
  createLimitOrder,
  getTokenInfo,
  getWalletBalances,
  estimateApprovalGas,
  checkBalance,
  verifyContract,
  ETH_TOKENS,
  provider,
  chainId
};