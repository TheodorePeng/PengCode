// 使用持久化存储和更严格的窗口管理逻辑

// 全局变量
let tsNotesWindowId = null;
let isCreatingWindow = false;
let windowCheckInterval = null;
let pendingRequests = [];
let autoPaste = true; // 新增：自动粘贴设置，默认为开启
// 新增：窗口分割比例参数，可自定义设置（0-1之间），表示TSNotes窗口占据屏幕宽度的比例
let screenSplitRatio = 0.5; // 默认为0.5，即各占一半

// 初始化扩展
async function initExtension() {
  console.log('TSNotes: 初始化扩展...');
  
  // 重置窗口创建状态
  isCreatingWindow = false;
  
  // 清除可能存在的队列
  pendingRequests = [];
  
  // 从存储中恢复窗口 ID、自动粘贴设置和窗口分割比例
  const result = await chrome.storage.local.get(['tsNotesWindowId', 'autoPaste', 'screenSplitRatio']);
  if (result.tsNotesWindowId) {
    try {
      // 验证窗口是否仍然存在
      await chrome.windows.get(result.tsNotesWindowId);
      tsNotesWindowId = result.tsNotesWindowId;
      console.log('TSNotes: 恢复已存在的窗口 ID:', tsNotesWindowId);
    } catch (error) {
      // 窗口不存在，重置 ID
      console.log('TSNotes: 存储的窗口不存在，重置 ID');
      tsNotesWindowId = null;
      await chrome.storage.local.remove('tsNotesWindowId');
    }
  } else {
    // 确保窗口ID为空
    tsNotesWindowId = null;
  }
  
  // 恢复自动粘贴设置
  if (result.autoPaste !== undefined) {
    autoPaste = result.autoPaste;
    console.log('TSNotes: 恢复自动粘贴设置:', autoPaste);
  }
  
  // 恢复窗口分割比例设置
  if (result.screenSplitRatio !== undefined) {
    screenSplitRatio = result.screenSplitRatio;
    console.log('TSNotes: 恢复窗口分割比例设置:', screenSplitRatio);
  }
  
  // 创建右键菜单
  createContextMenu();
  
  // 启动定期检查
  startWindowCheck();
}

// 启动定期检查窗口状态
function startWindowCheck() {
  if (windowCheckInterval) {
    clearInterval(windowCheckInterval);
  }
  
  windowCheckInterval = setInterval(async () => {
    if (tsNotesWindowId !== null) {
      try {
        await chrome.windows.get(tsNotesWindowId);
        // 窗口存在，不做任何操作
      } catch (error) {
        // 窗口不存在，重置 ID
        console.log('TSNotes: 窗口已关闭，重置 ID');
        tsNotesWindowId = null;
        await chrome.storage.local.remove('tsNotesWindowId');
      }
    }
  }, 10000); // 每10秒检查一次
}

// 监听扩展安装或更新事件
chrome.runtime.onInstalled.addListener(() => {
  initExtension();
});

// 监听浏览器启动事件
chrome.runtime.onStartup.addListener(() => {
  initExtension();
});

// 确保扩展激活时初始化
initExtension();

// 监听来自 content.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'openTSNotesLink') {
    // 如果正在创建窗口，将请求加入队列
    if (isCreatingWindow) {
      console.log('TSNotes: 窗口正在创建中，请求加入队列');
      pendingRequests.push({
        url: message.url,
        timestamp: message.timestamp,
        sendResponse: sendResponse
      });
      return true;
    }
    
    handleTSNotesLink(message.url, message.timestamp)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('TSNotes: 处理链接失败', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
});

// 处理 TSNotes 链接
async function handleTSNotesLink(url, timestamp) {
  console.log('TSNotes: 处理链接', url, timestamp);
  
  // 设置创建窗口标志位，防止重复处理
  isCreatingWindow = true;
  
  try {
    // 移除 &type=TSNotes 后缀，获取原始视频 URL
    const cleanUrl = url.replace(/&type=TSNotes/g, '');
    
    // 先检查存储中的窗口 ID
    const result = await chrome.storage.local.get(['tsNotesWindowId']);
    if (result.tsNotesWindowId && result.tsNotesWindowId !== tsNotesWindowId) {
      tsNotesWindowId = result.tsNotesWindowId;
    }
    
    // 获取当前窗口作为源窗口
    const currentWindow = await getCurrentWindow();
    const sourceWindowId = currentWindow.id;
    
    // 检查 TSNotes Window 是否存在
    if (tsNotesWindowId !== null) {
      try {
        // 尝试获取窗口信息
        const window = await chrome.windows.get(tsNotesWindowId);
        
        // 窗口存在，激活窗口
        await chrome.windows.update(tsNotesWindowId, { focused: true });
        
        // 获取窗口中的所有标签页
        const tabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
        
        if (tabs.length > 0) {
          // 向标签页发送跳转消息
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'jumpToTimestamp',
            timestamp: timestamp
          });
        }
      } catch (error) {
        // 窗口不存在，重置 ID 并创建新窗口
        console.log('TSNotes: 窗口不存在，创建新窗口');
        tsNotesWindowId = null;
        await chrome.storage.local.remove('tsNotesWindowId');
        await createTSNotesWindow(cleanUrl, timestamp, sourceWindowId);
      }
    } else {
      // TSNotes Window 不存在，创建新窗口
      console.log('TSNotes: 窗口不存在，创建新窗口');
      await createTSNotesWindow(cleanUrl, timestamp, sourceWindowId);
    }
  } finally {
    // 重置创建窗口标志位
    isCreatingWindow = false;
    
    // 处理队列中的下一个请求
    if (pendingRequests.length > 0) {
      const nextRequest = pendingRequests.shift();
      console.log('TSNotes: 处理队列中的下一个请求');
      handleTSNotesLink(nextRequest.url, nextRequest.timestamp)
        .then(() => nextRequest.sendResponse({ success: true }))
        .catch(error => {
          console.error('TSNotes: 处理队列请求失败', error);
          nextRequest.sendResponse({ success: false, error: error.message });
        });
    }
  }
}

