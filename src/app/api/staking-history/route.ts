import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  const history = await prisma.stakingTransaction.findMany({
    where: wallet ? { walletAddress: wallet } : undefined,
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return NextResponse.json(history);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { walletAddress, action, amount, rewardAmount, txHash } = body;

  if (!walletAddress || !action || !amount || rewardAmount === undefined || !txHash) {
    return NextResponse.json({ message: "Missing staking history fields" }, { status: 400 });
  }

  const prisma = getPrisma();
  const record = await prisma.stakingTransaction.upsert({
    where: { txHash },
    update: {},
    create: {
      walletAddress,
      action,
      amount,
      rewardAmount,
      txHash
    }
  });

  return NextResponse.json(record, { status: 201 });
}
