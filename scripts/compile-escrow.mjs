import { mkdir, readFile, writeFile } from "node:fs/promises";
import solc from "solc";

export async function compileAccordEscrow() {
  const source = await readFile(new URL("../contracts/AccordEscrow.sol", import.meta.url), "utf8");
  const input = {
    language: "Solidity",
    sources: { "AccordEscrow.sol": { content: source } },
    settings: {
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === "error") ?? [];

  if (errors.length > 0) {
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  }

  const contract = output.contracts?.["AccordEscrow.sol"]?.AccordEscrow;
  if (!contract?.evm.bytecode.object) {
    throw new Error("Solidity compiler did not produce AccordEscrow bytecode.");
  }

  const artifact = {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };

  if (process.argv.includes("--write")) {
    const outputDirectory = new URL("../contracts/artifacts/", import.meta.url);
    await mkdir(outputDirectory, { recursive: true });
    const artifactSource = [
      `export const ACCORD_ESCROW_DEPLOYMENT_ABI = ${JSON.stringify(artifact.abi, null, 2)} as const;`,
      `export const ACCORD_ESCROW_BYTECODE = ${JSON.stringify(artifact.bytecode)} as const;`,
      "",
    ].join("\n");
    await writeFile(new URL("AccordEscrow.ts", outputDirectory), artifactSource, "utf8");
  }

  return artifact;
}

if (process.argv.includes("--write")) {
  await compileAccordEscrow();
  console.log("Generated contracts/artifacts/AccordEscrow.ts");
}