// 创建 TSNotes Window
async function createTSNotesWindow(url, timestamp, sourceWindowId) {
  console.log('TSNotes: 开始创建窗口');
  
  try {
    // 先关闭可能存在的所有 TSNotes 窗口
    const allWindows = await chrome.windows.getAll();
    for (const window of allWindows) {
      try {
        const tabs = await chrome.tabs.query({ windowId: window.id });
        for (const tab of tabs) {
          if (tab.url && tab.url.includes('&type=TSNotes')) {
            await chrome.windows.remove(window.id);
            break;
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 如果没有传入源窗口ID，尝试获取当前窗口
    if (!sourceWindowId) {
      try {
        const currentWindow = await getCurrentWindow();
        sourceWindowId = currentWindow.id;
      } catch (e) {
        console.error('TSNotes: 获取当前窗口失败', e);
        sourceWindowId = null;
      }
    }
    
    // 检测浏览器类型
    const browserInfo = await detectBrowser();
    
    // 创建窗口选项
    let windowOptions = {
      url: url,
      type: 'popup'
    };
    
    // 根据浏览器类型设置窗口属性
    if (browserInfo.isArc) {
      // Arc 浏览器使用最简单的窗口设置，不指定位置和大小
      console.log('TSNotes: 检测到 Arc 浏览器，使用简化窗口设置');
    } else {
      // 非 Arc 浏览器，尝试设置窗口位置和大小
      try {
        // 获取屏幕信息
        const screenInfo = await getScreenInfo();
        
        // 使用自定义分割比例参数
        const tsNotesRatio = screenSplitRatio; // TSNotes 窗口占屏幕宽度的比例
        
        // 计算窗口尺寸和位置
        const tsNotesWidth = Math.floor(screenInfo.width * tsNotesRatio);
        const tsNotesHeight = screenInfo.height;
        
        // 添加窗口位置和大小设置 - TSNotes窗口放在左侧
        windowOptions = {
          ...windowOptions,
          width: tsNotesWidth,
          height: tsNotesHeight,
          left: 0,
          top: 0
        };
      } catch (e) {
        console.error('TSNotes: 计算窗口尺寸失败，使用默认设置', e);
      }
    }
    
    // 创建一个新的弹出窗口
    const newWindow = await chrome.windows.create(windowOptions);
    
    // 保存窗口 ID
    tsNotesWindowId = newWindow.id;
    console.log('TSNotes: 窗口创建成功，ID:', tsNotesWindowId);
    
    // 将窗口 ID 保存到存储中
    await chrome.storage.local.set({ tsNotesWindowId: tsNotesWindowId });
    
    // 仅在非 Arc 浏览器中尝试调整原始窗口
    if (!browserInfo.isArc && sourceWindowId) {
      try {
        // 获取屏幕信息
        const screenInfo = await getScreenInfo();
        
        // 使用自定义分割比例参数
        const tsNotesRatio = screenSplitRatio; // TSNotes 窗口占屏幕宽度的比例
        
        // 计算原始窗口尺寸和位置 - 原始窗口放在右侧
        const sourceWidth = Math.floor(screenInfo.width * (1 - tsNotesRatio));
        const tsNotesWidth = Math.floor(screenInfo.width * tsNotesRatio);
        
        // 调整原始窗口（点击TSNotes Link的窗口）位置和大小
        await chrome.windows.update(sourceWindowId, {
          width: sourceWidth,
          height: screenInfo.height,
          left: tsNotesWidth,
          top: 0
        });
      } catch (e) {
        console.error('TSNotes: 调整原始窗口失败', e);
        // 失败时不中断流程
      }
    }
    
    // 监听窗口关闭事件
    const windowRemovedListener = (windowId) => {
      if (windowId === tsNotesWindowId) {
        console.log('TSNotes: 窗口已关闭');
        tsNotesWindowId = null;
        chrome.storage.local.remove('tsNotesWindowId');
        chrome.windows.onRemoved.removeListener(windowRemovedListener);
      }
    };
    
    chrome.windows.onRemoved.addListener(windowRemovedListener);
    
    // 等待页面加载完成后跳转到指定时间点
    const tabUpdatedListener = (tabId, changeInfo, tab) => {
      if (tab.windowId === tsNotesWindowId && changeInfo.status === 'complete') {
        console.log('TSNotes: 页面加载完成，准备跳转到时间点');
        
        // 延迟发送跳转消息，确保页面完全加载
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            type: 'jumpToTimestamp',
            timestamp: timestamp
          });
        }, 2000);
        
        // 移除监听器
        chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
      }
    };
    
    chrome.tabs.onUpdated.addListener(tabUpdatedListener);
    
  } catch (error) {
    console.error('TSNotes: 创建窗口失败', error);
    throw error; // 向上传递错误
  }
}

