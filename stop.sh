#!/bin/bash
# ParallaxAI 停止脚本

echo "Stopping ParallaxAI..."
kill -9 $(lsof -ti:46446) 2>/dev/null && echo "  Gateway stopped" || echo "  Gateway not running"
kill -9 $(lsof -ti:45445) 2>/dev/null && echo "  Web UI stopped" || echo "  Web UI not running"
echo "Done."
