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
      // 记录之前的趋势
      if (currentTrend === UPTREND) {
        trends.uptrends.push(consecutiveCount);
      } else if (currentTrend === DOWNTREND) {
        trends.downtrends.push(consecutiveCount);
      } else {
        trends.oscillations.push(consecutiveCount);
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
  if (currentTrend === UPTREND) {
    trends.uptrends.push(consecutiveCount);
  } else if (currentTrend === DOWNTREND) {
    trends.downtrends.push(consecutiveCount);
  } else {
    trends.oscillations.push(consecutiveCount);
  }
  
  // 计算统计结果
  const trendStats = {
    uptrends: {
      count: trends.uptrends.length,
      durations: trends.uptrends,
      averageDuration: trends.uptrends.length > 0 
        ? (trends.uptrends.reduce((sum, len) => sum + len, 0) / trends.uptrends.length).toFixed(2) 
        : 0,
      maxDuration: trends.uptrends.length > 0 ? Math.max(...trends.uptrends) : 0,
      minDuration: trends.uptrends.length > 0 ? Math.min(...trends.uptrends) : 0
    },
    downtrends: {
      count: trends.downtrends.length,
      durations: trends.downtrends,
      averageDuration: trends.downtrends.length > 0 
        ? (trends.downtrends.reduce((sum, len) => sum + len, 0) / trends.downtrends.length).toFixed(2) 
        : 0,
      maxDuration: trends.downtrends.length > 0 ? Math.max(...trends.downtrends) : 0,
      minDuration: trends.downtrends.length > 0 ? Math.min(...trends.downtrends) : 0
    },
    oscillations: {
      count: trends.oscillations.length,
      durations: trends.oscillations,
      averageDuration: trends.oscillations.length > 0 
        ? (trends.oscillations.reduce((sum, len) => sum + len, 0) / trends.oscillations.length).toFixed(2) 
        : 0,
      maxDuration: trends.oscillations.length > 0 ? Math.max(...trends.oscillations) : 0,
      minDuration: trends.oscillations.length > 0 ? Math.min(...trends.oscillations) : 0
    }
  };
  
  return trendStats;
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
    
    // 合并分析结果
    const analysisResult = {
      ...basicAnalysis,
      trends: trendAnalysis
    };
    
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
    
    return analysisResult;
  } catch (error) {
    console.error('分析过程中发生错误:', error);
    throw error;
  }
}

// 运行分析
main(); 