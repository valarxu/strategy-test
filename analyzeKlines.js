const fs = require('fs');
const path = require('path');

// 数据文件路径
const dataFilePath = path.join(__dirname, 'data', 'BTCUSDT_15m_klines.json');

// 分析结果保存路径
const resultFilePath = path.join(__dirname, 'data', 'analysis_result.json');

// 读取K线数据
function readKlineData() {
  try {
    const rawData = fs.readFileSync(dataFilePath);
    return JSON.parse(rawData);
  } catch (error) {
    console.error('读取K线数据失败:', error.message);
    throw error;
  }
}

// 计算EMA14
function calculateEMA(data, period = 14) {
  const k = 2 / (period + 1);
  const emaResults = [];
  
  // 使用第一个数据点的收盘价作为初始EMA
  let ema = parseFloat(data[0].close);
  emaResults.push({ ...data[0], ema });
  
  // 计算剩余点的EMA
  for (let i = 1; i < data.length; i++) {
    const close = parseFloat(data[i].close);
    ema = (close - ema) * k + ema;
    emaResults.push({ ...data[i], ema });
  }
  
  return emaResults;
}

// 统计K线与EMA的关系
function analyzeEMARelationship(data) {
  let aboveEMA = 0;
  let belowEMA = 0;
  let crossingEMA = 0;
  
  for (const candle of data) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const ema = candle.ema;
    
    // 如果开盘价和收盘价都在EMA之上
    if (open > ema && close > ema) {
      aboveEMA++;
    }
    // 如果开盘价和收盘价都在EMA之下
    else if (open < ema && close < ema) {
      belowEMA++;
    }
    // 如果开盘价和收盘价在EMA的不同侧，则认为是横穿EMA
    else {
      crossingEMA++;
    }
  }
  
  return {
    totalCandles: data.length,
    aboveEMA,
    belowEMA,
    crossingEMA,
    aboveEMAPercentage: (aboveEMA / data.length * 100).toFixed(2),
    belowEMAPercentage: (belowEMA / data.length * 100).toFixed(2),
    crossingEMAPercentage: (crossingEMA / data.length * 100).toFixed(2)
  };
}

