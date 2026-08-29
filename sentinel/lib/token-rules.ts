import { Flag } from "./rules";

export function checkFundingSource(funding: any): Flag | null {
  if (!funding) return null;

  if (funding.type === "MIXER") {
    return {
      type: "MIXER_FUNDED_CREATOR",
      severity: "critical",
      message: `The token creator's initial funding came from a privacy mixer (${funding.name}). Scammers almost universally use mixers to hide their identities before deploying rug pulls.`,
    };
  }

  if (funding.type === "CEX") {
    return {
      type: "KYC_EXCHANGE_FUNDED",
      severity: "low",
      message: `The token creator was funded directly from a centralized exchange (${funding.name}), implying their identity is likely KYC'd. This significantly lowers the risk of a blatant rug pull.`,
    };
  }

  if (funding.type === "FRESH") {
    return {
      type: "ORPHAN_CREATOR_WALLET",
      severity: "medium",
      message: "The creator wallet has no traceable external funding history on-chain. It may have been funded internally by another smart contract to obscure origin.",
    };
  }

  return null;
}

export function checkWashTrading(washData: any): Flag | null {
  if (!washData || !washData.isWashTrading) return null;

  return {
    type: "WASH_TRADING_DETECTED",
    severity: "high",
    message: `Graph intelligence detected ${washData.pairsFound} instances of circular ping-pong transfers (A ↔ B) in the token's recent history. This is used to fake organic trading volume.`,
  };
}


export function checkTokenAge(firstTxTimestamp: number | null): Flag | null {
  if (!firstTxTimestamp) return null;

  const ageInDays = (Date.now() - firstTxTimestamp) / (1000 * 60 * 60 * 24);

  if (ageInDays < 3) {
    return {
      type: "NEW_TOKEN",
      severity: "medium",
      message: `Token contract was deployed only ${Math.floor(ageInDays)} day(s) ago — new tokens carry higher rug-pull risk.`,
    };
  }
  return null;
}

export function checkSuspiciousMetadata(metadata: any): Flag | null {
  const name = (metadata?.name || "").toLowerCase();
  const symbol = (metadata?.symbol || "").toLowerCase();
  const combined = `${name} ${symbol}`;

  const suspiciousPatterns = ["http", ".com", ".net", ".org", "claim", "t.me", "airdrop", "free"];
  const matched = suspiciousPatterns.some((p) => combined.includes(p));

  if (matched) {
    return {
      type: "SUSPICIOUS_TOKEN_METADATA",
      severity: "high",
      message: `This token's own name/symbol contains scam-style language or links — a strong indicator it's a phishing token, not a legitimate asset. (Name: "${metadata?.name}", Symbol: "${metadata?.symbol}")`,
    };
  }
  return null;
}

export function checkMissingMetadata(metadata: any): Flag | null {
  if (!metadata || (!metadata.name && !metadata.symbol)) {
    return {
      type: "MISSING_METADATA",
      severity: "medium",
      message: "This token has no name or symbol set — often a sign of an unfinished or low-effort deployment.",
    };
  }
  return null;
}

export function runGoPlusChecks(security: any): Flag[] {
  if (!security) return [];
  const flags: Flag[] = [];

  if (security.isHoneypot) {
    flags.push({
      type: "HONEYPOT",
      severity: "critical",
      message: "GoPlus Security confirmed this token is a honeypot — you can buy but cannot sell. Do not interact with this token.",
    });
  }

  if (security.cannotBuy) {
    flags.push({
      type: "CANNOT_BUY",
      severity: "critical",
      message: "This token cannot be purchased — trading is disabled. This is a critical red flag.",
    });
  }

  if (security.creatorMadeHoneypot) {
    flags.push({
      type: "CREATOR_MADE_HONEYPOT",
      severity: "high",
      message: "The creator of this token has previously deployed confirmed honeypot contracts. Extreme caution advised.",
    });
  }

  if (security.sellTax > 10) {
    flags.push({
      type: "HIGH_SELL_TAX",
      severity: "high",
      message: `This token has a ${security.sellTax}% sell tax — unusually high and a common mechanism used to trap buyers.`,
    });
  }

  if (security.buyTax > 10) {
    flags.push({
      type: "HIGH_BUY_TAX",
      severity: "high",
      message: `This token has a ${security.buyTax}% buy tax. High taxes are often used to drain value from traders.`,
    });
  }

  if (!security.isOpenSource) {
    flags.push({
      type: "UNVERIFIED_CONTRACT",
      severity: "medium",
      message: "This token's contract source code is not verified on-chain. You cannot inspect what the contract actually does.",
    });
  }

  if (!security.ownerRenounced) {
    flags.push({
      type: "OWNER_NOT_RENOUNCED",
      severity: "medium",
      message: `This token's contract still has an active owner (${security.ownerAddress?.slice(0, 8)}...). The owner can modify taxes, blacklist wallets, or pause trading.`,
    });
  }

  if (security.isProxy) {
    flags.push({
      type: "UPGRADEABLE_PROXY",
      severity: "medium",
      message: "This is a proxy/upgradeable contract. The underlying logic can be swapped out after deployment — including to add honeypot behaviour.",
    });
  }

  if (security.top10HolderPercent > 80) {
    flags.push({
      type: "HIGH_HOLDER_CONCENTRATION",
      severity: "medium",
      message: `The top 10 holders control ${security.top10HolderPercent}% of the unlocked supply. A coordinated sell from these wallets could crash the price.`,
    });
  }

  return flags;
}

export function runTokenChecks(
  metadata: any, 
  firstTxTimestamp: number | null,
  fundingSource?: any,
  washData?: any
): Flag[] {
  const flags: Flag[] = [];

  const suspiciousFlag = checkSuspiciousMetadata(metadata);
  if (suspiciousFlag) flags.push(suspiciousFlag);

  const metadataFlag = checkMissingMetadata(metadata);
  if (metadataFlag) flags.push(metadataFlag);

  const ageFlag = checkTokenAge(firstTxTimestamp);
  if (ageFlag) flags.push(ageFlag);

  const fundingFlag = checkFundingSource(fundingSource);
  if (fundingFlag) flags.push(fundingFlag);

  const washFlag = checkWashTrading(washData);
  if (washFlag) flags.push(washFlag);

  return flags;
}