// 检测浏览器类型
async function detectBrowser() {
  const browserInfo = {
    isArc: false,
    isChrome: false,
    name: 'unknown'
  };
  
  try {
    // 创建一个临时标签页来获取浏览器信息
    return new Promise((resolve) => {
      chrome.tabs.create({ url: 'about:blank', active: false }, async (tab) => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const ua = navigator.userAgent;
              return {
                userAgent: ua,
                isArc: ua.includes('Arc'),
                isChrome: ua.includes('Chrome') && !ua.includes('Arc')
              };
            }
          });
          
          // 关闭临时标签页
          await chrome.tabs.remove(tab.id);
          
          if (results && results[0] && results[0].result) {
            const result = results[0].result;
            browserInfo.isArc = result.isArc;
            browserInfo.isChrome = result.isChrome;
            browserInfo.name = result.isArc ? 'Arc' : (result.isChrome ? 'Chrome' : 'unknown');
          }
        } catch (e) {
          console.error('TSNotes: 执行脚本获取浏览器信息失败', e);
          // 尝试关闭临时标签页
          try {
            await chrome.tabs.remove(tab.id);
          } catch (e) {
            // 忽略错误
          }
        }
        
        console.log('TSNotes: 检测到浏览器类型:', browserInfo.name);
        resolve(browserInfo);
      });
    });
  } catch (e) {
    console.error('TSNotes: 检测浏览器类型失败', e);
    return browserInfo; // 返回默认值
  }
}

// 获取屏幕信息
async function getScreenInfo() {
  // 默认屏幕尺寸
  const defaultScreenInfo = {
    width: 1920,
    height: 1080
  };
  
  try {
    // 获取所有窗口信息
    const windows = await chrome.windows.getAll();
    if (windows.length === 0) {
      return defaultScreenInfo;
    }
    
    // 找出最大的窗口尺寸作为屏幕尺寸的参考
    let maxWidth = 0;
    let maxHeight = 0;
    
    for (const win of windows) {
      if (win.width > maxWidth) maxWidth = win.width;
      if (win.height > maxHeight) maxHeight = win.height;
    }
    
    // 如果获取到的尺寸太小，使用默认值
    if (maxWidth < 800 || maxHeight < 600) {
      return defaultScreenInfo;
    }
    
    // 估计屏幕尺寸（考虑到窗口通常不会占满整个屏幕）
    return {
      width: Math.max(maxWidth * 1.1, 1920),  // 增加10%作为估计
      height: Math.max(maxHeight * 1.1, 1080) // 增加10%作为估计
    };
  } catch (error) {
    console.error('TSNotes: 获取屏幕信息失败', error);
    return defaultScreenInfo;
  }
}

// 获取当前窗口信息
async function getCurrentWindow() {
  return new Promise((resolve) => {
    chrome.windows.getCurrent((window) => {
      // 默认窗口尺寸
      const defaultWindow = {
        width: 1280,
        height: 800,
        id: null
      };
      
      if (chrome.runtime.lastError) {
        console.error('TSNotes: 获取当前窗口信息失败', chrome.runtime.lastError);
        resolve(defaultWindow);
      } else {
        resolve(window);
      }
    });
  });
}

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(() => {
  // 修改为执行与 Command+Shift+U 相同的功能
  openBlankTSNotesWindowIfNotExist();
});

// 监听快捷键事件
chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-tsnotes-link") {
    copyCurrentTSNotesLink();
  } else if (command === "open-tsnotes-window") {
    openBlankTSNotesWindowIfNotExist();
  }
});

