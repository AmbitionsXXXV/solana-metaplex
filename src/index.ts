import {
  Metaplex,
  NftWithToken,
  bundlrStorage,
  keypairIdentity,
  toMetaplexFile,
} from '@metaplex-foundation/js'
import { Connection, PublicKey, Signer, clusterApiUrl } from '@solana/web3.js'
import * as fs from 'fs'
import { initializeKeypair } from './initializeKeypair'

// NFT的数据结构定义
interface NftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
}

// 集合NFT的数据结构定义
interface CollectionNftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
  isCollection: boolean
  collectionAuthority: Signer
}

// 示例数据：一个新NFT的数据
const nftData = {
  name: 'Name',
  symbol: 'SYMBOL',
  description: 'Description',
  sellerFeeBasisPoints: 0,
  imageFile: 'solana.png',
}

// 示例数据：更新现有NFT的数据
const updateNftData = {
  name: 'Update',
  symbol: 'UPDATE',
  description: 'Update Description',
  sellerFeeBasisPoints: 100,
  imageFile: 'success.png',
}

// 上传元数据的函数
async function uploadMetadata(
  metaplex: Metaplex,
  nftData: NftData,
): Promise<string> {
  // 读取文件到缓冲区
  const buffer = fs.readFileSync('src/' + nftData.imageFile)

  // 将缓冲区数据转换为 Metaplex 文件格式
  const file = toMetaplexFile(buffer, nftData.imageFile)

  // 上传图片并获取图片的 URI
  const imageUri = await metaplex.storage().upload(file)
  console.log('image uri:', imageUri)

  // 上传元数据并获取元数据的 URI（链下元数据）
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: nftData.name,
    symbol: nftData.symbol,
    description: nftData.description,
    image: imageUri,
  })

  console.log('metadata uri:', uri)

  return uri
}

// 创建NFT的函数
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData,
  collectionMint: PublicKey,
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // 元数据 URI
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
      collection: collectionMint,
    },
    { commitment: 'finalized' },
  )

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  )

  // 验证集合，确认我们的集合为官方认证的集合
  await metaplex.nfts().verifyCollection({
    mintAddress: nft.mint.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  })

  return nft
}

// 创建集合NFT的函数
async function createCollectionNft(
  metaplex: Metaplex,
  uri: string,
  data: CollectionNftData,
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // 元数据 URI，指向集合的描述、图像等信息
      name: data.name, // 集合的名称
      sellerFeeBasisPoints: data.sellerFeeBasisPoints, // 销售费用的基点，这里设置为 0
      symbol: data.symbol,
      isCollection: true, // 标记这个 NFT 为一个集合
    },
    { commitment: 'finalized' },
  )

  console.log(
    `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  )

  return nft
}

// 更新 NFT URI 的辅助函数
async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
) {
  // 使用 mint 地址查找 NFT
  // mintAddress 是你要更新的 NFT 的唯一标识符。每个 NFT 在创建时都会被赋予一个唯一的 mint 地址，可以用来检索和引用该 NFT
  const nft = await metaplex.nfts().findByMint({ mintAddress })

  // 更新 NFT 的元数据
  // 这个方法允许你同时更新 NFT 的链上和链下部分的元数据。链上元数据存储在区块链上，而链下元数据通常存储在外部服务器或服务（如 Arweave）上
  const { response } = await metaplex.nfts().update(
    {
      nftOrSft: nft, // 指定要更新的 NFT 对象。这个对象包含了 NFT 的当前信息和状态
      name: 'Updated Name', // 新的 NFT 名称。这将替换 NFT 元数据中的旧名称
      uri: uri, // 新的元数据 URI，指向更新后的链下元数据。这通常是一个指向 JSON 文件的 URL，该文件包含 NFT 的详细信息，如图片、描述等
      sellerFeeBasisPoints: 100, // 销售费用的基点，这里设置为 100。这表示销售 NFT 时，1% 的费用将支付给 NFT 的创建者
    },
    { commitment: 'finalized' }, // 指定交易的承诺等级为 finalized。这意味着交易将等待直到完全被区块链网络确认，以确保数据的一致性和安全性
  )

  // 打印更新后的 NFT 的 mint 地址
  // 这个地址可以用来在区块链浏览器中查看 NFT 的详细信息
  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  )

  // 打印交易详情的链接
  // 这个链接可以用来在区块链浏览器中查看更新元数据的交易详情
  console.log(
    `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
  )
}

// 主函数
async function main() {
  // 创建与集群 API 的新连接
  const connection = new Connection(clusterApiUrl('devnet'))

  // 初始化用户的密钥对
  const user = await initializeKeypair(connection)

  console.log('PublicKey:', user.publicKey.toBase58())

  // 创建Metaplex实例
  const metaplex = Metaplex.make(connection)
    // 使用密钥对身份（keypairIdentity）来签署交易
    // 这里的 user 是上面通过 initializeKeypair 新生成的密钥对，代表用户的身份
    .use(keypairIdentity(user))
    // 设置存储驱动（bundlrStorage），用于上传资产
    // 这里指定了 Bundlr 网络的地址和 Solana devnet的API URL
    // Bundlr是一个使用 Arweave 进行永久存储的服务，用于存储 NFT 的元数据和图像
    .use(
      bundlrStorage({
        address: 'https://devnet.bundlr.network',
        providerUrl: 'https://api.devnet.solana.com',
        timeout: 60000,
      }),
    )

  // 集合 NFT 数据
  const collectionNftData = {
    name: 'TestCollectionNFT',
    symbol: 'TEST',
    description: 'Test Description Collection',
    sellerFeeBasisPoints: 100,
    imageFile: 'success.png',
    isCollection: true,
    collectionAuthority: user,
  }

  // 上传集合 NFT 数据并获取元数据 URI
  const collectionUri = await uploadMetadata(metaplex, collectionNftData)

  // 使用辅助函数和元数据 URI 创建集合 NFT
  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData,
  )

  // 上传 NFT 数据并获取元数据 URI
  const uri = await uploadMetadata(metaplex, nftData)

  // 使用辅助函数和元数据 URI 创建 NFT
  const nft = await createNft(metaplex, uri, nftData, collectionNft.mint.address)

  // 上传更新后的 NFT 数据并获取新的元数据 URI
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // 使用辅助函数和新的元数据 URI 更新 NFT
  await updateNftUri(metaplex, updatedUri, nft.address)
}

// 运行主函数，并处理成功和错误情况
main()
  .then(() => {
    console.log('Finished successfully')
    process.exit(0)
  })
  .catch(error => {
    console.log(error)
    process.exit(1)
  })
