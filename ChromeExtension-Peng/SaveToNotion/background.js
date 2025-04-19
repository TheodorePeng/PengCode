// 初始化扩展
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "saveToNotion",
    title: "保存到Notion",
    contexts: ["page"]
  });
});

// 处理扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  handleIconClick(tab);
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToNotion") {
    handleIconClick(tab);
  }
});

// 处理扩展图标或右键菜单点击
function handleIconClick(tab) {
  // 检查是否已设置Notion API令牌
  chrome.storage.local.get(["notionToken", "notionDatabaseId"], (result) => {
    if (!result.notionToken) {
      // 如果未设置令牌，显示设置对话框
      chrome.tabs.sendMessage(tab.id, { action: "showSettingsDialog" });
    } else {
      // 已设置令牌，显示保存对话框
      chrome.tabs.sendMessage(tab.id, { 
        action: "showSaveDialog",
        databaseId: result.notionDatabaseId || ""
      });
    }
  });
}

// 处理保存页面请求
async function handleSaveRequest(message, sender, sendResponse) {
  try {
    console.log("处理保存页面请求:", message);
    
    // 获取令牌
    chrome.storage.local.get(["notionToken"], async (result) => {
      try {
        if (!result.notionToken) {
          throw new Error("Notion API 令牌未设置");
        }
        
        // 检查URL是否已存在
        const isDuplicate = await checkDuplicate(
          result.notionToken,
          message.databaseId,
          message.url
        );
        
        if (isDuplicate.exists) {
          // URL已存在，通知内容脚本
          sendResponse({
            success: false,
            duplicate: true,
            pageId: isDuplicate.pageId
          });
        } else {
          let mappingData = message.pageData;
          
          // 如果收到了新格式的数据（originalData字段）
          if (message.pageData.originalData) {
            mappingData = message.pageData.originalData;
            console.log("检测到originalData字段，使用它作为映射数据:", mappingData);
          }
          
          if (!mappingData || Object.keys(mappingData).length === 0) {
            throw new Error("页面数据为空，无法保存");
          }
          
          // 获取数据库属性
          const databaseProperties = await getDatabaseProperties(
            result.notionToken,
            message.databaseId
          );
          
          // 构建Notion页面属性
          let pageProperties;
          try {
            console.log("开始构建Notion页面属性...");
            pageProperties = await buildNotionPageProperties(
              databaseProperties,
              mappingData
            );
            console.log("成功构建Notion页面属性:", pageProperties);
            
            if (!pageProperties || Object.keys(pageProperties).length === 0) {
              throw new Error("构建的页面属性为空");
            }
          } catch (error) {
            console.error("构建页面属性失败:", error);
            throw new Error(`构建页面属性失败: ${error.message}`);
          }
          
          // 准备请求体
          const requestBody = {
            parent: { database_id: message.databaseId },
            properties: pageProperties
          };
          
          // 如果有封面图片，添加到请求中
          if (message.coverUrl) {
            try {
              console.log("处理封面图片:", message.coverUrl);
              
              // 判断是否是Bilibili域名的图片
              const isBilibiliImage = message.coverUrl.includes('bilibili.com') || 
                                     message.coverUrl.includes('hdslb.com') || 
                                     message.coverUrl.includes('b23.tv');
                
              // 判断是否包含@符号（Bilibili图片URL特征）
              const hasBilibiliFormat = message.coverUrl.includes('@');
              
              let coverUrl = message.coverUrl;
              
              // 处理Bilibili图片URL
              if (isBilibiliImage && hasBilibiliFormat) {
                // 移除@后的参数，获取原始尺寸图片
                coverUrl = message.coverUrl.split('@')[0];
                console.log("处理后的Bilibili图片URL:", coverUrl);
              }
              
              // 尝试检查图片是否可访问
              try {
                const imgResponse = await fetch(coverUrl, { method: 'HEAD' });
                if (!imgResponse.ok) {
                  console.warn(`封面图片不可访问 (${imgResponse.status}): ${coverUrl}`);
                  // 不添加封面，但继续创建页面
                  throw new Error("封面图片不可访问");
                }
              } catch (imgError) {
                console.warn("检查图片可访问性时出错:", imgError);
                // 尝试应用proxy或备用URL
                if (isBilibiliImage) {
                  // 使用代理服务处理跨域图片
                  // 注意：此处使用免费开源的图片代理服务，用于解决跨域问题
                  coverUrl = `https://images.weserv.nl/?url=${encodeURIComponent(coverUrl)}`;
                  console.log("使用代理服务处理Bilibili图片:", coverUrl);
                }
              }
              
              // 验证URL格式
              const urlObj = new URL(coverUrl);
              requestBody.cover = {
                type: "external",
                external: {
                  url: urlObj.toString()
                }
              };
              
              console.log("最终使用的封面URL:", urlObj.toString());
            } catch (coverError) {
              console.error("处理封面URL时出错:", coverError);
              // 出错时不添加封面，但不阻止页面创建
            }
          }
          
          console.log("发送到Notion的请求数据:", JSON.stringify(requestBody, null, 2));
          
          try {
            // 调用Notion API
            const response = await fetch("https://api.notion.com/v1/pages", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${result.notionToken}`,
                "Content-Type": "application/json",
                "Notion-Version": "2022-06-28"
              },
              body: JSON.stringify(requestBody)
            });
            
            const responseData = await response.json();
            
            if (!response.ok) {
              console.error("Notion API错误:", response.status, responseData);
              
              // 如果问题是与封面图片相关，尝试不带封面再次创建
              if (requestBody.cover && 
                  (responseData.message && (
                    responseData.message.includes("cover") || 
                    responseData.message.includes("URL")
                  ))
              ) {
                console.log("看起来封面图片有问题，尝试不带封面重新创建页面");
                
                // 移除封面后重试
                delete requestBody.cover;
                const retryResponse = await fetch("https://api.notion.com/v1/pages", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${result.notionToken}`,
                    "Content-Type": "application/json",
                    "Notion-Version": "2022-06-28"
                  },
                  body: JSON.stringify(requestBody)
                });
                
                const retryData = await retryResponse.json();
                
                if (!retryResponse.ok) {
                  console.error("重试创建页面失败:", retryResponse.status, retryData);
                  throw new Error(`Notion API错误(${response.status}): ${responseData.message || JSON.stringify(responseData)}`);
                }
                
                // 成功创建页面（但没有封面）
                console.log("成功创建页面（没有封面）:", retryData);
                
                sendResponse({
                  success: true,
                  pageId: retryData.id,
                  warning: "页面已创建，但无法设置封面图片"
                });
                
                return;
              }
              
              throw new Error(`Notion API错误(${response.status}): ${responseData.message || JSON.stringify(responseData)}`);
            }
            
            console.log("保存成功，返回结果:", responseData);
            
            sendResponse({
              success: true,
              pageId: responseData.id
            });
          } catch (error) {
            console.error("调用Notion API出错:", error);
            throw error;
          }
        }
      } catch (error) {
        console.error("保存到Notion出错:", error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    });
  } catch (error) {
    console.error("处理保存请求时出错:", error);
    sendResponse({
      success: false,
      error: error.message || "处理保存请求时出错"
    });
  }
  return true; // 保持消息通道开放
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("收到消息:", message.action);
  
  if (message.action === "saveSettings") {
    // 保存设置
    chrome.storage.local.set({
      notionToken: message.notionToken,
      notionDatabaseId: message.notionDatabaseId || ""
    }, () => {
      console.log("设置已保存");
      sendResponse({ success: true });
    });
    return true; // 保持消息通道开放
  }
  
  if (message.action === "saveUserPreferences") {
    // 保存用户配置（属性显示/隐藏及映射关系）
    chrome.storage.local.set({
      propertyVisibility: message.propertyVisibility || {},
      propertyMappings: message.propertyMappings || {}
    }, () => {
      console.log("用户偏好已保存");
      sendResponse({ success: true });
    });
    return true; // 保持消息通道开放
  }
  
  if (message.action === "getUserPreferences") {
    // 获取用户配置
    chrome.storage.local.get(["propertyVisibility", "propertyMappings"], (result) => {
      console.log("返回用户偏好");
      sendResponse({
        success: true,
        propertyVisibility: result.propertyVisibility || {},
        propertyMappings: result.propertyMappings || {}
      });
    });
    return true; // 保持消息通道开放
  }
  
  if (message.action === "saveToNotion") {
    console.log("处理保存到Notion请求");
    // 确保异步处理完成后能够发送响应
    handleSaveRequest(message, sender, sendResponse);
    return true; // 保持消息通道开放
  }

  if (message.action === "getDatabaseProperties") {
    // 获取数据库属性
    console.log("获取数据库属性");
    chrome.storage.local.get(["notionToken"], async (result) => {
      try {
        if (!result.notionToken) {
          console.error("未设置Notion令牌");
          sendResponse({ success: false, error: "未设置Notion令牌" });
          return;
        }
        
        const properties = await getDatabaseProperties(
          result.notionToken,
          message.databaseId
        );
        console.log("成功获取数据库属性");
        sendResponse({ success: true, properties });
      } catch (error) {
        console.error("获取数据库属性出错:", error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    });
    return true; // 保持消息通道开放
  }
  
  // 如果没有处理该消息，返回false
  return false;
});