// 新增：快捷键触发创建空白TSNotes Window
async function openBlankTSNotesWindowIfNotExist() {
  if (tsNotesWindowId) {
    // 已有窗口则不重复创建
    try {
      await chrome.windows.get(tsNotesWindowId);
      return;
    } catch (e) {
      // 窗口不存在，继续创建
      tsNotesWindowId = null;
      await chrome.storage.local.remove('tsNotesWindowId');
    }
  }
  
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      console.error('TSNotes: 无法获取当前活动标签页');
      // 如果无法获取活动标签页，直接创建默认空白窗口
      await createDefaultEmptyWindow();
      return;
    }

    // 创建专用的交互页面，这是更可靠的方式，特别是在首次运行时
    try {
      return new Promise((resolve) => {
        // 记录源窗口ID，用于后续布局调整
        const sourceWindowId = activeTab.windowId;
        
        // 先创建一个临时标签页，这样更可靠
        chrome.tabs.create({
          url: 'about:blank',
          active: true
        }, async (tab) => {
          try {
            // 给临时页面一点时间加载
            await new Promise(r => setTimeout(r, 200));
            
            // 在临时页面执行脚本
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                // 设置页面标题
                document.title = 'TSNotes - 请输入链接';
                
                // 添加一些样式使提示框更醒目
                const style = document.createElement('style');
                style.textContent = `
                  body { 
                    font-family: Arial, sans-serif;
                    background: #f0f0f0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                  }
                  .prompt-container {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                  }
                  h1 { margin-top: 0; color: #4285f4; }
                  input {
                    width: 100%;
                    padding: 10px;
                    margin: 10px 0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                  }
                  button {
                    background: #4285f4;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 5px;
                  }
                  button:hover { background: #3367d6; }
                  .button-container { margin-top: 15px; }
                `;
                document.head.appendChild(style);
                
                // 创建内容
                const container = document.createElement('div');
                container.className = 'prompt-container';
                
                const title = document.createElement('h1');
                title.textContent = 'TSNotes';
                
                const description = document.createElement('p');
                description.textContent = '请输入要在 TSNotes 窗口中打开的链接，或点击"创建空白窗口"按钮。';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = '输入网址 (例如: youtube.com/watch?v=...)';
                
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'button-container';
                
                const confirmButton = document.createElement('button');
                confirmButton.textContent = '确认';
                
                const emptyButton = document.createElement('button');
                emptyButton.textContent = '创建空白窗口';
                
                const cancelButton = document.createElement('button');
                cancelButton.textContent = '取消';
                cancelButton.style.background = '#f44336';
                
                // 组装DOM
                buttonContainer.appendChild(confirmButton);
                buttonContainer.appendChild(emptyButton);
                buttonContainer.appendChild(cancelButton);
                
                container.appendChild(title);
                container.appendChild(description);
                container.appendChild(input);
                container.appendChild(buttonContainer);
                
                document.body.appendChild(container);
                
                // 获取用户输入
                return new Promise((resolve) => {
                  // 确认按钮点击事件
                  confirmButton.addEventListener('click', () => {
                    resolve(input.value || '');
                  });
                  
                  // 创建空白窗口按钮点击事件
                  emptyButton.addEventListener('click', () => {
                    resolve('');
                  });
                  
                  // 取消按钮点击事件
                  cancelButton.addEventListener('click', () => {
                    resolve(null);
                  });
                  
                  // 按下回车键等同于点击确认按钮
                  input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                      resolve(input.value || '');
                    }
                  });
                  
                  // 聚焦到输入框
                  input.focus();
                });
              }
            });
            
            // 关闭临时标签页
            await chrome.tabs.remove(tab.id);
            
            // 处理用户输入
            if (results && results[0] && results[0].result !== null) {
              const userInput = await results[0].result; // 这里的result是一个Promise
              
              // 用户取消操作
              if (userInput === null) {
                console.log('TSNotes: 用户取消了操作');
                resolve();
                return;
              }
              
              // 处理用户输入
              await handlePromptResult(userInput, sourceWindowId);
            } else {
              // 执行失败，创建默认窗口
              console.error('TSNotes: 执行脚本失败或用户取消');
              await createDefaultEmptyWindow();
            }
            
            resolve();
          } catch (error) {
            console.error('TSNotes: 交互页面执行失败', error);
            
            // 尝试关闭临时标签页
            try {
              await chrome.tabs.remove(tab.id);
            } catch (e) {
              // 忽略错误
            }
            
            // 失败时创建默认窗口
            await createDefaultEmptyWindow();
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('TSNotes: 创建交互页面失败', error);
      // 如果创建交互页面失败，尝试直接使用executeScript
      try {
        console.log('TSNotes: 尝试使用备选方法');
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            return prompt('请输入要在 TSNotes 窗口中打开的链接 (留空则创建空白窗口):', '');
          }
        });
        
        const userInput = results && results[0] && results[0].result !== null ? results[0].result : '';
        await handlePromptResult(userInput, activeTab.windowId);
      } catch (execError) {
        console.error('TSNotes: 备选方法也失败', execError);
        // 如果备选方法也失败，创建默认空白窗口
        await createDefaultEmptyWindow();
      }
    }
  } catch (error) {
    console.error('TSNotes: 用户交互失败', error);
    // 如果交互失败，创建默认空白窗口
    await createDefaultEmptyWindow();
  }
}

