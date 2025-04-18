import edge_tts
import asyncio
import os
from datetime import datetime

async def main():
    # 要转换的文本
    text = "你好，這是 Microsoft HsiaoChen Online (Natural) 中文语音的测试。"
    
    # 获取当前时间，生成文件名
    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # 自定义保存路径
    # save_directory = input("请输入保存路径（例如：/Users/yourname/Documents/）：")
    # 自定义保存路径，使用 os.path.expanduser 来处理 ~ 符号
    save_directory = os.path.expanduser("~/Desktop/")

    # 检查路径是否存在，如果不存在则中断程序并提示
    if not os.path.exists(save_directory):
        raise FileNotFoundError(f"路径不存在：{save_directory}")

    # 文件路径和名称，使用当前时间作为文件名
    file_name = f"output_{current_time}.mp3"
    file_path = os.path.join(save_directory, file_name)

    # 使用 HsiaoChen 作为发音人
    communicate = edge_tts.Communicate(text, voice="zh-TW-HsiaoChenNeural", rate="+0%", volume="+0%")
    await communicate.save(file_path)

    print(f"文件已保存到：{file_path}")

# 运行异步函数
asyncio.run(main())
