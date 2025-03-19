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
const limit = 1000; // 每次请求最大获取1000条K线数据
const totalRequiredKlines = 15000; // 总共需要获取的K线数据数量
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
    console.log(`正在获取 ${symbol} 的 ${interval} K线数据，总计 ${totalRequiredKlines} 条...`);
    
    let allKlineData = [];
    let endTime = Date.now(); // 当前时间作为初始结束时间
    
    // 计算需要请求的批次数
    const batchCount = Math.ceil(totalRequiredKlines / limit);
    
    for (let i = 0; i < batchCount; i++) {
      console.log(`正在获取第 ${i + 1}/${batchCount} 批数据...`);
      
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        params: {
          symbol,
          interval,
          limit,
          endTime // 使用上一批次的第一条数据的时间作为结束时间
        },
        httpsAgent,
        timeout: 30000 // 30秒超时
      });
      
      if (response.data.length === 0) {
        console.log('没有更多数据可获取');
        break;
      }
      
      const batchData = response.data.map(kline => ({
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
      
      allKlineData = [...batchData, ...allKlineData]; // 将新数据添加到前面，保持时间顺序
      
      // 更新结束时间为当前批次中最早的K线的开盘时间减1毫秒
      if (batchData.length > 0) {
        endTime = batchData[0].openTime - 1;
      }
      
      // 添加延迟，避免触发API限制
      if (i < batchCount - 1) {
        console.log('等待1秒后继续请求...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 如果获取的数据超过了需要的数量，只保留需要的部分
    if (allKlineData.length > totalRequiredKlines) {
      allKlineData = allKlineData.slice(0, totalRequiredKlines);
    }

    // 保存数据到JSON文件
    fs.writeFileSync(filePath, JSON.stringify(allKlineData, null, 2));
    
    console.log(`成功获取 ${allKlineData.length} 条K线数据并保存到 ${filePath}`);
    return allKlineData;
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