// 新增：处理用户输入结果的函数
async function handlePromptResult(userInput, sourceWindowId) {
  let url = 'about:blank';
  if (userInput && userInput.trim() !== '') {
    url = userInput.trim();
    // 如果用户输入的不是完整URL，尝试添加https://前缀
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
  }
  
  // 如果没有传入sourceWindowId，获取当前窗口作为源窗口
  if (!sourceWindowId) {
    try {
      const currentWindow = await getCurrentWindow();
      sourceWindowId = currentWindow.id;
    } catch (e) {
      console.error('TSNotes: 获取当前窗口失败', e);
      // 如果获取失败，创建窗口时不调整布局
      sourceWindowId = null;
    }
  }
  
  // 先创建窗口，然后再调整布局
  // 创建窗口 - 先创建一个普通窗口
  const windowOptions = {
    url: url,
    type: 'popup'
  };
  
  try {
    const newWindow = await chrome.windows.create(windowOptions);
    tsNotesWindowId = newWindow.id;
    await chrome.storage.local.set({ tsNotesWindowId: tsNotesWindowId });
    
    console.log('TSNotes: 创建窗口成功，ID:', tsNotesWindowId);
    
    // 窗口创建后等待一小段时间，确保窗口已经完全创建，避免布局调整失败
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 创建窗口后再调整布局
    try {
      // 获取屏幕信息
      const screenInfo = await getScreenInfo();
      
      // 使用自定义分割比例参数
      const tsNotesWidth = Math.floor(screenInfo.width * screenSplitRatio);
      const tsNotesHeight = screenInfo.height;
      
      console.log('TSNotes: 调整窗口布局:', tsNotesWidth, tsNotesHeight);
      
      // 调整TSNotes窗口 - TSNotes窗口放在左侧
      await chrome.windows.update(tsNotesWindowId, {
        width: tsNotesWidth,
        height: tsNotesHeight,
        left: 0,
        top: 0
      });
      
      // 只有在有有效的源窗口ID时才调整原始窗口
      if (sourceWindowId) {
        // 调整原始窗口 - 原始窗口放在右侧
        const sourceWidth = Math.floor(screenInfo.width * (1 - screenSplitRatio));
        await chrome.windows.update(sourceWindowId, {
          width: sourceWidth,
          height: screenInfo.height,
          left: tsNotesWidth,
          top: 0
        });
        console.log('TSNotes: 原始窗口布局调整完成');
      }
      
      console.log('TSNotes: 窗口布局调整完成');
    } catch (e) {
      console.error('TSNotes: 调整窗口失败', e);
    }
    
    // 监听关闭
    const windowRemovedListener = (windowId) => {
      if (windowId === tsNotesWindowId) {
        tsNotesWindowId = null;
        chrome.storage.local.remove('tsNotesWindowId');
        chrome.windows.onRemoved.removeListener(windowRemovedListener);
      }
    };
    chrome.windows.onRemoved.addListener(windowRemovedListener);
    
    // 尝试显示通知，但不依赖于content脚本
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        try {
          // 尝试使用content脚本显示通知
          chrome.tabs.sendMessage(activeTab.id, {
            type: 'showNotification',
            message: '已创建 TSNotes 窗口'
          }).catch(() => {});
        } catch (e) {
          // 忽略错误
          console.log('TSNotes: 通知发送失败', e);
        }
      }
    } catch (e) {
      // 忽略通知错误
    }
  } catch (error) {
    console.error('TSNotes: 创建窗口失败', error);
    // 如果窗口创建失败，使用默认方法再次尝试
    await createDefaultEmptyWindow();
  }
}

// 新增：创建默认空白窗口
async function createDefaultEmptyWindow(sourceWindowId) {
  // 如果没有传入源窗口ID，尝试获取当前窗口
  if (!sourceWindowId) {
    try {
      const currentWindow = await getCurrentWindow();
      sourceWindowId = currentWindow.id;
    } catch (e) {
      console.error('TSNotes: 获取当前窗口失败', e);
      sourceWindowId = null;
    }
  }
  
  // 创建一个默认窗口
  const windowOptions = {
    url: 'about:blank',
    type: 'popup'
  };
  
  try {
    // 获取屏幕信息
    const screenInfo = await getScreenInfo();
    
    // 使用自定义分割比例参数
    const tsNotesWidth = Math.floor(screenInfo.width * screenSplitRatio);
    const tsNotesHeight = screenInfo.height;
    
    // 添加位置信息
    windowOptions.width = tsNotesWidth;
    windowOptions.height = tsNotesHeight;
    windowOptions.left = 0;
    windowOptions.top = 0;
  } catch (e) {
    // 如果获取屏幕信息失败，使用默认尺寸
    console.error('TSNotes: 获取屏幕信息失败，使用默认尺寸', e);
    windowOptions.width = 900;
    windowOptions.height = 700;
    windowOptions.left = 100;
    windowOptions.top = 100;
  }
  
  try {
    console.log('TSNotes: 创建默认空白窗口');
    const newWindow = await chrome.windows.create(windowOptions);
    tsNotesWindowId = newWindow.id;
    await chrome.storage.local.set({ tsNotesWindowId: tsNotesWindowId });
    
    // 等待窗口创建完成
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 如果有有效的源窗口ID，调整原始窗口位置
    if (sourceWindowId) {
      try {
        const screenInfo = await getScreenInfo();
        const tsNotesWidth = Math.floor(screenInfo.width * screenSplitRatio);
        const sourceWidth = Math.floor(screenInfo.width * (1 - screenSplitRatio));
        
        console.log('TSNotes: 调整原始窗口位置');
        
        // 调整原始窗口 - 原始窗口放在右侧
        await chrome.windows.update(sourceWindowId, {
          width: sourceWidth,
          height: screenInfo.height,
          left: tsNotesWidth,
          top: 0
        });
        
        console.log('TSNotes: 原始窗口调整完成');
      } catch (e) {
        console.error('TSNotes: 调整原始窗口失败', e);
      }
    }
    
    // 监听窗口关闭事件
    const windowRemovedListener = (windowId) => {
      if (windowId === tsNotesWindowId) {
        console.log('TSNotes: 默认窗口已关闭');
        tsNotesWindowId = null;
        chrome.storage.local.remove('tsNotesWindowId');
        chrome.windows.onRemoved.removeListener(windowRemovedListener);
      }
    };
    
    chrome.windows.onRemoved.addListener(windowRemovedListener);
    
    return true;
  } catch (e) {
    console.error('TSNotes: 创建默认窗口失败', e);
    return false;
  }
}

