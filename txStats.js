
const axios = require('axios')
const BN = require('bn.js')
const url = process.env.url || 'https://backend.explorer.rsk.co'
const { isHexString, remove0x } = require('rsk-utils')
const fromBlock = parseInt(process.argv[2])
const toBlock = parseInt(process.argv[3])
const DATA = {
  txs: 0,
  gas: new BN(0),
  gasPrice: new BN(0),
  gasUsed: new BN(0),
  fee: new BN(0)
}


if (!fromBlock || !toBlock || !url) help()
if (fromBlock > toBlock) help(`'fromBlock' must be less than 'toBlock'`)

console.log(`url: ${url}`)
console.log(`from block: ${fromBlock} to block: ${toBlock}`)
getData(fromBlock, toBlock)

async function getData (fromBlock, toBlock) {
  try {
    let txs = await getTransactionsFromBlock(toBlock + 1)
    let { txId } = txs[txs.length - 1]
    await getTransactions(txId)
    printObj(DATA)
    let diffData = await getBlockData(fromBlock, toBlock)
    printObj(diffData)
  } catch (err) {
    console.error(err)
    process.exit(8)
  }
}

async function getBlockData (fromBlock, toBlock) {
  try {
    let [fromData, toData] = await Promise.all([getBlock(fromBlock), getBlock(toBlock)])
    return getDiff(fromData, toData)
  } catch (err) {
    return Promise.reject(err)
  }
}

function getDiff (from, to) {
  let time = to.timestamp - from.timestamp
  let difficulty = newBN(to.totalDifficulty).sub(newBN(from.totalDifficulty))
  let hashrate = difficulty.div(newBN(time))
  return { time, difficulty, hashrate }
}

async function getTransactions (next) {
  try {
    let { pages, data } = await getNextTransactions(next)
    let blockNumber = data.find(tx => tx.blockNumber > toBlock)
    getTxData(data.filter(tx => {
      let { blockNumber } = tx
      return blockNumber <= toBlock && blockNumber >= fromBlock
    }))
    if (!blockNumber && pages.next) return getTransactions(pages.next)
    else return
  } catch (err) {
    return Promise.reject(err)
  }
}

async function getTransactionsFromBlock (blockNumber) {
  try {
    let path = `${url}/api?module=transactions&action=getTransactionsByBlock&hashOrNumber=${blockNumber}`
    let res = await axios.get(path)
    let { data } = res.data
    return data
  } catch (err) {
    return Promise.reject(err)
  }
}

async function getNextTransactions (next) {
  try {
    let path = `${url}/api?limit=500&module=transactions&action=getTransactions&next=${next}`
    let res = await axios.get(path)
    let { data } = res
    return data
  } catch (err) {
    return Promise.reject(err)
  }
}

async function getBlock (hashOrNumber) {
  try {
    let path = `${url}/api?module=blocks&action=getBlock&hashOrNumber=${hashOrNumber}`
    let res = await axios.get(path)
    let { data } = res.data
    return data
  } catch (err) {
    return Promise.reject(err)
  }
}

function getTxData (txs) {
  txs = txs.filter(tx => tx.txType !== 'remasc')
  DATA.txs += txs.length
  for (let tx of txs) {
    let { gas, gasPrice, receipt } = tx
    let { gasUsed } = receipt
    // console.log({ gas, gasPrice, gasUsed })
    gas = newBN(gas)
    gasPrice = newBN(gasPrice)
    gasUsed = newBN(gasUsed)

    DATA.gas = DATA.gas.add(gas)
    DATA.gasPrice = DATA.gasPrice.add(gasPrice)
    DATA.gasUsed = DATA.gasUsed.add(gasUsed)
    DATA.fee = DATA.fee.add(gasUsed.mul(gasPrice))
  }
}


function newBN (number) {
  number = `${number}`
  number = isHexString(number) ? new BN(remove0x(number), 16) : new BN(number)
  return number
}

function help (msg) {
  if (msg) console.error(`ERROR: ${msg}`)
  const myName = process.argv[1].split('/').pop()
  console.log('')
  console.log(`Usage:`)
  console.log(`node ${myName} [fromBlock] [toBlock]`)
  console.log(`Example: node ${myName} 100 200`)
  console.log('')
  console.log(`To change explorer-api url:`)
  console.log(`export url=[explorer-api-url]`)
  console.log('')
  process.exit(0)
}

process.on('unhandledRejection', err => {
  console.error(err)
  process.exit(9)
})

function printObj (obj) {
  let o = Object.assign({}, obj)
  for (let p in o) {
    o[p] = o[p].toString()
  }
  console.log(o)
}