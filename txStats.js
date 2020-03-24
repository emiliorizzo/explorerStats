
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

console.log(`url: ${url}`)
console.log(`from block: ${fromBlock} to block: ${toBlock}`)
getData(fromBlock, toBlock)

async function getData (fromBlock, toBlock) {
  try {

    let txs = await getTransactionsFromBlock(fromBlock - 1)
    let { txId } = txs[0]
    await getTransactions(txId, toBlock)
    let data = Object.assign(DATA)
    for (let d in data) {
      data[d] = data[d].toString(10)
    }
    console.log(data)
  } catch (err) {
    console.error(err)
    process.exit(8)
  }
}

async function getTransactions (next) {
  try {
    let { pages, data } = await getNextTransactions(next)
    getTxData(data.filter(tx => {
      let { blockNumber } = tx
      return blockNumber <= toBlock && blockNumber >= fromBlock
    }))
    let blockNumber = data.find(tx => tx.blockNumber > toBlock)
    if (!blockNumber && pages.next) return getNextTransactions(pages.next)

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
    let path = `${url}/api?limit=500&module=transactions&action=getTransactions&prev=${next}`
    let res = await axios.get(path)
    let { data } = res
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

function help () {
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