// 获取并复制当前 TSNotes 链接
async function copyCurrentTSNotesLink(forcePaste = false) {
  console.log('TSNotes: 尝试获取当前时间点链接');
  
  try {
    // 检查 TSNotes Window 是否存在
    if (!tsNotesWindowId) {
      console.log('TSNotes: 没有活动的 TSNotes 窗口');
      return;
    }
    
    // 获取 TSNotes Window 中的标签页
    const tabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
    if (tabs.length === 0) {
      console.log('TSNotes: TSNotes 窗口中没有标签页');
      return;
    }
    
    // 获取当前标签页的 URL 和当前播放时间
    const tabId = tabs[0].id;
    const tabUrl = tabs[0].url;
    
    // 执行脚本获取当前视频播放时间
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const videoElements = Array.from(document.querySelectorAll('video'))
          .filter(video => video.duration > 0 && video.style.display !== 'none' && video.offsetParent !== null);
        if (videoElements.length === 0) {
          return { success: false, error: '未找到视频元素' };
        }
        const video = videoElements[0];
        const currentTime = Math.floor(video.currentTime);
        const formatTime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          return [
            hours > 0 ? hours.toString().padStart(2, '0') : null,
            minutes.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
          ].filter(Boolean).join(':');
        };
        return { 
          success: true, 
          currentTime: currentTime,
          formattedTime: formatTime(currentTime)
        };
      }
    });
    
    if (!results || !results[0] || !results[0].result || !results[0].result.success) {
      console.error('TSNotes: 获取视频时间失败', results);
      return;
    }
    
    const { currentTime, formattedTime } = results[0].result;
    
    // 清理 URL，移除现有的时间戳和 TSNotes 标记
    let cleanUrl = tabUrl.replace(/[?&]t=\d+(\.\d+)?s?/g, '')
                         .replace(/[?&]start=\d+/g, '')
                         .replace(/[?&]time_continue=\d+/g, '')
                         .replace(/&type=TSNotes/g, '');
    
    // 添加时间戳参数
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const tsNotesLink = `${cleanUrl}${separator}t=${currentTime}s&type=TSNotes`;
    
    // 创建 Markdown 格式的链接，并在末尾加一个空格
    const markdownLink = `[${formattedTime}](${tsNotesLink}) `;
    
    // 复制到剪贴板
    await copyToClipboard(markdownLink);
    console.log('TSNotes: 已复制链接到剪贴板', markdownLink);

    // 根据自动粘贴设置或强制粘贴参数决定是否粘贴
    if (autoPaste || forcePaste) {
      await pasteClipboardContentToActiveTab();
    } else {
      // 仅显示通知，不粘贴
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'showNotification',
          message: '已复制 TSNotes 链接到剪贴板'
        });
      }
    }

  } catch (error) {
    console.error('TSNotes: 获取链接失败', error);
  }
}

// 复制文本到剪贴板
async function copyToClipboard(text) {
  // 优先尝试让 content script 写入剪贴板
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'copyToClipboard',
        text
      });
      if (result && result.success) {
        return true;
      }
    }
  } catch (e) {
    // 忽略，继续备用方案
  }

  // 备用方法：创建一个临时标签页来执行复制操作
  try {
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (textToCopy) => {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      },
      args: [text]
    });
    await chrome.tabs.remove(tab.id);
    return true;
  } catch (err) {
    console.error('TSNotes: 备用复制方法也失败', err);
    return false;
  }
}

