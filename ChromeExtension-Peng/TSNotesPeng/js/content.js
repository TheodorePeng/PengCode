/**
 * TSNotesPeng - Content Script
 * 处理页面内容交互和消息传递
 */

// 初始化标志
let isInitialized = false;

// 初始化函数
function initialize() {
  if (isInitialized) return;
  
  // 监听链接点击事件
  document.addEventListener('click', handleLinkClick);
  
  // 标记已初始化
  isInitialized = true;
  console.log('TSNotesPeng: Content Script 已初始化');
}

// 处理链接点击事件
function handleLinkClick(event) {
  // 获取被点击的元素
  let target = event.target;
  
  // 向上查找找到最近的<a>标签
  while (target && target.tagName !== 'A') {
    target = target.parentElement;
  }
  
  // 如果点击的是链接
  if (target && target.tagName === 'A') {
    const href = target.href;
    
    // 检查链接是否包含 &type=TSNotes
    if (href && href.includes('&type=TSNotes')) {
      // 阻止默认行为
      event.preventDefault();
      
      // 提取时间戳
      const timestamp = extractTimestamp(href);
      
      // 发送消息给 background.js
      chrome.runtime.sendMessage({
        type: 'openTSNotesLink',
        url: href,
        timestamp: timestamp
      }).catch(error => {
        console.error('TSNotesPeng: 发送消息失败', error);
      });
    }
  }
}

// 处理来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.type === 'jumpToTimestamp') {
      jumpToTimestamp(message.timestamp);
      sendResponse({ success: true });
    } else if (message.type === 'pasteText') {
      pasteText(message.text);
      sendResponse({ success: true });
    } else if (message.type === 'showNotification') {
      showNotification(message.message);
      sendResponse({ success: true });
    } else if (message.type === 'copyToClipboard') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message.text)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error('TSNotesPeng: 复制到剪贴板失败', error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        fallbackCopyToClipboard(message.text)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
      }
      return true; // 异步
    } else if (message.type === 'pasteFromClipboard') {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText()
          .then(text => {
            pasteText(text);
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('TSNotesPeng: 从剪贴板读取失败', error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        sendResponse({ success: false, error: '无法访问剪贴板API' });
      }
      return true;
    } else if (message.type === 'promptForLink') {
      // 提示用户输入链接
      const userInput = prompt(message.message, '');
      sendResponse({ url: userInput });
      return true;
    } else if (message.type === 'ping') {
      // 添加对ping消息的响应，用于检测content脚本是否已加载
      sendResponse({ pong: true });
      return true;
    }
  } catch (error) {
    console.error('TSNotesPeng: 处理消息失败', error);
    sendResponse({ success: false, error: error.message });
  }
  return true;
});

// 粘贴文本到当前活动元素
function pasteText(text) {
  try {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable)
    ) {
      if (activeElement.isContentEditable) {
        document.execCommand('insertText', false, text);
      } else {
        const start = activeElement.selectionStart || 0;
        const end = activeElement.selectionEnd || 0;
        const value = activeElement.value || '';
        activeElement.value = value.substring(0, start) + text + value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
        const event = new Event('input', { bubbles: true });
        activeElement.dispatchEvent(event);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('TSNotesPeng: 粘贴文本失败', error);
    return false;
  }
}

// 备用复制到剪贴板方法
function fallbackCopyToClipboard(text) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时文本区域
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // 设置样式，使其不可见
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      textArea.style.opacity = '0';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      // 执行复制命令
      const successful = document.execCommand('copy');
      
      // 清理
      document.body.removeChild(textArea);
      
      if (successful) {
        resolve();
      } else {
        reject(new Error('复制命令执行失败'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

// 显示通知
function showNotification(message, duration = 3000) {
  try {
    // 检查是否已存在通知，如果存在则移除
    const existingNotification = document.querySelector('.tsnotes-notification');
    if (existingNotification) {
      document.body.removeChild(existingNotification);
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'tsnotes-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      transition: opacity 0.5s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 设置定时器移除通知
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 500);
    }, duration);
    
    return true;
  } catch (error) {
    console.error('TSNotesPeng: 显示通知失败', error);
    return false;
  }
}

// 提取时间戳并转换为秒数
function extractTimestamp(url) {
  try {
    // 尝试匹配时间戳参数
    let match = url.match(/[?&]t=([^&]+)/);
    if (!match) return 0;
    
    const timeStr = match[1];
    
    // 处理不同格式的时间戳
    if (timeStr.includes('h') || timeStr.includes('m') || timeStr.includes('s')) {
      // 处理 1h2m3s 格式
      let seconds = 0;
      
      const hourMatch = timeStr.match(/(\d+)h/);
      if (hourMatch) {
        seconds += parseInt(hourMatch[1]) * 3600;
      }
      
      const minuteMatch = timeStr.match(/(\d+)m/);
      if (minuteMatch) {
        seconds += parseInt(minuteMatch[1]) * 60;
      }
      
      const secondMatch = timeStr.match(/(\d+)s/);
      if (secondMatch) {
        seconds += parseInt(secondMatch[1]);
      }
      
      return seconds;
    } else if (timeStr.includes(':')) {
      // 处理 HH:MM:SS 或 MM:SS 格式
      const parts = timeStr.split(':').map(part => parseInt(part));
      
      if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
      }
    }
    
    // 尝试直接解析为数字
    return parseInt(timeStr);
  } catch (error) {
    console.error('TSNotesPeng: 提取时间戳失败', error);
    return 0;
  }
}

// 跳转到指定时间点
function jumpToTimestamp(timestamp) {
  try {
    console.log('TSNotesPeng: 尝试跳转到时间点', timestamp);
    
    // 查找视频元素
    const videoElements = Array.from(document.querySelectorAll('video'))
      .filter(video => video.duration > 0 && !isHidden(video));
    
    if (videoElements.length > 0) {
      // 找到视频元素，设置时间并播放
      videoElements.forEach(video => {
        video.currentTime = timestamp;
        
        // 只有当视频暂停时才自动播放
        if (video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error('TSNotesPeng: 自动播放失败', error);
              // 播放失败时不进行处理，可能是浏览器策略限制
            });
          }
        }
      });
      return true;
    } else {
      // 对于复杂播放器，注入专用脚本处理
      injectTimestampHandler(timestamp);
      return true;
    }
  } catch (error) {
    console.error('TSNotesPeng: 跳转到时间点失败', error);
    return false;
  }
}

// 检查元素是否隐藏
function isHidden(element) {
  return (
    element.offsetParent === null ||
    window.getComputedStyle(element).display === 'none' ||
    window.getComputedStyle(element).visibility === 'hidden' ||
    element.style.display === 'none'
  );
}

// 注入时间戳处理脚本
function injectTimestampHandler(timestamp) {
  try {
    // 创建自定义事件，传递时间戳
    const event = new CustomEvent('TSNotesJumpToTimestamp', {
      detail: { timestamp: timestamp }
    });
    
    // 检查是否已经注入了脚本
    if (!document.querySelector('#tsnotes-injected-script')) {
      // 创建并注入脚本标签
      const script = document.createElement('script');
      script.id = 'tsnotes-injected-script';
      script.src = chrome.runtime.getURL('js/injected.js');
      document.head.appendChild(script);
      
      // 等待脚本加载完成后分发事件
      script.onload = () => {
        document.dispatchEvent(event);
      };
    } else {
      // 已注入脚本，直接分发事件
      document.dispatchEvent(event);
    }
  } catch (error) {
    console.error('TSNotesPeng: 注入脚本失败', error);
  }
}

// 初始化
initialize(); 