// 分析连续趋势
function analyzeTrends(data) {
  try {
    // 为每个K线标记位置状态：1=上方，-1=下方，0=横穿
    const candleStates = data.map(candle => {
      const open = parseFloat(candle.open);
      const close = parseFloat(candle.close);
      const ema = candle.ema;
      
      if (open > ema && close > ema) return 1; // 上方
      if (open < ema && close < ema) return -1; // 下方
      return 0; // 横穿
    });
    
    // 定义趋势类型
    const UPTREND = 1;
    const DOWNTREND = -1;
    const OSCILLATION = 0;
    
    // 保存趋势统计
    const trends = {
      uptrends: [], // 保存每次上升趋势的持续K线数
      downtrends: [], // 保存每次下降趋势的持续K线数
      oscillations: [] // 保存每次震荡趋势的持续K线数
    };
    
    // 保存趋势涨跌幅
    const trendChanges = {
      uptrends: [], // 保存每次上升趋势的涨幅
      downtrends: [], // 保存每次下降趋势的跌幅
      oscillations: [] // 保存每次震荡趋势的波幅
    };
    
    // 保存趋势过程中的最大涨跌幅
    const trendMaxChanges = {
      uptrends: [], // 保存每次上升趋势过程中的最大涨幅
      downtrends: [] // 保存每次下降趋势过程中的最大跌幅
    };
    
    // 初始化
    let currentTrend = null;
    let currentTrendStart = 0;
    let consecutiveCount = 1;
    
    // 确定初始状态
    if (candleStates[0] === 1 && candleStates[1] === 1) {
      currentTrend = UPTREND;
    } else if (candleStates[0] === -1 && candleStates[1] === -1) {
      currentTrend = DOWNTREND;
    } else {
      currentTrend = OSCILLATION;
    }
    
    // 分析趋势变化
    for (let i = 1; i < candleStates.length; i++) {
      const currentState = candleStates[i];
      const previousState = candleStates[i-1];
      
      // 继续当前上升趋势
      if (currentTrend === UPTREND && currentState === 1) {
        consecutiveCount++;
      }
      // 继续当前下降趋势
      else if (currentTrend === DOWNTREND && currentState === -1) {
        consecutiveCount++;
      }
      // 继续当前震荡趋势
      else if (currentTrend === OSCILLATION && 
              !((currentState === 1 && previousState === 1) || 
                (currentState === -1 && previousState === -1))) {
        consecutiveCount++;
      }
      // 趋势变化
      else {
        // 计算趋势期间的价格变化百分比
        if (consecutiveCount > 1) {
          const startPrice = parseFloat(data[currentTrendStart].open);
          const endPrice = parseFloat(data[i-1].close);
          const priceChangePercent = ((endPrice - startPrice) / startPrice) * 100;
          
          // 计算趋势过程中的最大涨跌幅
          let maxChange = 0;
          let minChange = 0;
          
          // 遍历趋势期间的所有K线，找出相对于起始价格的最大涨幅或跌幅
          for (let j = currentTrendStart; j < i; j++) {
            const close = parseFloat(data[j].close);
            const changePercent = ((close - startPrice) / startPrice) * 100;
            
            if (currentTrend === UPTREND) {
              // 上升趋势找最大涨幅
              if (changePercent > maxChange) {
                maxChange = changePercent;
              }
            } else if (currentTrend === DOWNTREND) {
              // 下降趋势找最大跌幅（最小值）
              if (changePercent < minChange) {
                minChange = changePercent;
              }
            }
          }
          
          // 记录之前的趋势和价格变化
          if (currentTrend === UPTREND) {
            trends.uptrends.push(consecutiveCount);
            trendChanges.uptrends.push(priceChangePercent);
            trendMaxChanges.uptrends.push(maxChange);
          } else if (currentTrend === DOWNTREND) {
            trends.downtrends.push(consecutiveCount);
            trendChanges.downtrends.push(priceChangePercent);
            trendMaxChanges.downtrends.push(minChange);
          } else {
            trends.oscillations.push(consecutiveCount);
            trendChanges.oscillations.push(Math.abs(priceChangePercent)); // 震荡使用绝对值
          }
        }
        
        // 开始新趋势
        if (i < candleStates.length - 1) {
          if (currentState === 1 && candleStates[i+1] === 1) {
            currentTrend = UPTREND;
          } else if (currentState === -1 && candleStates[i+1] === -1) {
            currentTrend = DOWNTREND;
          } else {
            currentTrend = OSCILLATION;
          }
        } else {
          // 处理最后一个K线的特殊情况
          if (currentState === 1 && previousState === 1) {
            currentTrend = UPTREND;
          } else if (currentState === -1 && previousState === -1) {
            currentTrend = DOWNTREND;
          } else {
            currentTrend = OSCILLATION;
          }
        }
        
        consecutiveCount = 1;
        currentTrendStart = i;
      }
    }
    
    // 记录最后一次趋势
    if (consecutiveCount > 1) {
      const startPrice = parseFloat(data[currentTrendStart].open);
      const endPrice = parseFloat(data[data.length-1].close);
      const priceChangePercent = ((endPrice - startPrice) / startPrice) * 100;
      
      // 计算趋势过程中的最大涨跌幅
      let maxChange = 0;
      let minChange = 0;
      
      // 遍历趋势期间的所有K线，找出相对于起始价格的最大涨幅或跌幅
      for (let j = currentTrendStart; j < data.length; j++) {
        const close = parseFloat(data[j].close);
        const changePercent = ((close - startPrice) / startPrice) * 100;
        
        if (currentTrend === UPTREND) {
          // 上升趋势找最大涨幅
          if (changePercent > maxChange) {
            maxChange = changePercent;
          }
        } else if (currentTrend === DOWNTREND) {
          // 下降趋势找最大跌幅（最小值）
          if (changePercent < minChange) {
            minChange = changePercent;
          }
        }
      }
      
      if (currentTrend === UPTREND) {
        trends.uptrends.push(consecutiveCount);
        trendChanges.uptrends.push(priceChangePercent);
        trendMaxChanges.uptrends.push(maxChange);
      } else if (currentTrend === DOWNTREND) {
        trends.downtrends.push(consecutiveCount);
        trendChanges.downtrends.push(priceChangePercent);
        trendMaxChanges.downtrends.push(minChange);
      } else {
        trends.oscillations.push(consecutiveCount);
        trendChanges.oscillations.push(Math.abs(priceChangePercent)); // 震荡使用绝对值
      }
    }
    
    // 统计涨跌幅分布 - 更细分的统计区间
    const uptrendDistribution = {
      negative: 0,        // 小于0%
      veryTiny: 0,        // 0-0.25%
      tiny: 0,            // 0.25-0.5%
      verySmall: 0,       // 0.5-0.75%
      small: 0,           // 0.75-1%
      mediumSmall: 0,     // 1-1.5%
      medium: 0,          // 1.5-2%
      large: 0,           // >2%
    };
    
    const downtrendDistribution = {
      positive: 0,        // >0%
      veryTiny: 0,        // 0至-0.25%
      tiny: 0,            // -0.25%至-0.5%
      verySmall: 0,       // -0.5%至-0.75%
      small: 0,           // -0.75%至-1%
      mediumSmall: 0,     // -1%至-1.5%
      medium: 0,          // -1.5%至-2%
      large: 0,           // <-2%
    };
    
    const oscillationDistribution = {
      veryTiny: 0,        // 0-0.25%
      tiny: 0,            // 0.25-0.5%
      verySmall: 0,       // 0.5-0.75%
      small: 0,           // 0.75-1%
      mediumSmall: 0,     // 1-1.5%
      medium: 0,          // 1.5-2%
      large: 0,           // >2%
    };
    
    // 统计上升趋势涨幅分布 - 更细分的区间判断
    trendChanges.uptrends.forEach(change => {
      if (change < 0) uptrendDistribution.negative++;
      else if (change < 0.25) uptrendDistribution.veryTiny++;
      else if (change < 0.5) uptrendDistribution.tiny++;
      else if (change < 0.75) uptrendDistribution.verySmall++;
      else if (change < 1) uptrendDistribution.small++;
      else if (change < 1.5) uptrendDistribution.mediumSmall++;
      else if (change < 2) uptrendDistribution.medium++;
      else uptrendDistribution.large++;
    });
    
    // 统计下降趋势跌幅分布 - 更细分的区间判断
    trendChanges.downtrends.forEach(change => {
      if (change > 0) downtrendDistribution.positive++;
      else if (change > -0.25) downtrendDistribution.veryTiny++;
      else if (change > -0.5) downtrendDistribution.tiny++;
      else if (change > -0.75) downtrendDistribution.verySmall++;
      else if (change > -1) downtrendDistribution.small++;
      else if (change > -1.5) downtrendDistribution.mediumSmall++;
      else if (change > -2) downtrendDistribution.medium++;
      else downtrendDistribution.large++;
    });
    
    // 统计震荡趋势波幅分布 - 更细分的区间判断
    trendChanges.oscillations.forEach(change => {
      if (change < 0.25) oscillationDistribution.veryTiny++;
      else if (change < 0.5) oscillationDistribution.tiny++;
      else if (change < 0.75) oscillationDistribution.verySmall++;
      else if (change < 1) oscillationDistribution.small++;
      else if (change < 1.5) oscillationDistribution.mediumSmall++;
      else if (change < 2) oscillationDistribution.medium++;
      else oscillationDistribution.large++;
    });
    
    // 计算平均涨跌幅，确保有数据时才计算
    let uptrendAvgChange = 0;
    let downtrendAvgChange = 0;
    let oscillationAvgChange = 0;
    
    console.log('上升趋势涨幅数据:', trendChanges.uptrends);
    console.log('下降趋势跌幅数据:', trendChanges.downtrends);
    console.log('震荡趋势波幅数据:', trendChanges.oscillations);
    
    if (trendChanges.uptrends.length > 0) {
      uptrendAvgChange = trendChanges.uptrends.reduce((sum, change) => sum + change, 0) / trendChanges.uptrends.length;
    }
    
    if (trendChanges.downtrends.length > 0) {
      downtrendAvgChange = trendChanges.downtrends.reduce((sum, change) => sum + change, 0) / trendChanges.downtrends.length;
    }
    
    if (trendChanges.oscillations.length > 0) {
      oscillationAvgChange = trendChanges.oscillations.reduce((sum, change) => sum + change, 0) / trendChanges.oscillations.length;
    }
    
    console.log('上升趋势平均涨幅:', uptrendAvgChange);
    console.log('下降趋势平均跌幅:', downtrendAvgChange);
    console.log('震荡趋势平均波幅:', oscillationAvgChange);
    
    // 统计最大涨幅大于0.5%的上升趋势次数和最大跌幅小于-0.5%的下跌趋势次数
    const uptrendHighChangeCount = trendMaxChanges.uptrends.filter(change => change > 0.5).length;
    const downtrendHighChangeCount = trendMaxChanges.downtrends.filter(change => change < -0.5).length;
    
    console.log('上升趋势中最大涨幅大于0.5%的次数:', uptrendHighChangeCount);
    console.log('下降趋势中最大跌幅小于-0.5%的次数:', downtrendHighChangeCount);
    
    // 计算统计结果
    const trendStats = {
      uptrends: {
        count: trends.uptrends.length,
        durations: trends.uptrends,
        averageDuration: trends.uptrends.length > 0 
          ? (trends.uptrends.reduce((sum, len) => sum + len, 0) / trends.uptrends.length).toFixed(2) 
          : 0,
        maxDuration: trends.uptrends.length > 0 ? Math.max(...trends.uptrends) : 0,
        minDuration: trends.uptrends.length > 0 ? Math.min(...trends.uptrends) : 0,
        priceChanges: trendChanges.uptrends,
        averageChange: uptrendAvgChange.toFixed(2),
        distribution: uptrendDistribution,
        maxChanges: trendMaxChanges.uptrends,
        highChangeCount: uptrendHighChangeCount
      },
      downtrends: {
        count: trends.downtrends.length,
        durations: trends.downtrends,
        averageDuration: trends.downtrends.length > 0 
          ? (trends.downtrends.reduce((sum, len) => sum + len, 0) / trends.downtrends.length).toFixed(2) 
          : 0,
        maxDuration: trends.downtrends.length > 0 ? Math.max(...trends.downtrends) : 0,
        minDuration: trends.downtrends.length > 0 ? Math.min(...trends.downtrends) : 0,
        priceChanges: trendChanges.downtrends,
        averageChange: downtrendAvgChange.toFixed(2),
        distribution: downtrendDistribution,
        maxChanges: trendMaxChanges.downtrends,
        highChangeCount: downtrendHighChangeCount
      },
      oscillations: {
        count: trends.oscillations.length,
        durations: trends.oscillations,
        averageDuration: trends.oscillations.length > 0 
          ? (trends.oscillations.reduce((sum, len) => sum + len, 0) / trends.oscillations.length).toFixed(2) 
          : 0,
        maxDuration: trends.oscillations.length > 0 ? Math.max(...trends.oscillations) : 0,
        minDuration: trends.oscillations.length > 0 ? Math.min(...trends.oscillations) : 0,
        priceChanges: trendChanges.oscillations,
        averageChange: oscillationAvgChange.toFixed(2),
        distribution: oscillationDistribution
      }
    };
    
    console.log('生成的趋势统计结果:', JSON.stringify(trendStats, null, 2));
    
    // 打印更新后的分布统计
    console.log('上升趋势涨幅分布(细分区间):', 
      `负涨幅: ${uptrendDistribution.negative}, `,
      `0-0.25%: ${uptrendDistribution.veryTiny}, `,
      `0.25-0.5%: ${uptrendDistribution.tiny}, `,
      `0.5-0.75%: ${uptrendDistribution.verySmall}, `,
      `0.75-1%: ${uptrendDistribution.small}, `,
      `1-1.5%: ${uptrendDistribution.mediumSmall}, `,
      `1.5-2%: ${uptrendDistribution.medium}, `,
      `>2%: ${uptrendDistribution.large}`
    );
    
    console.log('下降趋势跌幅分布(细分区间):', 
      `正跌幅: ${downtrendDistribution.positive}, `,
      `0至-0.25%: ${downtrendDistribution.veryTiny}, `,
      `-0.25至-0.5%: ${downtrendDistribution.tiny}, `,
      `-0.5至-0.75%: ${downtrendDistribution.verySmall}, `,
      `-0.75至-1%: ${downtrendDistribution.small}, `,
      `-1至-1.5%: ${downtrendDistribution.mediumSmall}, `,
      `-1.5至-2%: ${downtrendDistribution.medium}, `,
      `<-2%: ${downtrendDistribution.large}`
    );
    
    console.log('震荡趋势波幅分布(细分区间):', 
      `0-0.25%: ${oscillationDistribution.veryTiny}, `,
      `0.25-0.5%: ${oscillationDistribution.tiny}, `,
      `0.5-0.75%: ${oscillationDistribution.verySmall}, `,
      `0.75-1%: ${oscillationDistribution.small}, `,
      `1-1.5%: ${oscillationDistribution.mediumSmall}, `,
      `1.5-2%: ${oscillationDistribution.medium}, `,
      `>2%: ${oscillationDistribution.large}`
    );
    
    return trendStats;
  } catch (error) {
    console.error('分析趋势时发生错误:', error);
    // 返回一个基本的结果，避免整个分析失败
    return {
      uptrends: { count: 0, durations: [], averageDuration: 0, maxDuration: 0, minDuration: 0, averageChange: "0.00", distribution: {}, maxChanges: [], highChangeCount: 0 },
      downtrends: { count: 0, durations: [], averageDuration: 0, maxDuration: 0, minDuration: 0, averageChange: "0.00", distribution: {}, maxChanges: [], highChangeCount: 0 },
      oscillations: { count: 0, durations: [], averageDuration: 0, maxDuration: 0, minDuration: 0, averageChange: "0.00", distribution: {} }
    };
  }
}