// 尝试在活动标签页中粘贴文本
async function pasteToActiveTab(text) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    
    // 向活动标签页发送粘贴消息
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'pasteText',
      text: text
    });
    
    // 显示通知
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'showNotification',
      message: '已复制 TSNotes 链接到剪贴板'
    });
  } catch (error) {
    console.error('TSNotes: 粘贴失败', error);
  }
}

// 新增：读取剪贴板内容并粘贴到活动标签页
async function pasteClipboardContentToActiveTab() {
  try {
    // 通过 content script 读取剪贴板内容并粘贴
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'pasteFromClipboard' });
      // 通知
      chrome.tabs.sendMessage(tab.id, {
        type: 'showNotification',
        message: '已复制 TSNotes 链接到剪贴板并粘贴'
      });
    }
  } catch (error) {
    console.error('TSNotes: 粘贴剪贴板内容失败', error);
  }
}

// 新增：修改当前TSNotes窗口中的链接
async function changeTSNotesLink() {
  console.log('TSNotes: 尝试修改当前TSNotes窗口链接');
  
  // 检查TSNotes窗口是否存在
  if (!tsNotesWindowId) {
    console.log('TSNotes: 没有活动的TSNotes窗口');
    
    // 通知用户没有活动的TSNotes窗口
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'showNotification',
          message: '没有活动的TSNotes窗口，请先创建或打开一个TSNotes窗口'
        }).catch(() => {});
      }
    } catch (e) {
      // 忽略错误
    }
    return;
  }
  
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      console.error('TSNotes: 无法获取当前活动标签页');
      return;
    }
    
    // 获取源窗口ID
    const sourceWindowId = activeTab.windowId;
    
    // 创建专用的交互页面
    return new Promise((resolve) => {
      // 创建一个临时标签页
      chrome.tabs.create({
        url: 'about:blank',
        active: true
      }, async (tab) => {
        try {
          // 给临时页面一点时间加载
          await new Promise(r => setTimeout(r, 200));
          
          // 获取当前TSNotes窗口中的标签页
          const tsTabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
          let currentUrl = 'about:blank';
          if (tsTabs.length > 0) {
            currentUrl = tsTabs[0].url;
            // 清除url中的时间戳和TSNotes标记
            currentUrl = currentUrl.replace(/[?&]t=\d+(\.\d+)?s?/g, '')
                               .replace(/[?&]start=\d+/g, '')
                               .replace(/[?&]time_continue=\d+/g, '')
                               .replace(/&type=TSNotes/g, '');
          }
          
          // 在临时页面执行脚本
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (currentUrl) => {
              // 设置页面标题
              document.title = 'TSNotes - 修改链接';
              
              // 添加一些样式使提示框更醒目
              const style = document.createElement('style');
              style.textContent = `
                body { 
                  font-family: Arial, sans-serif;
                  background: #f0f0f0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                }
                .prompt-container {
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                  max-width: 500px;
                  width: 100%;
                  text-align: center;
                }
                h1 { margin-top: 0; color: #4285f4; }
                input {
                  width: 100%;
                  padding: 10px;
                  margin: 10px 0;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  box-sizing: border-box;
                }
                button {
                  background: #4285f4;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 4px;
                  cursor: pointer;
                  margin: 5px;
                }
                button:hover { background: #3367d6; }
                .button-container { margin-top: 15px; }
              `;
              document.head.appendChild(style);
              
              // 创建内容
              const container = document.createElement('div');
              container.className = 'prompt-container';
              
              const title = document.createElement('h1');
              title.textContent = 'TSNotes - 修改链接';
              
              const description = document.createElement('p');
              description.textContent = '请输入新的链接，以替换当前TSNotes窗口中的链接：';
              
              const input = document.createElement('input');
              input.type = 'text';
              input.value = currentUrl || '';
              input.placeholder = '输入网址 (例如: youtube.com/watch?v=...)';
              
              const buttonContainer = document.createElement('div');
              buttonContainer.className = 'button-container';
              
              const confirmButton = document.createElement('button');
              confirmButton.textContent = '确认';
              
              const cancelButton = document.createElement('button');
              cancelButton.textContent = '取消';
              cancelButton.style.background = '#f44336';
              
              // 组装DOM
              buttonContainer.appendChild(confirmButton);
              buttonContainer.appendChild(cancelButton);
              
              container.appendChild(title);
              container.appendChild(description);
              container.appendChild(input);
              container.appendChild(buttonContainer);
              
              document.body.appendChild(container);
              
              // 获取用户输入
              return new Promise((resolve) => {
                // 确认按钮点击事件
                confirmButton.addEventListener('click', () => {
                  resolve(input.value || '');
                });
                
                // 取消按钮点击事件
                cancelButton.addEventListener('click', () => {
                  resolve(null);
                });
                
                // 按下回车键等同于点击确认按钮
                input.addEventListener('keydown', (e) => {
                  if (e.key === 'Enter') {
                    resolve(input.value || '');
                  }
                });
                
                // 聚焦到输入框
                input.focus();
                // 将光标移动到末尾
                input.selectionStart = input.selectionEnd = input.value.length;
              });
            },
            args: [currentUrl]
          });
          
          // 关闭临时标签页
          await chrome.tabs.remove(tab.id);
          
          // 处理用户输入
          if (results && results[0] && results[0].result !== null) {
            const userInput = await results[0].result; // 这里的result是一个Promise
            
            // 用户取消操作
            if (userInput === null) {
              console.log('TSNotes: 用户取消了修改链接');
              resolve();
              return;
            }
            
            // 处理用户输入，更新TSNotes窗口中的链接
            if (userInput && userInput.trim() !== '') {
              let newUrl = userInput.trim();
              // 如果用户输入的不是完整URL，尝试添加https://前缀
              if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
                newUrl = 'https://' + newUrl;
              }
              
              // 更新窗口中的标签页
              if (tsTabs.length > 0) {
                await chrome.tabs.update(tsTabs[0].id, { url: newUrl });
                console.log('TSNotes: 已更新链接为:', newUrl);
                
                // 通知用户链接已修改
                try {
                  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                  if (currentTab && currentTab.id) {
                    chrome.tabs.sendMessage(currentTab.id, {
                      type: 'showNotification',
                      message: 'TSNotes窗口链接已更新'
                    }).catch(() => {});
                  }
                } catch (e) {
                  // 忽略错误
                }
              }
            }
          }
          
          resolve();
        } catch (error) {
          console.error('TSNotes: 交互页面执行失败', error);
          
          // 尝试关闭临时标签页
          try {
            await chrome.tabs.remove(tab.id);
          } catch (e) {
            // 忽略错误
          }
          
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('TSNotes: 修改链接失败', error);
  }
}

