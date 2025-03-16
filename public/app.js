// 初始化变量和DOM元素
let analysisData = null;

// 加载分析数据
async function loadAnalysisData() {
  try {
    const response = await fetch('/api/analysis');
    
    if (!response.ok) {
      throw new Error('获取分析数据失败');
    }
    
    analysisData = await response.json();
    updateUI(analysisData);
    renderCharts(analysisData);
  } catch (error) {
    console.error('加载分析数据时出错:', error);
    document.querySelector('.container').innerHTML = `
      <div style="text-align: center; margin-top: 100px;">
        <h2>数据加载失败</h2>
        <p>请确保已运行分析脚本生成分析数据。</p>
        <p>错误信息: ${error.message}</p>
      </div>
    `;
  }
}

// 更新UI元素
function updateUI(data) {
  // 更新基本统计摘要卡片
  document.getElementById('totalCandles').textContent = data.totalCandles;
  document.getElementById('aboveEMA').textContent = data.aboveEMA;
  document.getElementById('aboveEMAPercentage').textContent = `${data.aboveEMAPercentage}%`;
  document.getElementById('belowEMA').textContent = data.belowEMA;
  document.getElementById('belowEMAPercentage').textContent = `${data.belowEMAPercentage}%`;
  document.getElementById('crossingEMA').textContent = data.crossingEMA;
  document.getElementById('crossingEMAPercentage').textContent = `${data.crossingEMAPercentage}%`;
  
  // 更新趋势统计卡片
  if (data.trends) {
    // 上升趋势
    document.getElementById('uptrendCount').textContent = data.trends.uptrends.count;
    document.getElementById('uptrendAvg').textContent = data.trends.uptrends.averageDuration;
    document.getElementById('uptrendMax').textContent = data.trends.uptrends.maxDuration;
    document.getElementById('uptrendMin').textContent = data.trends.uptrends.minDuration;
    
    // 下降趋势
    document.getElementById('downtrendCount').textContent = data.trends.downtrends.count;
    document.getElementById('downtrendAvg').textContent = data.trends.downtrends.averageDuration;
    document.getElementById('downtrendMax').textContent = data.trends.downtrends.maxDuration;
    document.getElementById('downtrendMin').textContent = data.trends.downtrends.minDuration;
    
    // 震荡趋势
    document.getElementById('oscillationCount').textContent = data.trends.oscillations.count;
    document.getElementById('oscillationAvg').textContent = data.trends.oscillations.averageDuration;
    document.getElementById('oscillationMax').textContent = data.trends.oscillations.maxDuration;
    document.getElementById('oscillationMin').textContent = data.trends.oscillations.minDuration;
  }
}

// 渲染所有图表
function renderCharts(data) {
  renderPositionChart(data);
  renderPercentageChart(data);
  
  if (data.trends) {
    renderTrendCountChart(data.trends);
    renderTrendDurationChart(data.trends);
    renderTrendDistributionCharts(data.trends);
  }
  
  // 初始化标签页
  initTabs();
}

// 渲染K线位置分布图
function renderPositionChart(data) {
  const ctx = document.getElementById('emaPositionChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['位于EMA14上方', '位于EMA14下方', '横穿EMA14'],
      datasets: [{
        label: 'K线数量',
        data: [data.aboveEMA, data.belowEMA, data.crossingEMA],
        backgroundColor: [
          'rgba(52, 152, 219, 0.7)',
          'rgba(231, 76, 60, 0.7)',
          'rgba(241, 196, 15, 0.7)'
        ],
        borderColor: [
          'rgba(52, 152, 219, 1)',
          'rgba(231, 76, 60, 1)',
          'rgba(241, 196, 15, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'K线数量'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} 条K线`;
            }
          }
        }
      }
    }
  });
}