// 计算价格与EMA的距离百分比分布
function analyzeEMADistanceDistribution(data) {
  // 距离百分比的区间分布
  const distribution = {
    extremeNegative: 0,  // < -2%
    veryNegative: 0,     // -2% 至 -1.5%
    negative: 0,         // -1.5% 至 -1%
    slightlyNegative: 0, // -1% 至 -0.5%
    veryCloseNegative: 0,// -0.5% 至 -0.1%
    veryClose: 0,        // -0.1% 至 0.1%
    veryClosePositive: 0,// 0.1% 至 0.5%
    slightlyPositive: 0, // 0.5% 至 1%
    positive: 0,         // 1% 至 1.5%
    veryPositive: 0,     // 1.5% 至 2%
    extremePositive: 0   // > 2%
  };
  
  // 保存所有距离百分比，用于计算统计值
  const allDistances = [];
  
  // 计算每根K线的收盘价与EMA的距离百分比
  for (const candle of data) {
    const close = parseFloat(candle.close);
    const ema = candle.ema;
    const distancePercent = ((close - ema) / ema) * 100;
    
    // 记录距离百分比
    allDistances.push(distancePercent);
    
    // 统计分布
    if (distancePercent < -2) distribution.extremeNegative++;
    else if (distancePercent < -1.5) distribution.veryNegative++;
    else if (distancePercent < -1) distribution.negative++;
    else if (distancePercent < -0.5) distribution.slightlyNegative++;
    else if (distancePercent < -0.1) distribution.veryCloseNegative++;
    else if (distancePercent < 0.1) distribution.veryClose++;
    else if (distancePercent < 0.5) distribution.veryClosePositive++;
    else if (distancePercent < 1) distribution.slightlyPositive++;
    else if (distancePercent < 1.5) distribution.positive++;
    else if (distancePercent < 2) distribution.veryPositive++;
    else distribution.extremePositive++;
  }
  
  // 计算统计值
  const sum = allDistances.reduce((acc, val) => acc + val, 0);
  const mean = sum / allDistances.length;
  
  // 计算标准差
  const squaredDifferences = allDistances.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / allDistances.length;
  const stdDev = Math.sqrt(variance);
  
  // 找出最大和最小值
  const max = Math.max(...allDistances);
  const min = Math.min(...allDistances);
  
  return {
    distribution,
    statistics: {
      mean: mean.toFixed(2),
      stdDev: stdDev.toFixed(2),
      max: max.toFixed(2),
      min: min.toFixed(2),
      count: allDistances.length
    }
  };
}

