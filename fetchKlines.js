const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 代理配置
const proxy = 'http://127.0.0.1:4780';
const httpsAgent = new HttpsProxyAgent(proxy);

// 币安API配置
const symbol = 'BTCUSDT';
const interval = '15m';
const limit = 1500; // 最大获取1500条K线数据
const baseUrl = 'https://api.binance.com';
const endpoint = '/api/v3/klines';

// 存储文件路径
const dataDir = path.join(__dirname, 'data');
const filePath = path.join(dataDir, `${symbol}_${interval}_klines.json`);

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function fetchKlineData() {
  try {
    console.log(`正在获取 ${symbol} 的 ${interval} K线数据...`);
    
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      params: {
        symbol,
        interval,
        limit
      },
      httpsAgent,
      timeout: 30000 // 30秒超时
    });

    const klineData = response.data.map(kline => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteAssetVolume: kline[7],
      numberOfTrades: kline[8],
      takerBuyBaseAssetVolume: kline[9],
      takerBuyQuoteAssetVolume: kline[10]
    }));

    // 保存数据到JSON文件
    fs.writeFileSync(filePath, JSON.stringify(klineData, null, 2));
    
    console.log(`成功获取 ${klineData.length} 条K线数据并保存到 ${filePath}`);
    return klineData;
  } catch (error) {
    console.error('获取K线数据失败:', error.message);
    if (error.response) {
      console.error('API响应:', error.response.data);
    }
    throw error;
  }
}

// 执行获取K线数据的函数
fetchKlineData()
  .then(() => console.log('程序执行完成'))
  .catch(err => console.error('程序执行失败:', err)); 