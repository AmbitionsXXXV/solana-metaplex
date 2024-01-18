import * as web3 from '@solana/web3.js'
import dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config() // 加载 .env 文件中的环境变量

export async function initializeKeypair(
  connection: web3.Connection,
): Promise<web3.Keypair> {
  // 检查环境变量中是否存在私钥
  if (!process.env.PRIVATE_KEY) {
    console.log('Creating .env file')
    // 如果不存在私钥，则生成一个新的密钥对
    const signer = web3.Keypair.generate()
    // 将生成的密钥对的私钥保存到 .env 文件中
    fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`)
    // 如果需要，向新生成的账户空投 SOL
    await airdropSolIfNeeded(signer, connection)

    return signer
  }

  // 从环境变量中读取私钥并创建密钥对
  const secret = JSON.parse(process.env.PRIVATE_KEY ?? '') as number[]
  const secretKey = Uint8Array.from(secret)
  const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey)
  // 如果需要，向该账户空投 SOL
  await airdropSolIfNeeded(keypairFromSecretKey, connection)

  return keypairFromSecretKey
}

async function airdropSolIfNeeded(
  signer: web3.Keypair,
  connection: web3.Connection,
) {
  // 获取账户当前的余额
  const balance = await connection.getBalance(signer.publicKey)

  console.log('Current balance is', balance / web3.LAMPORTS_PER_SOL)

  // 如果余额低于 1 SOL，则进行空投
  if (balance < web3.LAMPORTS_PER_SOL) {
    console.log('Airdropping 1 SOL...')

    // 请求空投 1 SOL
    const airdropSignature = await connection.requestAirdrop(
      signer.publicKey,
      web3.LAMPORTS_PER_SOL,
    )

    // 获取最新的区块哈希
    const latestBlockHash = await connection.getLatestBlockhash()

    // 确认交易
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    })

    // 获取新的余额
    const newBalance = await connection.getBalance(signer.publicKey)
    console.log('New balance is', newBalance / web3.LAMPORTS_PER_SOL)
  }
}
