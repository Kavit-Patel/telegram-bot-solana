import { getDetailedWalletInfo } from './solana.js';

export function escapeMarkdown(text) {  
  return String(text).replace(/([_*\[\]()~`>#+\-|=|{}.!])/g, '\\$1');
}

export function createKeyboard(walletAddress) {
  return {
    inline_keyboard: [
      [
        { text: '📊 Token Analysis', callback_data: `tokens_${walletAddress}` },
        { text: '🖼 NFT Collection', callback_data: `nfts_${walletAddress}` }
      ],
      [
        { text: '📜 Transaction History', callback_data: `txs_${walletAddress}` },
        { text: '💹 Portfolio Value', callback_data: `value_${walletAddress}` }
      ],
      [
        { text: '🔄 Refresh Data', callback_data: `refresh_${walletAddress}` },
        { text: '🔁 Track Other Wallet',  callback_data: 'livetrack_init' }
      ]
    ]
  };
}
export function subKeyTrackWallet(targetWallet) {
  return {
    inline_keyboard: [
      [
        { 
          text: '✅ Confirm', 
          callback_data: `track_confirm_${targetWallet}`
        },
        { 
          text: '❌ Cancel', 
          callback_data: 'track_cancel'
        }
      ]
    ]
  };
}

export async function analyzeWallet(ctx, walletAddress) {
  try {
    await ctx.sendChatAction('typing');
    const data = await getDetailedWalletInfo(walletAddress);
    
    const mainMessage = `
🔍 *Wallet Analysis* 🔍
\`${escapeMarkdown(walletAddress)}\`

*◎ SOL Balance* \\: ${escapeMarkdown(data.solBalance)}
*🪙 Total Tokens* \\: ${escapeMarkdown(data.tokens.total)}
  ├─ Fungible \\: ${escapeMarkdown(data.tokens.fungible)}
  └─ NFTs \\: ${escapeMarkdown(data.tokens.nfts)}
*🔒 Staked Accounts* \\: ${escapeMarkdown(data.stakeAccounts)}
*📆 Recent Activity* \\: ${escapeMarkdown(data.recentTransactions.length)} TXs \\(Last 5\\)
    `.trim().replace(/ +/g, ' ');

    await ctx.replyWithMarkdownV2(mainMessage, {
      reply_markup: createKeyboard(walletAddress),
      disable_web_page_preview: true
    });

  } catch (err) {
    console.error('Analysis Error:', err);
    await ctx.reply('⚠️ Service temporarily unavailable. Please try again later.');
  }
}