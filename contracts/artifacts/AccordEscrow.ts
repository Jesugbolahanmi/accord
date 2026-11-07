export const ACCORD_ESCROW_DEPLOYMENT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "DeadlineNotPassed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DeadlinePassed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAmount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidArbiter",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidFulfillmentProof",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidParties",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPayoutSplit",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "enum AccordEscrow.TradeState",
        "name": "current",
        "type": "uint8"
      },
      {
        "internalType": "enum AccordEscrow.TradeState",
        "name": "expected",
        "type": "uint8"
      }
    ],
    "name": "InvalidState",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidTermsHash",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidTradeReference",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoActiveSettlementProposal",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TradeAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TradeNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Unauthorized",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "resolvedBy",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "buyerPayout",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sellerPayout",
        "type": "uint256"
      }
    ],
    "name": "DisputeResolved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "seller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "fulfillmentProofHash",
        "type": "bytes32"
      }
    ],
    "name": "FulfillmentConfirmed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proposer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "buyerPayout",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sellerPayout",
        "type": "uint256"
      }
    ],
    "name": "MutualSettlementProposed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tradeRef",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "seller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "arbiter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      }
    ],
    "name": "TradeCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "TradeDeposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "initiator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "evidenceHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "TradeDisputed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "TradeRefunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "seller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "TradeReleased",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "name": "acceptMutualSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "name": "approveRelease",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "name": "claimExpiredRefund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "tradeRef",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      }
    ],
    "name": "computeTradeId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "fulfillmentProofHash",
        "type": "bytes32"
      }
    ],
    "name": "confirmFulfillment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "tradeRef",
        "type": "string"
      },
      {
        "internalType": "address payable",
        "name": "seller",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "arbiter",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      }
    ],
    "name": "createTrade",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "name": "getTrade",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "id",
            "type": "bytes32"
          },
          {
            "internalType": "string",
            "name": "tradeRef",
            "type": "string"
          },
          {
            "internalType": "address payable",
            "name": "buyer",
            "type": "address"
          },
          {
            "internalType": "address payable",
            "name": "seller",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "arbiter",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "termsHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "fulfillmentProofHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "disputeEvidenceHash",
            "type": "bytes32"
          },
          {
            "internalType": "enum AccordEscrow.TradeState",
            "name": "state",
            "type": "uint8"
          },
          {
            "internalType": "bool",
            "name": "buyerApproved",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "sellerApproved",
            "type": "bool"
          }
        ],
        "internalType": "struct AccordEscrow.Trade",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "buyerPayout",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sellerPayout",
        "type": "uint256"
      }
    ],
    "name": "proposeMutualSettlement",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "evidenceHash",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "raiseDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      }
    ],
    "name": "refund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tradeId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "buyerPayout",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sellerPayout",
        "type": "uint256"
      }
    ],
    "name": "resolveDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "settlementProposals",
    "outputs": [
      {
        "internalType": "address",
        "name": "proposedBy",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "buyerPayout",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sellerPayout",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "name": "tradeRefToId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "trades",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "tradeRef",
        "type": "string"
      },
      {
        "internalType": "address payable",
        "name": "buyer",
        "type": "address"
      },
      {
        "internalType": "address payable",
        "name": "seller",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "arbiter",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "fulfillmentProofHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "disputeEvidenceHash",
        "type": "bytes32"
      },
      {
        "internalType": "enum AccordEscrow.TradeState",
        "name": "state",
        "type": "uint8"
      },
      {
        "internalType": "bool",
        "name": "buyerApproved",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "sellerApproved",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "version",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  }
] as const;
export const ACCORD_ESCROW_BYTECODE = "0x60808060405234601a5760016003556117cd908161001f8239f35b5f80fdfe60806040526004361015610011575f80fd5b5f3560e01c8062162420146113d457806335b1c650146111fc57806336f672741461110157806354fd4d50146110e65780637249fbb614610fca5780639d3471fa14610e98578063a3b1379914610c85578063b214faa514610bb4578063b4f738e214610a9a578063b75f18611461090b578063b91b2e6714610448578063e4f34c8014610378578063e91da3c01461031b578063ed786520146102c2578063f0b9487b146101255763ff68603e146100c8575f80fd5b34610121576020366003190112610121576004355f526002602052608060405f2060018060a01b038154169060018101549060ff6003600283015492015416916040519384526020840152604083015215156060820152f35b5f80fd5b346101215760603660031901126101215760443560043560243567ffffffffffffffff831161012157366023840112156101215782600401359267ffffffffffffffff841161012157366024858301011161012157825f525f60205260405f208054156102b35760028101546001600160a01b03163314158061029c575b61028e57600b810160ff815416600a8110158061026d5760038214159081610281575b8161025c575b5061023f575083927f6fec533ffd5bbfc6c082d83204340418921bed68b4ad2ce2aa2a5c05068e6ef994600a8894602494600760ff198254161790550155604051938452604060208501528260408501520160608301375f606085830101526060813395601f80199101168101030190a3005b633bf2e2f960e11b5f5261025290611647565b600360245260445ffd5b905061026d576005811415886101cc565b634e487b7160e01b5f52602160045260245ffd5b505060048114155f6101c6565b6282b42960e81b5f5260045ffd5b5060038101546001600160a01b03163314156101a3565b6318c2eb8160e21b5f5260045ffd5b346101215760403660031901126101215760043567ffffffffffffffff8111610121576102f3903690600401611698565b602435906001600160a01b03821682036101215760209161031391611746565b604051908152f35b346101215760203660031901126101215760043567ffffffffffffffff811161012157610365602061035281933690600401611698565b8160405193828580945193849201611601565b8101600181520301902054604051908152f35b346101215760403660031901126101215760043560243590805f525f60205260405f208054156102b35760038101546001600160a01b0316330361028e57600b810190815460ff8116600a81101561026d5760038114158061043d575b61023f5750841561042e5762ff0000191662010000178255600901839055805460ff1916600517905560405191825233917f6ea1f0f0c05faceb2ae307b209f916305fa5a4f0d7f1009d01bee99fe718d02c90602090a3005b63523a834d60e11b5f5260045ffd5b5060048114156103d5565b346101215760c03660031901126101215760043567ffffffffffffffff811161012157610479903690600401611698565b602435906001600160a01b038216820361012157604435906001600160a01b0382168203610121578051156108fc57606435156108ed5760a435156108de576001600160a01b0383161580156108cc575b6108bd576001600160a01b038216151580610896575b61088857426084351115610879576104f83382611746565b91825f525f60205260405f205415801590610851575b610842576040519361051f85611522565b83855282602086015233604086015260018060a01b038116606086015260018060a01b038216608086015260643560a08601524260c086015260843560e086015260a4356101008601525f6101208601525f61014086015260026101608601525f6101808601525f6101a0860152835f525f60205260405f208551815560018101602087015180519067ffffffffffffffff821161082e576105c183546114ce565b601f81116107e9575b50602090601f831160011461078257600b949392915f9183610777575b50508160011b915f199060031b1c19161790555b60408701516002820180546001600160a01b039283166001600160a01b0319918216179091556060890151600384018054918416918316919091179055608089015160048401805491909316911617905560a0870151600582015560c0870151600682015560e0870151600782015561010087015160088201556101208701516009820155610140870151600a80830191909155610160880151929091019691929083101561026d57866101a07fa5677541e1660f574b47c4b08efeef6df4889dae5baa2b63086097db74544519936106d7899660209b6116de565b6101808101518354929091015162ffff001990921690151560081b61ff00161790151560101b62ff00001617905560405185518491908990829061071e81838c8601611601565b810160018152030190205561073e6040519560a0875260a0870190611622565b6001600160a01b03948516868901526064356040870152608435606087015260a4356080870152931693339381900390a4604051908152f35b015190508a806105e7565b90601f19831691845f52815f20925f5b8181106107d15750916001939185600b98979694106107b9575b505050811b0190556105fb565b01515f1960f88460031b161c191690558a80806107ac565b92936020600181928786015181550195019301610792565b835f5260205f20601f840160051c81019160208510610824575b601f0160051c01905b81811061081957506105ca565b5f815560010161080c565b9091508190610803565b634e487b7160e01b5f52604160045260245ffd5b638f7308d360e01b5f5260045ffd5b5060405160208184516108678183858901611601565b8101600181520301902054151561050e565b63387b2e5560e11b5f5260045ffd5b62f0318560e81b5f5260045ffd5b506001600160a01b0382163314806104e057506001600160a01b03828116908416146104e0565b635b72807f60e11b5f5260045ffd5b506001600160a01b03831633146104ca565b6392a3c43160e01b5f5260045ffd5b63162908e360e11b5f5260045ffd5b6371272d1f60e11b5f5260045ffd5b346101215761091936611662565b600260039392935414610a8b576002600355815f525f60205260405f208054156102b35760048101546001600160a01b03168015908115610a80575b5061028e57600b81019060ff825416600a81101561026d5760078103610a6357506109808386611725565b6005820154809103610a545783926109a0918703610a4c576008906116de565b84610a21575b816109e6575b505060405192835260208301527f2e8e39bd838df355f6f1d78e5ab374e0b3d48804dbf1a48ac332223490c5497160403393a36001600355005b600301545f918291829182916001600160a01b03165af1610a056116f6565b5015610a125780846109ac565b6312171d8360e31b5f5260045ffd5b90505f8080808760018060a01b036002870154165af1610a3f6116f6565b5015610a125781906109a6565b6006906116de565b63c231e59f60e01b5f5260045ffd5b633bf2e2f960e11b5f52610a7690611647565b600760245260445ffd5b905033141585610955565b633ee5aeb560e01b5f5260045ffd5b3461012157602036600319011261012157600435600260035414610a8b576002600355805f525f60205260405f20908154156102b3576002820180549092906001600160a01b0316330361028e57600b81019060ff825416600a81101561026d576003810361023f57506007810154421115610ba557600591600960ff198254161790550154915f8080808660018060a01b038654165af1610b3a6116f6565b5015610a12575460408051938452602084018190526010908401526f111150511312539157d156141254915160821b60608401526001600160a01b0316917fc160456cc6ad9ebdfbcdde6dbb60fe55430f99973f61f71e38d2734188a9e34b90608090a36001600355005b6302eb354360e41b5f5260045ffd5b602036600319011261012157600435600260035414610a8b576002600355805f525f60205260405f208054156102b35760028101546001600160a01b0316330361028e57600b81019060ff825416600a81101561026d5760028103610c685750600581015434036108ed5760070154421161087957600360ff19825416179055604051903482527ff38f17b7e0bec656e6307ea58273ac23c4717c3af415c096d509a56897815a1760203393a36001600355005b633bf2e2f960e11b5f52610c7b90611647565b600260245260445ffd5b34610121576020366003190112610121575f6101a0604051610ca681611522565b828152606060208201528260408201528260608201528260808201528260a08201528260c08201528260e0820152826101008201528261012082015282610140820152826101608201528261018082015201526004355f525f60205260405f20604051610d1281611522565b81548152610d2260018301611561565b916020820192835260018060a01b03600282015416906040830191825260018060a01b036003820154166060840190815260018060a01b03600483015416906080850191825260058301549260a08601938452600681015460c08701908152600782015460e0880190815260088301549061010089019182526009840154926101208a01938452600b600a860154956101408c0196875201549760ff8916976101608c0197600a8a101561026d5760ff6101a08e8d9c8c528261018082019d60081c1615158d52019b60101c1615158b528c51156102b357604051809e819e6020835251602083015251604082016101c090526101e08201610e2391611622565b9c516001600160a01b039081166060909201919091529051811660808e015290511660a08c01525160c08b01525160e08a01525161010089015251610120880152516101408701525161016086015251610e8290610180860190611655565b5115156101a08401525115156101c08301520390f35b3461012157610ea636611662565b825f939293525f60205260405f208054156102b35760028101546001600160a01b031633141580610fb3575b61028e5760ff600b82015416600a81101561026d5760078103610a6357506005610efc8386611725565b91015403610a5457604051610f1081611506565b3381526003602082019185835260408101848152606082019360018552865f52600260205260405f209260018060a01b039060018060a01b03905116166bffffffffffffffffffffffff60a01b845416178355516001830155516002820155019051151560ff8019835416911617905560405192835260208301527f2840440d03043d8234c2b3787cb79afc17aa60ea29139c5938fed265da76d9cb60403393a3005b5060038101546001600160a01b0316331415610ed2565b3461012157602036600319011261012157600435600260035414610a8b576002600355805f525f60205260405f20908154156102b35760038201546001600160a01b0316330361028e57600b820160ff815416600a81101561026d576003811415806110db575b61023f5750600860ff198254161790556002600583015492015f8080808660018060a01b038654165af16110636116f6565b5015610a12575460408051938452602084018190526017908401527f564f4c554e544152595f53454c4c45525f524546554e4400000000000000000060608401526001600160a01b0316917fc160456cc6ad9ebdfbcdde6dbb60fe55430f99973f61f71e38d2734188a9e34b90608090a36001600355005b506005811415611031565b34610121575f36600319011261012157602060405160028152f35b3461012157602036600319011261012157600435600260035414610a8b576002600355805f525f60205260405f20908154156102b35760028201546001600160a01b0316330361028e57600b8201805460ff8116600a81101561026d57600581036111df575061ffff19166101061790556005820154600390920180545f9081908190819087906001600160a01b03165af161119b6116f6565b5015610a1257546040519283526001600160a01b0316917f0c06b859b06a80cfdd45d3c8a89169a7a4a2702d945389f65e35c13fd017fa0290602090a36001600355005b633bf2e2f960e11b5f526111f290611647565b600560245260445ffd5b3461012157602036600319011261012157600435600260035414610a8b576002600355805f525f60205260405f20908154156102b357600b820160ff815416600a81101561026d5760078103610a635750815f52600260205260405f20926040519161126783611506565b84546001600160a01b0316835260018501546020840190815260028601546040850190815260039096015460ff1615801560608601529093906113c557516002830180549092916001600160a01b03918216911681036113c0575060038301546001600160a01b03165b6001600160a01b0316330361028e5761131a90855f5260026020525f600360408220828155826001820155826002820155015584516005850154145f14610a4c576008906116de565b82519081611397575b50508351908161136b575b505051915160405192835260208301527f2e8e39bd838df355f6f1d78e5ab374e0b3d48804dbf1a48ac332223490c5497160403393a36001600355005b600301545f918291829182916001600160a01b03165af161138a6116f6565b5015610a1257838061132e565b545f918291829182916001600160a01b03165af16113b36116f6565b5015610a12578480611323565b6112d1565b6360b2335960e01b5f5260045ffd5b34610121576020366003190112610121576004355f525f6020526101c060405f2080549060ff61140660018301611561565b60018060a01b036002840154169260018060a01b0360038201541660018060a01b036004830154166005830154600684015460078501549160088601549360098701549561146f600b600a8a0154990154996040519e8f9e8f9081528160208201520190611622565b9a60408d015260608c015260808b015260a08a015260c089015260e08801526101008701526101208601526101408501526114b06101608501838316611655565b818160081c16151561018085015260101c1615156101a08301520390f35b90600182811c921680156114fc575b60208310146114e857565b634e487b7160e01b5f52602260045260245ffd5b91607f16916114dd565b6080810190811067ffffffffffffffff82111761082e57604052565b6101c0810190811067ffffffffffffffff82111761082e57604052565b90601f8019910116810190811067ffffffffffffffff82111761082e57604052565b9060405191825f825492611574846114ce565b80845293600181169081156115df575060011461159b575b506115999250038361153f565b565b90505f9291925260205f20905f915b8183106115c3575050906020611599928201015f61158c565b60209193508060019154838589010152019101909184926115aa565b90506020925061159994915060ff191682840152151560051b8201015f61158c565b5f5b8381106116125750505f910152565b8181015183820152602001611603565b9060209161163b81518092818552858086019101611601565b601f01601f1916010190565b600a81101561026d57600452565b90600a82101561026d5752565b606090600319011261012157600435906024359060443590565b67ffffffffffffffff811161082e57601f01601f191660200190565b81601f82011215610121578035906116af8261167c565b926116bd604051948561153f565b8284526020838301011161012157815f926020809301838601378301015290565b90600a81101561026d5760ff80198354169116179055565b3d15611720573d906117078261167c565b91611715604051938461153f565b82523d5f602084013e565b606090565b9190820180921161173257565b634e487b7160e01b5f52601160045260245ffd5b90611791601460206040518094826117678184019889815193849201611601565b8201906bffffffffffffffffffffffff199060601b16838201520301600b1981018452018261153f565b5190209056fea264697066735822122030ba5b8a88862264c3a572dcf7256f91c41b64dc5e28bbb1334e429b39e4945864736f6c634300081e0033" as const;
