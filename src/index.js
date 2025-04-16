import { Telegraf } from 'telegraf';
import https from 'https';
import { analyzeWallet, escapeMarkdown, createKeyboard, subKeyTrackWallet } from './bot.js';
import { getDetailedWalletInfo } from './solana.js';
import 'dotenv/config';
import { setDefaultResultOrder } from 'node:dns';
import fs from 'fs';
import { subscribeToTrackWallet } from './helper.js';
import { clearUserState, getUser, setUserState, updateUser } from './database.js';
const WEBHOOK_URL = process.env.WEBHOOK_URL; 
const PORT = process.env.PORT || 3000;

setDefaultResultOrder('ipv4first');

export const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: {
    agent: new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 10000,
    }),
  },
});

bot.command('start', (ctx) => {
  ctx.reply(
    `Welcome ${escapeMarkdown(ctx.from.first_name)}! 
    
Commands:
  /start - Initialize bot
  /help - Show help menu
  /about - Bot information

🚀 Let's Start:
Send a Solana wallet address.`
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
  const userId = ctx.from.id;
  const user = getUser(userId);
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  if (user?.state === "awaiting_copy_target") {
    if (solanaAddressRegex.test(input)) {
      await clearUserState(userId);
      await ctx.replyWithMarkdownV2(
        `Confirm tracking :\n\`${escapeMarkdown(input)}\``,
        {
          reply_markup: subKeyTrackWallet(input)
        }
      );
    } else {
      await ctx.reply(`⚠️ Invalid address. Please enter a valid Solana wallet:`);
    }
    return;
  }

  if (solanaAddressRegex.test(input)) {
    await analyzeWallet(ctx, input);
  } else {
    await ctx.reply('⚠️ Invalid Solana address format');
  }
});

bot.action('livetrack_init', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdownV2(
      escapeMarkdown('Please enter the Solana wallet address you want to track:')
    );
    await setUserState(ctx.from.id, "awaiting_copy_target");
  } catch (err) {
    console.error('Track wallet error:', err);
    await ctx.answerCbQuery('⚠️ Error starting wallet track');
  }
});
bot.action(/^track_confirm_(.+)$/, async (ctx) => {
  try {
    const trackedWallet = ctx.match[1];
    const userId = ctx.from.id;
    console.log("tracking - ", trackedWallet);
    
    await updateUser(userId, {
      copyTarget: trackedWallet,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    
    await subscribeToTrackWallet(userId, trackedWallet);
    await ctx.editMessageText(
      `✅ Now copying trades from:\n\`${trackedWallet}\``,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (err) {
    console.error("track_confirm error:", err);
    await ctx.answerCbQuery("⚠️ Confirmation failed");
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
          .map((tx, index) =>
            `${index + 1}\\. ⌛ ${escapeMarkdown(new Date(tx.blockTime * 1000).toLocaleDateString())} \\- ${escapeMarkdown(tx.signature.substring(0, 8))}\\.\\.\\.`)
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
        response =
          `🔍 *Wallet Analysis* 🔍\n` +
          `\`${escapeMarkdown(walletAddress)}\`\n\n` +
          `*◎ SOL Balance* \\: ${escapeMarkdown(freshData.solBalance)}\n` +
          `*🪙 Total Tokens* \\: ${escapeMarkdown(freshData.tokens.total)}\n` +
          `├─ Fungible \\: ${escapeMarkdown(freshData.tokens.fungible)}\n` +
          `└─ NFTs \\: ${escapeMarkdown(freshData.tokens.nfts)}\n` +
          `*🔒 Staked Accounts* \\: ${escapeMarkdown(freshData.stakeAccounts)}\n` +
          `*📆 Recent Activity* \\: ${escapeMarkdown(freshData.recentTransactions.length)} TXs \\(Last 5\\)\n` +
          `Updated at \\: ${escapeMarkdown(new Date().toUTCString())}`;
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
  if (ctx && ctx.update && ctx.update.callback_query) {
    ctx.answerCbQuery('⚠️ Service unavailable. Try again later.');
  }
});
// bot.launch().then(()=>{console.log("Bot activated locally !")});
bot.launch({
  webhook: {
    domain: WEBHOOK_URL,
    hookPath: `/bot${process.env.BOT_TOKEN}`,
    port: PORT,
  }
}).then(() => {
  console.log(`Bot is listening through webhook `);
});

const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  bot.stop('SIGTERM');
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