// 渲染百分比饼图
function renderPercentageChart(data) {
  const ctx = document.getElementById('emaPercentageChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['位于EMA14上方', '位于EMA14下方', '横穿EMA14'],
      datasets: [{
        data: [data.aboveEMA, data.belowEMA, data.crossingEMA],
        backgroundColor: [
          'rgba(52, 152, 219, 0.7)',
          'rgba(231, 76, 60, 0.7)',
          'rgba(241, 196, 15, 0.7)'
        ],
        borderColor: [
          'rgba(52, 152, 219, 1)',
          'rgba(231, 76, 60, 1)',
          'rgba(241, 196, 15, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const percentage = (context.parsed / data.totalCandles * 100).toFixed(2);
              return `${context.label}: ${context.parsed} 条K线 (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// 渲染趋势出现次数图表
function renderTrendCountChart(trends) {
  const ctx = document.getElementById('trendCountChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['上升趋势', '下降趋势', '震荡趋势'],
      datasets: [{
        label: '出现次数',
        data: [
          trends.uptrends.count,
          trends.downtrends.count,
          trends.oscillations.count
        ],
        backgroundColor: [
          'rgba(46, 204, 113, 0.7)',
          'rgba(231, 76, 60, 0.7)',
          'rgba(241, 196, 15, 0.7)'
        ],
        borderColor: [
          'rgba(46, 204, 113, 1)',
          'rgba(231, 76, 60, 1)',
          'rgba(241, 196, 15, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '出现次数'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// 渲染趋势平均持续时间图表
function renderTrendDurationChart(trends) {
  const ctx = document.getElementById('trendDurationChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['上升趋势', '下降趋势', '震荡趋势'],
      datasets: [{
        label: '平均持续K线数',
        data: [
          parseFloat(trends.uptrends.averageDuration),
          parseFloat(trends.downtrends.averageDuration),
          parseFloat(trends.oscillations.averageDuration)
        ],
        backgroundColor: [
          'rgba(46, 204, 113, 0.7)',
          'rgba(231, 76, 60, 0.7)',
          'rgba(241, 196, 15, 0.7)'
        ],
        borderColor: [
          'rgba(46, 204, 113, 1)',
          'rgba(231, 76, 60, 1)',
          'rgba(241, 196, 15, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '平均持续K线数'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// 初始化标签页功能
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 移除所有活动状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // 添加当前活动状态
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// 渲染趋势持续时间分布图表
function renderTrendDistributionCharts(trends) {
  renderTrendDistribution('uptrend', trends.uptrends.durations, '上升趋势持续时间分布');
  renderTrendDistribution('downtrend', trends.downtrends.durations, '下降趋势持续时间分布');
  renderTrendDistribution('oscillation', trends.oscillations.durations, '震荡趋势持续时间分布');
}

// 根据持续时间数组生成频率统计
function generateDurationFrequency(durations) {
  const frequency = {};
  
  durations.forEach(duration => {
    if (frequency[duration]) {
      frequency[duration]++;
    } else {
      frequency[duration] = 1;
    }
  });
  
  // 转换为排序后的数组
  const sortedData = Object.entries(frequency)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([duration, count]) => ({
      duration: parseInt(duration),
      count
    }));
  
  return sortedData;
}

// 渲染单个趋势持续分布图表
function renderTrendDistribution(trendType, durations, title) {
  const canvas = document.getElementById(`${trendType}DistributionChart`);
  if (!canvas || !durations.length) return;
  
  const ctx = canvas.getContext('2d');
  const frequencyData = generateDurationFrequency(durations);
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: frequencyData.map(item => `${item.duration}根K线`),
      datasets: [{
        label: '出现次数',
        data: frequencyData.map(item => item.count),
        backgroundColor: 
          trendType === 'uptrend' ? 'rgba(46, 204, 113, 0.7)' : 
          trendType === 'downtrend' ? 'rgba(231, 76, 60, 0.7)' : 
          'rgba(241, 196, 15, 0.7)',
        borderColor: 
          trendType === 'uptrend' ? 'rgba(46, 204, 113, 1)' : 
          trendType === 'downtrend' ? 'rgba(231, 76, 60, 1)' : 
          'rgba(241, 196, 15, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '出现次数'
          }
        },
        x: {
          title: {
            display: true,
            text: '持续K线数'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: title
        }
      }
    }
  });
}

// 页面加载时获取数据
document.addEventListener('DOMContentLoaded', loadAnalysisData); 