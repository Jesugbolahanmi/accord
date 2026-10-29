// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AccordEscrow
 * @notice Peer-to-Peer Crypto Escrow Contract for Accord ("Trade on agreed terms").
 *
 * Security & Authorization Rules:
 * 1. Role Separation: Buyer (depositor), Seller (recipient), and optional neutral Arbiter.
 *    Arbiter can NEVER be Buyer or Seller (prevents self-arbitration).
 * 2. Deposit: Only Buyer can deposit exact agreed `amount` while in `AwaitingDeposit` before `deadline`.
 * 3. Mutual Approval / Release:
 *    - Seller calls `confirmFulfillment(tradeId, proofHash)` to attest off-chain/on-chain delivery (`Funded -> ReadyForRelease`).
 *    - Buyer calls `approveRelease(tradeId)` to release funds to Seller (`Funded/ReadyForRelease -> Completed`).
 * 4. Refund Rules:
 *    - Seller can voluntarily call `refund(tradeId)` at any time while `Funded` or `ReadyForRelease`.
 *    - Buyer can call `claimExpiredRefund(tradeId)` ONLY after `deadline` has passed AND while state is still `Funded` (no fulfillment confirmed, no active dispute).
 * 5. Dispute & Resolution:
 *    - Either Buyer or Seller can call `raiseDispute(tradeId, evidenceHash, reason)` while `Funded` or `ReadyForRelease`, locking funds in `Disputed`.
 *    - If a neutral `arbiter` (`!= address(0)`) was appointed, only `arbiter` can execute `resolveDispute(tradeId, buyerPayout, sellerPayout)`.
 *    - Both Buyer and Seller can always resolve a `Disputed` trade by mutual agreement via `proposeMutualSettlement` + `acceptMutualSettlement`.
 */