// 检查URL是否已存在于数据库中
async function checkDuplicate(token, databaseId, url) {
  try {
    // 首先获取数据库属性，找到URL类型的属性名
    const databaseProperties = await getDatabaseProperties(token, databaseId);
    let urlPropertyName = null;
    
    // 查找URL类型的属性
    for (const [propertyName, propertyValue] of Object.entries(databaseProperties)) {
      if (propertyValue.type === "url") {
        urlPropertyName = propertyName;
        break;
      }
    }
    
    // 如果找不到URL属性，返回不存在
    if (!urlPropertyName) {
      console.warn("在数据库中找不到URL类型的属性");
      return { exists: false };
    }
    
    // 使用找到的URL属性名创建过滤器
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-02-22",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: {
          property: urlPropertyName,
          url: {
            equals: url
          }
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Notion API查询错误详情:", errorData);
      throw new Error(`Notion API错误: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return {
        exists: true,
        pageId: data.results[0].id
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error("检查URL是否重复时出错:", error);
    // 出错时返回不存在，避免阻止用户保存
    return { exists: false };
  }
}

// 获取数据库属性
async function getDatabaseProperties(token, databaseId) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-02-22"
    }
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error("获取数据库属性错误详情:", errorData);
    throw new Error(`Notion API错误: ${response.status}`);
  }
  
  const data = await response.json();
  return data.properties;
}

// 从验证错误中提取有用的错误描述
function getValidationErrorDescription(errorData) {
  if (!errorData || !errorData.code) return "未知数据格式错误";
  
  if (errorData.code === "validation_error") {
    return errorData.message || "请求数据格式不符合Notion API要求";
  }
  
  return "请检查数据格式";
}

// 构建更可靠的页面数据，修复可能的格式问题
async function buildNotionPageProperties(databaseProperties, mappingData) {
  try {
    const pageData = {};
    let hasTitleProperty = false;
    
    for (const [propertyName, property] of Object.entries(mappingData)) {
      const type = property.type;
      const value = property.value;
      const propertyStructure = databaseProperties[propertyName];
      
      // 确保属性存在于数据库中
      if (!propertyStructure) {
        console.warn(`属性 "${propertyName}" 在数据库中不存在，已跳过`);
        continue;
      }
      
      // 确保属性类型匹配
      if (propertyStructure.type !== type) {
        console.warn(`属性 "${propertyName}" 类型不匹配: 提供了 ${type}，但数据库中是 ${propertyStructure.type}`);
        continue;
      }
      
      if (type === "title") {
        hasTitleProperty = true;
        if (!value) {
          // 标题不能为空，设置默认值
          pageData[propertyName] = {
            title: [{ text: { content: "无标题" } }]
          };
        } else {
          pageData[propertyName] = {
            title: [{ text: { content: value } }]
          };
        }
      } else if (type === "rich_text") {
        // 富文本可以为空
        pageData[propertyName] = {
          rich_text: value ? [{ text: { content: value } }] : []
        };
      } else if (type === "url") {
        // URL可以为空或null
        pageData[propertyName] = { url: value || null };
      } else if (type === "select") {
        if (value) {
          // 验证选项是否存在
          if (propertyStructure.select && propertyStructure.select.options) {
            const optionExists = propertyStructure.select.options.some(option => 
              option.name === value
            );
            
            if (optionExists) {
              pageData[propertyName] = { select: { name: value } };
            } else {
              console.warn(`选择项 "${value}" 在属性 "${propertyName}" 中不存在`);
              // 使用第一个可用的选项或不设置
              if (propertyStructure.select.options.length > 0) {
                pageData[propertyName] = { 
                  select: { name: propertyStructure.select.options[0].name } 
                };
              }
            }
          } else {
            // 如果没有选项结构，仍然尝试设置值
            pageData[propertyName] = { select: { name: value } };
          }
        }
      } else if (type === "multi_select") {
        // 初始化为空数组
        const multiSelectValues = [];
        
        if (Array.isArray(value) && value.length > 0) {
          // 验证每个选项是否存在
          if (propertyStructure.multi_select && propertyStructure.multi_select.options) {
            const validOptions = propertyStructure.multi_select.options.map(opt => opt.name);
            
            for (const item of value) {
              if (validOptions.includes(item)) {
                multiSelectValues.push({ name: item });
              } else {
                console.warn(`多选项 "${item}" 在属性 "${propertyName}" 中不存在`);
              }
            }
          } else {
            // 如果没有选项结构，仍然尝试设置所有值
            multiSelectValues.push(...value.map(name => ({ name })));
          }
        }
        
        pageData[propertyName] = { multi_select: multiSelectValues };
      } else if (type === "checkbox") {
        pageData[propertyName] = { checkbox: Boolean(value) };
      } else if (type === "number") {
        let numValue = null;
        if (value !== null && value !== undefined) {
          numValue = Number(value);
          if (isNaN(numValue)) {
            console.warn(`属性 "${propertyName}" 的值不是有效数字`);
            numValue = null;
          }
        }
        pageData[propertyName] = { number: numValue };
      } else if (type === "date") {
        if (value) {
          // 尝试格式化为ISO日期字符串
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              pageData[propertyName] = { 
                date: { start: date.toISOString() } 
              };
            } else {
              console.warn(`属性 "${propertyName}" 的值不是有效日期`);
            }
          } catch (error) {
            console.warn(`属性 "${propertyName}" 的日期格式化错误:`, error);
          }
        }
      }
      // 其他类型可按需添加
    }
    
    // 如果没有标题属性，可能会导致API错误
    if (!hasTitleProperty) {
      console.warn("警告: 没有提供标题属性，Notion可能无法创建页面");
    }
    
    return pageData;
  } catch (error) {
    console.error("构建Notion页面属性时出错:", error);
    throw error;
  }
}

// 加载配置
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["notionToken", "notionDatabaseId"], (result) => {
      resolve({
        notionToken: result.notionToken || "",
        notionDatabaseId: result.notionDatabaseId || ""
      });
    });
  });
} 