import { Telegraf } from 'telegraf';
import https from 'https';
import http from 'http';
import { analyzeWallet, escapeMarkdown, createKeyboard } from './bot.js';
import { getDetailedWalletInfo } from './solana.js';
import 'dotenv/config';
import { setDefaultResultOrder } from 'node:dns';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://telegram-bot-solana-g2sq.onrender.com"; 
const PORT = process.env.PORT || 3000;

// Set the Telegram webhook
bot.telegram.setWebhook(`${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);

// Start the webhook on the same path
bot.startWebhook(`/bot${process.env.BOT_TOKEN}`, null, PORT);

console.log(`Bot is listening for webhooks on ${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);


setDefaultResultOrder('ipv4first');

const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: {
    agent: new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 10000,
    }),
  },
});

// Command handlers
bot.command('start', (ctx) => {
  ctx.reply(
    `Welcome ${escapeMarkdown(ctx.from.first_name)}! 
\nCommands::
/start - Initialize bot
/help - Show help menu
/about - Bot information

🚀Lets Start::
\nSend a Solana wallet address.`
  );
});

bot.command('help', (ctx) => {
  ctx.replyWithMarkdownV2(
    escapeMarkdown(`*🤖 Bot Commands*

/start - Initialize bot
/help - Show help menu
/about - Bot information

*Features*
- Real-time balance tracking
- NFT portfolio analysis
- Transaction history
- Staking overview
- Interactive dashboard`)
  );
});

bot.command('about', (ctx) => {
  ctx.replyWithMarkdownV2(
    escapeMarkdown(`*🌐 About This Bot*

Version: 2.1
Network: Solana Devnet
Data Providers:
  - Helius Hyperion API
  - Solana Web3.js`)
  );
});

bot.on('text', async (ctx) => {
  const input = ctx.message.text.trim();
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  if (solanaAddressRegex.test(input)) {
    await analyzeWallet(ctx, input);
  } else {
    await ctx.reply('⚠️ Invalid Solana address format');
  }
});

bot.action(/^(tokens|nfts|txs|value|refresh)_(.+)$/, async (ctx) => {
  try {
    const action = ctx.match[1];
    const walletAddress = ctx.match[2];

    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!walletAddress || !solanaAddressRegex.test(walletAddress)) {
      return ctx.answerCbQuery('⚠️ Invalid wallet address in callback');
    }

    await ctx.answerCbQuery();
    await ctx.sendChatAction('typing');

    const data = await getDetailedWalletInfo(walletAddress);
    let response;

    switch (action) {
      case 'tokens':
        response =
          `📊 *Token Breakdown*\n\n` +
          `🪙 Fungible \\: ${escapeMarkdown(data.tokens.fungible)}\n` +
          `🖼 NFTs \\: ${escapeMarkdown(data.tokens.nfts)}`;
        break;
      case 'nfts':
        response =
          `🖼 *NFT Collection*\n\n` +
          `Total Items \\: ${escapeMarkdown(data.tokens.nfts)}\n` +
          `Estimated Value \\: Coming Soon 🔄`;
        break;
      case 'txs':
        const txs = data.recentTransactions
          .slice(0, 5)
          .map(
            (tx, index) =>
              `${index + 1}\\. ⌛ ${escapeMarkdown(
                new Date(tx.blockTime * 1000).toLocaleDateString()
              )} \\- ${escapeMarkdown(tx.signature.substring(0, 8))}\\.\\.\\.`
          )
          .join('\n');
        response = `📜 *Recent Transactions*\n\n${txs || 'No recent transactions'}`;
        break;
      case 'value':
        response =
          `💹 *Portfolio Valuation*\n\n` +
          escapeMarkdown(`This feature is under active development 🛠`) +
          `\n` +
          escapeMarkdown(`Check back next week for updates!`);
        break;
      case 'refresh':
        const freshData = await getDetailedWalletInfo(walletAddress);
        response = `
🔍 *Wallet Analysis* 🔍
\`${escapeMarkdown(walletAddress)}\`

*◎ SOL Balance* \\: ${escapeMarkdown(freshData.solBalance)}
*🪙 Total Tokens* \\: ${escapeMarkdown(freshData.tokens.total)}
├─ Fungible \\: ${escapeMarkdown(freshData.tokens.fungible)}
└─ NFTs \\: ${escapeMarkdown(freshData.tokens.nfts)}
*🔒 Staked Accounts* \\: ${escapeMarkdown(freshData.stakeAccounts)}
*📆 Recent Activity* \\: ${escapeMarkdown(freshData.recentTransactions.length)} TXs \\(Last 5\\)
Updated at \\: ${escapeMarkdown(new Date().toUTCString())}
        `.trim().replace(/ +/g, ' ');
        break;
      default:
        response = '⚠️ Unknown action';
    }

    await ctx.editMessageText(response, {
      parse_mode: 'MarkdownV2',
      reply_markup: createKeyboard(walletAddress),
    });
  } catch (err) {
    console.error('Callback Error:', err);
    await ctx.answerCbQuery('⚠️ Error processing request');
  }
});

bot.catch((err, ctx) => {
  console.error(`Global Error: ${err.message}`);
  if (ctx.update.callback_query) {
    ctx.answerCbQuery('⚠️ Service unavailable. Try again later.');
  }
});

// Launch the bot
bot.launch().then(() => {
  console.log('🤖 Bot activated');
});

// Create a simple HTTP server
// const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down gracefully...');
  bot.stop('SIGTERM');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