// 创建右键菜单
function createContextMenu() {
  // 先清除所有现有菜单
  chrome.contextMenus.removeAll(() => {
    // 创建父菜单
    chrome.contextMenus.create({
      id: 'tsnotes-menu',
      title: 'TSNotes',
      contexts: ['action']
    });
    
    // 创建自动粘贴选项
    chrome.contextMenus.create({
      id: 'auto-paste',
      parentId: 'tsnotes-menu',
      title: '自动粘贴链接',
      type: 'checkbox',
      checked: autoPaste,
      contexts: ['action']
    });
    
    // 创建获取链接菜单项
    chrome.contextMenus.create({
      id: 'get-tsnotes-link',
      parentId: 'tsnotes-menu',
      title: '获取 TSNotes 链接',
      contexts: ['action']
    });
    
    // 创建空白窗口菜单项
    chrome.contextMenus.create({
      id: 'open-tsnotes-window',
      parentId: 'tsnotes-menu',
      title: '创建空白 TSNotes 窗口',
      contexts: ['action']
    });
    
    // 创建修改链接菜单项
    chrome.contextMenus.create({
      id: 'change-tsnotes-link',
      parentId: 'tsnotes-menu',
      title: '修改 TSNotes 窗口链接',
      contexts: ['action']
    });
    
    // 创建窗口分割比例设置子菜单
    chrome.contextMenus.create({
      id: 'split-ratio',
      parentId: 'tsnotes-menu',
      title: '窗口分割比例',
      contexts: ['action']
    });
    
    // 创建几个预设的分割比例选项
    const ratios = [
      { id: 'ratio-0.3', value: 0.3, title: '30% : 70%' },
      { id: 'ratio-0.5', value: 0.5, title: '50% : 50%' },
      { id: 'ratio-0.7', value: 0.7, title: '70% : 30%' }
    ];
    
    for (const ratio of ratios) {
      chrome.contextMenus.create({
        id: ratio.id,
        parentId: 'split-ratio',
        title: ratio.title,
        type: 'radio',
        checked: Math.abs(screenSplitRatio - ratio.value) < 0.01,
        contexts: ['action']
      });
    }
  });
}

// 修改右键菜单点击事件处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'auto-paste') {
    // 切换自动粘贴设置
    autoPaste = info.checked;
    // 保存设置
    chrome.storage.local.set({ autoPaste: autoPaste });
    console.log('TSNotes: 自动粘贴设置已更改为', autoPaste);
  } else if (info.menuItemId === 'get-tsnotes-link') {
    // 执行获取链接功能
    copyCurrentTSNotesLink(true); // 传入参数表示强制粘贴一次
  } else if (info.menuItemId === 'open-tsnotes-window') {
    // 执行创建空白窗口功能
    openBlankTSNotesWindowIfNotExist();
  } else if (info.menuItemId === 'change-tsnotes-link') {
    // 执行修改链接功能
    changeTSNotesLink();
  } else if (info.menuItemId.startsWith('ratio-')) {
    // 设置窗口分割比例
    const ratio = parseFloat(info.menuItemId.replace('ratio-', ''));
    if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
      screenSplitRatio = ratio;
      chrome.storage.local.set({ screenSplitRatio: ratio });
      console.log('TSNotes: 窗口分割比例已设置为', ratio);
    }
  }
});