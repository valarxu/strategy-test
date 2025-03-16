const express = require('express');
const path = require('path');
const fs = require('fs');

// 创建Express应用
const app = express();
const PORT = 3000;

// 提供静态文件
app.use(express.static('public'));

// 分析结果API
app.get('/api/analysis', (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'data', 'analysis_result.json');
    
    if (fs.existsSync(dataPath)) {
      const analysisData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      res.json(analysisData);
    } else {
      res.status(404).json({ error: '分析数据未找到，请先运行分析脚本' });
    }
  } catch (error) {
    console.error('获取分析数据失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// K线数据API
app.get('/api/klines', (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'data', 'BTCUSDT_15m_klines.json');
    
    if (fs.existsSync(dataPath)) {
      const klineData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      res.json(klineData);
    } else {
      res.status(404).json({ error: 'K线数据未找到，请先获取数据' });
    }
  } catch (error) {
    console.error('获取K线数据失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动，访问 http://localhost:${PORT}`);
}); 