// 主函数
function main() {
  try {
    console.log('开始分析K线数据...');
    const klineData = readKlineData();
    console.log(`读取了 ${klineData.length} 条K线数据`);
    
    const dataWithEMA = calculateEMA(klineData);
    console.log('已计算EMA14');
    
    const basicAnalysis = analyzeEMARelationship(dataWithEMA);
    console.log('基本统计分析完成');
    
    const trendAnalysis = analyzeTrends(dataWithEMA);
    console.log('趋势分析完成');
    
    // 添加EMA距离分析
    const distanceAnalysis = analyzeEMADistanceDistribution(dataWithEMA);
    console.log('EMA距离分析完成');
    
    // 合并分析结果
    const analysisResult = {
      ...basicAnalysis,
      trends: trendAnalysis,
      emaDistance: distanceAnalysis // 添加距离分析结果
    };
    
    // 保存分析结果前检查
    console.log('保存前检查分析结果:', JSON.stringify(analysisResult, null, 2));
    
    // 保存分析结果
    fs.writeFileSync(resultFilePath, JSON.stringify(analysisResult, null, 2));
    console.log(`分析结果已保存到: ${resultFilePath}`);
    
    // 打印统计结果
    console.log('===== 基本统计结果 =====');
    console.log(`总K线数: ${analysisResult.totalCandles}`);
    console.log(`位于EMA14上方的K线数: ${analysisResult.aboveEMA} (${analysisResult.aboveEMAPercentage}%)`);
    console.log(`位于EMA14下方的K线数: ${analysisResult.belowEMA} (${analysisResult.belowEMAPercentage}%)`);
    console.log(`横穿EMA14的K线数: ${analysisResult.crossingEMA} (${analysisResult.crossingEMAPercentage}%)`);
    
    console.log('===== 趋势统计结果 =====');
    console.log(`上升趋势次数: ${trendAnalysis.uptrends.count}, 平均持续: ${trendAnalysis.uptrends.averageDuration} 根K线`);
    console.log(`下降趋势次数: ${trendAnalysis.downtrends.count}, 平均持续: ${trendAnalysis.downtrends.averageDuration} 根K线`);
    console.log(`震荡趋势次数: ${trendAnalysis.oscillations.count}, 平均持续: ${trendAnalysis.oscillations.averageDuration} 根K线`);
    
    console.log('===== 趋势涨跌幅统计 =====');
    console.log(`上升趋势平均涨幅: ${trendAnalysis.uptrends.averageChange}%`);
    console.log(`上升趋势涨幅分布: 负涨幅: ${trendAnalysis.uptrends.distribution.negative}, 0-0.25%: ${trendAnalysis.uptrends.distribution.veryTiny}, 0.25-0.5%: ${trendAnalysis.uptrends.distribution.tiny}, 0.5-0.75%: ${trendAnalysis.uptrends.distribution.verySmall}, 0.75-1%: ${trendAnalysis.uptrends.distribution.small}, 1-1.5%: ${trendAnalysis.uptrends.distribution.mediumSmall}, 1.5-2%: ${trendAnalysis.uptrends.distribution.medium}, >2%: ${trendAnalysis.uptrends.distribution.large}`);
    
    console.log(`下降趋势平均跌幅: ${trendAnalysis.downtrends.averageChange}%`);
    console.log(`下降趋势跌幅分布: 正跌幅: ${trendAnalysis.downtrends.distribution.positive}, 0至-0.25%: ${trendAnalysis.downtrends.distribution.veryTiny}, -0.25至-0.5%: ${trendAnalysis.downtrends.distribution.tiny}, -0.5至-0.75%: ${trendAnalysis.downtrends.distribution.verySmall}, -0.75至-1%: ${trendAnalysis.downtrends.distribution.small}, -1至-1.5%: ${trendAnalysis.downtrends.distribution.mediumSmall}, -1.5至-2%: ${trendAnalysis.downtrends.distribution.medium}, <-2%: ${trendAnalysis.downtrends.distribution.large}`);
    
    console.log(`震荡趋势平均波幅: ${trendAnalysis.oscillations.averageChange}%`);
    console.log(`震荡趋势波幅分布: 0-0.25%: ${trendAnalysis.oscillations.distribution.veryTiny}, 0.25-0.5%: ${trendAnalysis.oscillations.distribution.tiny}, 0.5-0.75%: ${trendAnalysis.oscillations.distribution.verySmall}, 0.75-1%: ${trendAnalysis.oscillations.distribution.small}, 1-1.5%: ${trendAnalysis.oscillations.distribution.mediumSmall}, 1.5-2%: ${trendAnalysis.oscillations.distribution.medium}, >2%: ${trendAnalysis.oscillations.distribution.large}`);
    
    console.log('===== 趋势最大涨跌幅统计 =====');
    console.log(`上升趋势中最大涨幅大于0.5%的次数: ${trendAnalysis.uptrends.highChangeCount} (${(trendAnalysis.uptrends.highChangeCount / trendAnalysis.uptrends.count * 100).toFixed(2)}%)`);
    console.log(`下降趋势中最大跌幅小于-0.5%的次数: ${trendAnalysis.downtrends.highChangeCount} (${(trendAnalysis.downtrends.highChangeCount / trendAnalysis.downtrends.count * 100).toFixed(2)}%)`);
    
    console.log('===== EMA距离统计结果 =====');
    console.log(`平均距离百分比: ${distanceAnalysis.statistics.mean}%`);
    console.log(`标准差: ${distanceAnalysis.statistics.stdDev}%`);
    console.log(`最大距离百分比: ${distanceAnalysis.statistics.max}%`);
    console.log(`最小距离百分比: ${distanceAnalysis.statistics.min}%`);
    
    return analysisResult;
  } catch (error) {
    console.error('分析过程中发生错误:', error);
    throw error;
  }
}

// 运行分析
main(); 