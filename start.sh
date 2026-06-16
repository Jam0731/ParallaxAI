#!/bin/bash
# ParallaxAI 启动脚本

echo "🚀 Starting ParallaxAI..."

# 清理旧进程
kill -9 $(lsof -ti:46446) 2>/dev/null
kill -9 $(lsof -ti:45445) 2>/dev/null
sleep 1

# 启动 Gateway
echo "  Starting Gateway on port 46446..."
cd /home/jam/workspace/ParallaxAI
setsid node --import tsx src/index.ts > /tmp/parallax-gateway.log 2>&1 &
GATEWAY_PID=$!

# 等待 Gateway 就绪
sleep 4

# 启动 Web UI
echo "  Starting Web UI on port 45445..."
cd /home/jam/workspace/ParallaxAI/web-ui
setsid npx vite --port 45445 --host > /tmp/parallax-ui.log 2>&1 &
UI_PID=$!

sleep 3

# 检查状态
echo ""
echo "✅ ParallaxAI started!"
echo ""
echo "  Gateway:  ws://localhost:46446  (PID: $GATEWAY_PID)"
echo "  Web UI:   http://localhost:45445  (PID: $UI_PID)"
echo ""
echo "  打开浏览器访问: http://localhost:45445"
echo ""
echo "  日志文件:"
echo "    Gateway: /tmp/parallax-gateway.log"
echo "    UI:      /tmp/parallax-ui.log"
echo ""
echo "  停止命令: pkill -f 'tsx src/index.ts'; pkill -f 'vite.*45445'"