contract AccordEscrow {
    enum TradeState {
        Draft,              // 0
        AwaitingAcceptance, // 1
        AwaitingDeposit,    // 2
        Funded,             // 3
        AwaitingConditions, // 4
        ReadyForRelease,    // 5
        Completed,          // 6
        Disputed,           // 7
        Refunded,           // 8
        Expired             // 9
    }

    struct Trade {
        bytes32 id;
        string tradeRef;
        address payable buyer;
        address payable seller;
        address arbiter;
        uint256 amount;
        uint256 createdAt;
        uint256 deadline;
        bytes32 termsHash;
        bytes32 fulfillmentProofHash;
        bytes32 disputeEvidenceHash;
        TradeState state;
        bool buyerApproved;
        bool sellerApproved;
    }

    struct SettlementProposal {
        address proposedBy;
        uint256 buyerPayout;
        uint256 sellerPayout;
        bool active;
    }

    mapping(bytes32 => Trade) public trades;
    mapping(string => bytes32) public tradeRefToId;
    mapping(bytes32 => SettlementProposal) public settlementProposals;

    // Reentrancy guard
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // Events
    event TradeCreated(
        bytes32 indexed tradeId,
        string tradeRef,
        address indexed buyer,
        address indexed seller,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        bytes32 termsHash
    );
    event TradeDeposited(bytes32 indexed tradeId, address indexed buyer, uint256 amount);
    event FulfillmentConfirmed(bytes32 indexed tradeId, address indexed seller, bytes32 fulfillmentProofHash);
    event TradeReleased(bytes32 indexed tradeId, address indexed seller, uint256 amount);
    event TradeRefunded(bytes32 indexed tradeId, address indexed buyer, uint256 amount, string reason);
    event TradeDisputed(bytes32 indexed tradeId, address indexed initiator, bytes32 evidenceHash, string reason);
    event DisputeResolved(bytes32 indexed tradeId, address indexed resolvedBy, uint256 buyerPayout, uint256 sellerPayout);
    event MutualSettlementProposed(bytes32 indexed tradeId, address indexed proposer, uint256 buyerPayout, uint256 sellerPayout);

    // Custom Errors
    error ReentrancyGuardReentrantCall();
    error Unauthorized();
    error InvalidParties();
    error InvalidArbiter();
    error InvalidAmount();
    error InvalidPayoutSplit();
    error InvalidState(TradeState current, TradeState expected);
    error DeadlinePassed();
    error DeadlineNotPassed();
    error TradeAlreadyExists();
    error TradeNotFound();
    error NoActiveSettlementProposal();
    error TransferFailed();

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor() {
        _status = _NOT_ENTERED;
    }

    function computeTradeId(string memory tradeRef, address buyer) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tradeRef, buyer));
    }

    /**
     * @notice Initialize an agreed trade in escrow
     */
    function createTrade(
        string memory tradeRef,
        address payable seller,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        bytes32 termsHash
    ) external returns (bytes32 tradeId) {
        if (amount == 0) revert InvalidAmount();
        if (seller == address(0) || seller == msg.sender) revert InvalidParties();
        if (arbiter != address(0) && (arbiter == msg.sender || arbiter == seller)) {
            revert InvalidArbiter();
        }
        if (deadline <= block.timestamp) revert DeadlinePassed();

        tradeId = computeTradeId(tradeRef, msg.sender);
        if (trades[tradeId].id != bytes32(0)) revert TradeAlreadyExists();

        trades[tradeId] = Trade({
            id: tradeId,
            tradeRef: tradeRef,
            buyer: payable(msg.sender),
            seller: seller,
            arbiter: arbiter, // Remains address(0) if no neutral third-party arbiter is appointed
            amount: amount,
            createdAt: block.timestamp,
            deadline: deadline,
            termsHash: termsHash,
            fulfillmentProofHash: bytes32(0),
            disputeEvidenceHash: bytes32(0),
            state: TradeState.AwaitingDeposit,
            buyerApproved: false,
            sellerApproved: false
        });

        tradeRefToId[tradeRef] = tradeId;

        emit TradeCreated(tradeId, tradeRef, msg.sender, seller, arbiter, amount, deadline, termsHash);
    }

    /**
     * @notice Buyer locks exact agreed funds into escrow
     */
    function deposit(bytes32 tradeId) external payable nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.buyer) revert Unauthorized();
        if (trade.state != TradeState.AwaitingDeposit) {
            revert InvalidState(trade.state, TradeState.AwaitingDeposit);
        }
        if (msg.value != trade.amount) revert InvalidAmount();
        if (block.timestamp > trade.deadline) revert DeadlinePassed();

        trade.state = TradeState.Funded;
        emit TradeDeposited(tradeId, msg.sender, msg.value);
    }

    /**
     * @notice Seller attests fulfillment of settlement conditions and anchors proof hash
     */
    function confirmFulfillment(bytes32 tradeId, bytes32 fulfillmentProofHash) external {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.seller) revert Unauthorized();
        if (trade.state != TradeState.Funded && trade.state != TradeState.AwaitingConditions) {
            revert InvalidState(trade.state, TradeState.Funded);
        }

        trade.sellerApproved = true;
        trade.fulfillmentProofHash = fulfillmentProofHash;
        trade.state = TradeState.ReadyForRelease;

        emit FulfillmentConfirmed(tradeId, msg.sender, fulfillmentProofHash);
    }

    /**
     * @notice Buyer approves release of escrowed funds to Seller
     */
    function approveRelease(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.buyer) revert Unauthorized();
        if (trade.state != TradeState.Funded && trade.state != TradeState.ReadyForRelease) {
            revert InvalidState(trade.state, TradeState.ReadyForRelease);
        }

        trade.buyerApproved = true;
        trade.state = TradeState.Completed;
        uint256 payout = trade.amount;

        (bool success, ) = trade.seller.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit TradeReleased(tradeId, trade.seller, payout);
    }

    /**
     * @notice Seller voluntarily refunds Buyer
     */
    function refund(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.seller) revert Unauthorized();
        if (trade.state != TradeState.Funded && trade.state != TradeState.ReadyForRelease) {
            revert InvalidState(trade.state, TradeState.Funded);
        }

        trade.state = TradeState.Refunded;
        uint256 refundAmount = trade.amount;

        (bool success, ) = trade.buyer.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit TradeRefunded(tradeId, trade.buyer, refundAmount, "VOLUNTARY_SELLER_REFUND");
    }

    /**
     * @notice Buyer reclaims funds if deadline expired while still in Funded state (unfulfilled & undisputed)
     */
    function claimExpiredRefund(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.buyer) revert Unauthorized();
        if (trade.state != TradeState.Funded) {
            revert InvalidState(trade.state, TradeState.Funded);
        }
        if (block.timestamp <= trade.deadline) revert DeadlineNotPassed();

        trade.state = TradeState.Expired;
        uint256 refundAmount = trade.amount;

        (bool success, ) = trade.buyer.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit TradeRefunded(tradeId, trade.buyer, refundAmount, "DEADLINE_EXPIRED");
    }

    /**
     * @notice Buyer or Seller locks trade in Disputed state with cryptographic evidence hash
     */
    function raiseDispute(bytes32 tradeId, bytes32 evidenceHash, string calldata reason) external {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.buyer && msg.sender != trade.seller) revert Unauthorized();
        if (trade.state != TradeState.Funded &&
            trade.state != TradeState.AwaitingConditions &&
            trade.state != TradeState.ReadyForRelease) {
            revert InvalidState(trade.state, TradeState.Funded);
        }

        trade.state = TradeState.Disputed;
        trade.disputeEvidenceHash = evidenceHash;

        emit TradeDisputed(tradeId, msg.sender, evidenceHash, reason);
    }

    /**
     * @notice Designated neutral Arbiter resolves a Disputed trade
     */
    function resolveDispute(
        bytes32 tradeId,
        uint256 buyerPayout,
        uint256 sellerPayout
    ) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (trade.arbiter == address(0) || msg.sender != trade.arbiter) revert Unauthorized();
        if (trade.state != TradeState.Disputed) {
            revert InvalidState(trade.state, TradeState.Disputed);
        }
        if (buyerPayout + sellerPayout != trade.amount) revert InvalidPayoutSplit();

        trade.state = buyerPayout == trade.amount ? TradeState.Refunded : TradeState.Completed;

        if (buyerPayout > 0) {
            (bool okBuyer, ) = trade.buyer.call{value: buyerPayout}("");
            if (!okBuyer) revert TransferFailed();
        }
        if (sellerPayout > 0) {
            (bool okSeller, ) = trade.seller.call{value: sellerPayout}("");
            if (!okSeller) revert TransferFailed();
        }

        emit DisputeResolved(tradeId, msg.sender, buyerPayout, sellerPayout);
    }

    /**
     * @notice Propose a mutual settlement split during a dispute (works with or without an arbiter)
     */
    function proposeMutualSettlement(
        bytes32 tradeId,
        uint256 buyerPayout,
        uint256 sellerPayout
    ) external {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (msg.sender != trade.buyer && msg.sender != trade.seller) revert Unauthorized();
        if (trade.state != TradeState.Disputed) {
            revert InvalidState(trade.state, TradeState.Disputed);
        }
        if (buyerPayout + sellerPayout != trade.amount) revert InvalidPayoutSplit();

        settlementProposals[tradeId] = SettlementProposal({
            proposedBy: msg.sender,
            buyerPayout: buyerPayout,
            sellerPayout: sellerPayout,
            active: true
        });

        emit MutualSettlementProposed(tradeId, msg.sender, buyerPayout, sellerPayout);
    }

    /**
     * @notice Counterparty accepts the proposed mutual settlement to resolve the dispute
     */
    function acceptMutualSettlement(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        if (trade.state != TradeState.Disputed) {
            revert InvalidState(trade.state, TradeState.Disputed);
        }

        SettlementProposal memory prop = settlementProposals[tradeId];
        if (!prop.active) revert NoActiveSettlementProposal();

        // Must be accepted by the OTHER participant
        address expectedAcceptor = (prop.proposedBy == trade.buyer) ? trade.seller : trade.buyer;
        if (msg.sender != expectedAcceptor) revert Unauthorized();

        delete settlementProposals[tradeId];
        trade.state = prop.buyerPayout == trade.amount ? TradeState.Refunded : TradeState.Completed;

        if (prop.buyerPayout > 0) {
            (bool okBuyer, ) = trade.buyer.call{value: prop.buyerPayout}("");
            if (!okBuyer) revert TransferFailed();
        }
        if (prop.sellerPayout > 0) {
            (bool okSeller, ) = trade.seller.call{value: prop.sellerPayout}("");
            if (!okSeller) revert TransferFailed();
        }

        emit DisputeResolved(tradeId, msg.sender, prop.buyerPayout, prop.sellerPayout);
    }

    function getTrade(bytes32 tradeId) external view returns (Trade memory) {
        Trade memory trade = trades[tradeId];
        if (trade.id == bytes32(0)) revert TradeNotFound();
        return trade;
    }
}
